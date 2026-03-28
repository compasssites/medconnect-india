/**
 * ChatRoom Durable Object
 *
 * Uses regular DO key-value storage (new_classes migration).
 * Messages stored as individual keys: msg:<ulid> → JSON.
 * Message index stored as: index → ULID[] (sorted).
 *
 * Pattern based on cloudflare/workers-chat-demo with WebSocket Hibernation API.
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
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const token = url.searchParams.get("token");
    if (!token) return new Response("Missing token", { status: 401 });

    const sessionJson = await this.env.SESSIONS.get(`session:${token}`);
    if (!sessionJson) return new Response("Invalid or expired session", { status: 401 });

    let session: { userId: string; phone: string; role?: string; expiresAt: number };
    try {
      session = JSON.parse(sessionJson);
    } catch {
      return new Response("Malformed session", { status: 401 });
    }

    if (Date.now() > session.expiresAt) return new Response("Session expired", { status: 401 });

    const existing = this.ctx.getWebSockets();
    if (existing.length >= 2) return new Response("Room is full", { status: 409 });

    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];

    const attachment: WsAttachment = {
      userId: session.userId,
      role: (session.role as "doctor" | "patient") ?? "patient",
      consultationId: url.searchParams.get("consultationId") ?? "unknown",
    };

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attachment);

    // Send history on connect
    const history = await this.getHistory();
    server.send(JSON.stringify({ type: "history", messages: history } satisfies ServerMessage));

    this.broadcast(server, { type: "user_joined", userId: session.userId });

    return new Response(null, { status: 101, webSocket: client });
  }

  // ─── Hibernation handlers ──────────────────────────────────────────────────

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const attachment = ws.deserializeAttachment() as WsAttachment;

    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" } satisfies ServerMessage));
      return;
    }

    switch (parsed.type) {
      case "typing":
        this.broadcast(ws, { type: "typing", userId: attachment.userId, isTyping: parsed.isTyping });
        break;

      case "read_receipt":
        await this.ctx.storage.put(`read:${attachment.userId}`, parsed.lastReadMessageId);
        this.broadcast(ws, { type: "read_receipt", userId: attachment.userId, lastReadMessageId: parsed.lastReadMessageId });
        break;

      case "load_history": {
        const messages = await this.getHistory(parsed.before, parsed.limit ?? 50);
        ws.send(JSON.stringify({ type: "history", messages } satisfies ServerMessage));
        break;
      }

      case "text": {
        const msg = await this.persistMessage({
          senderId: attachment.userId,
          type: "text",
          content: parsed.content,
        });
        this.broadcastAll({ type: "message", message: msg });
        break;
      }

      case "file": {
        const msg = await this.persistMessage({
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
    if (attachment) this.broadcast(ws, { type: "user_left", userId: attachment.userId });
    ws.close();
  }

  // ─── Storage helpers ───────────────────────────────────────────────────────

  private async persistMessage(data: {
    senderId: string;
    type: ChatMessage["type"];
    content: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
  }): Promise<ChatMessage> {
    const id = ulid();
    const msg: ChatMessage = {
      id,
      senderId: data.senderId,
      type: data.type,
      content: data.content,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      fileType: data.fileType,
      fileSize: data.fileSize,
      createdAt: Math.floor(Date.now() / 1000),
    };

    // Store message and append to index atomically
    const index: string[] = (await this.ctx.storage.get("index")) ?? [];
    index.push(id);
    await this.ctx.storage.put(`msg:${id}`, msg);
    await this.ctx.storage.put("index", index);

    return msg;
  }

  private async getHistory(before?: string, limit = 50): Promise<ChatMessage[]> {
    const index: string[] = (await this.ctx.storage.get("index")) ?? [];

    let ids = before ? index.slice(0, index.indexOf(before)) : index;
    ids = ids.slice(-limit); // last N

    if (ids.length === 0) return [];

    const entries = await this.ctx.storage.get<ChatMessage>(ids.map((id) => `msg:${id}`));
    return ids.map((id) => entries.get(`msg:${id}`)!).filter(Boolean);
  }

  private broadcast(sender: WebSocket, msg: ServerMessage) {
    const json = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== sender) ws.send(json);
    }
  }

  private broadcastAll(msg: ServerMessage) {
    const json = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) ws.send(json);
  }
}
