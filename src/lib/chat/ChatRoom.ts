/**
 * ChatRoom Durable Object
 *
 * Pattern based on cloudflare/workers-chat-demo with WebSocket Hibernation API.
 * One DO per consultation. Hibernates when idle — zero cost at rest.
 *
 * Storage:
 *   - Messages persisted in DO's built-in SQLite (ctx.storage.sql)
 *   - Read receipts persisted in DO storage (ctx.storage)
 *
 * Auth:
 *   - sessionToken passed as `?token=<token>` query param on WebSocket upgrade
 *   - Validated against KV before accepting the WebSocket
 *
 * Hibernation:
 *   - Uses acceptWebSocket() + ws.serializeAttachment() to survive hibernation
 *   - Identity (userId, role) stored in attachment, not in-memory map
 */

import { DurableObject } from "cloudflare:workers";
import { ulid } from "ulid";
import type {
  ChatMessage,
  ClientMessage,
  ServerMessage,
  WsAttachment,
} from "./types";

type Env = {
  SESSIONS: KVNamespace;
  DB: D1Database;
};

export class ChatRoom extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;

    // Create messages table if not exists — runs once per DO lifetime
    ctx.blockConcurrencyWhile(async () => {
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          sender_id TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'text',
          content TEXT NOT NULL,
          file_url TEXT,
          file_name TEXT,
          file_type TEXT,
          file_size INTEGER,
          created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `);
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Must be a WebSocket upgrade
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    // Authenticate via session token in query param
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response("Missing token", { status: 401 });
    }

    const sessionJson = await this.env.SESSIONS.get(`session:${token}`);
    if (!sessionJson) {
      return new Response("Invalid or expired session", { status: 401 });
    }

    let session: { userId: string; phone: string; role?: string; expiresAt: number };
    try {
      session = JSON.parse(sessionJson);
    } catch {
      return new Response("Malformed session", { status: 401 });
    }

    if (Date.now() > session.expiresAt) {
      return new Response("Session expired", { status: 401 });
    }

    // Limit: max 2 connections per room (doctor + patient)
    const existing = this.ctx.getWebSockets();
    if (existing.length >= 2) {
      return new Response("Room is full", { status: 409 });
    }

    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    const consultationId = url.searchParams.get("consultationId") ?? "unknown";

    const attachment: WsAttachment = {
      userId: session.userId,
      role: (session.role as "doctor" | "patient") ?? "patient",
      consultationId,
    };

    // acceptWebSocket enables hibernation — attachment survives DO sleep/wake
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attachment);

    // Send recent message history on connect
    const history = this.getHistory();
    server.send(JSON.stringify({ type: "history", messages: history } satisfies ServerMessage));

    // Notify others that user joined
    this.broadcast(server, {
      type: "user_joined",
      userId: session.userId,
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  // ─── Hibernation handlers ──────────────────────────────────────────────────

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const attachment = ws.deserializeAttachment() as WsAttachment;

    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" } satisfies ServerMessage));
      return;
    }

    switch (parsed.type) {
      case "typing": {
        // Transient — broadcast but don't persist
        this.broadcast(ws, {
          type: "typing",
          userId: attachment.userId,
          isTyping: parsed.isTyping,
        });
        break;
      }

      case "read_receipt": {
        this.ctx.storage.put(`read:${attachment.userId}`, parsed.lastReadMessageId);
        this.broadcast(ws, {
          type: "read_receipt",
          userId: attachment.userId,
          lastReadMessageId: parsed.lastReadMessageId,
        });
        break;
      }

      case "load_history": {
        const messages = this.getHistory(parsed.before, parsed.limit ?? 50);
        ws.send(JSON.stringify({ type: "history", messages } satisfies ServerMessage));
        break;
      }

      case "text": {
        const msg = this.persistMessage({
          senderId: attachment.userId,
          type: "text",
          content: parsed.content,
        });
        this.broadcastAll({ type: "message", message: msg });
        break;
      }

      case "file": {
        const msg = this.persistMessage({
          senderId: attachment.userId,
          type: parsed.fileType.startsWith("image/") ? "image" : "file",
          content: parsed.fileName,
          fileUrl: parsed.fileUrl,
          fileName: parsed.fileName,
          fileType: parsed.fileType,
          fileSize: parsed.fileSize,
        });
        this.broadcastAll({ type: "message", message: msg });
        break;
      }
    }
  }

  webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    const attachment = ws.deserializeAttachment() as WsAttachment;
    ws.close();
    this.broadcast(ws, { type: "user_left", userId: attachment.userId });
  }

  webSocketError(ws: WebSocket, _error: unknown) {
    const attachment = ws.deserializeAttachment() as WsAttachment | null;
    if (attachment) {
      this.broadcast(ws, { type: "user_left", userId: attachment.userId });
    }
    ws.close();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private persistMessage(data: {
    senderId: string;
    type: ChatMessage["type"];
    content: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
  }): ChatMessage {
    const id = ulid();
    const createdAt = Math.floor(Date.now() / 1000);

    this.sql.exec(
      `INSERT INTO messages (id, sender_id, type, content, file_url, file_name, file_type, file_size, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      data.senderId,
      data.type,
      data.content,
      data.fileUrl ?? null,
      data.fileName ?? null,
      data.fileType ?? null,
      data.fileSize ?? null,
      createdAt
    );

    return { id, senderId: data.senderId, type: data.type, content: data.content, ...data, createdAt };
  }

  private getHistory(before?: string, limit = 50): ChatMessage[] {
    let cursor = before
      ? this.sql.exec<{ created_at: number }>(
          "SELECT created_at FROM messages WHERE id = ?",
          before
        ).one()?.created_at
      : undefined;

    const rows = cursor != null
      ? this.sql
          .exec<ChatMessage & { sender_id: string; file_url: string | null; file_name: string | null; file_type: string | null; file_size: number | null; created_at: number }>(
            `SELECT * FROM messages WHERE created_at < ? ORDER BY created_at DESC LIMIT ?`,
            cursor,
            limit
          )
          .toArray()
      : this.sql
          .exec<ChatMessage & { sender_id: string; file_url: string | null; file_name: string | null; file_type: string | null; file_size: number | null; created_at: number }>(
            `SELECT * FROM messages ORDER BY created_at DESC LIMIT ?`,
            limit
          )
          .toArray();

    return rows
      .map((r) => ({
        id: r.id,
        senderId: r.sender_id,
        type: r.type,
        content: r.content,
        fileUrl: r.file_url ?? undefined,
        fileName: r.file_name ?? undefined,
        fileType: r.file_type ?? undefined,
        fileSize: r.file_size ?? undefined,
        createdAt: r.created_at,
      }))
      .reverse(); // oldest first
  }

  /** Send to all connections except the sender */
  private broadcast(sender: WebSocket, msg: ServerMessage) {
    const json = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== sender) ws.send(json);
    }
  }

  /** Send to all connections including sender */
  private broadcastAll(msg: ServerMessage) {
    const json = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      ws.send(json);
    }
  }
}
