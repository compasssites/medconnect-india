// ─── Message types ────────────────────────────────────────────────────────────

export type MessageType = "text" | "image" | "file" | "system";

export type ChatMessage = {
  id: string;
  senderId: string;
  type: MessageType;
  content: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  createdAt: number;
};

// ─── Client → Server ─────────────────────────────────────────────────────────

export type ClientMessage =
  | { type: "text"; content: string }
  | {
      type: "file";
      fileUrl: string;
      fileName: string;
      fileType: string;
      fileSize: number;
    }
  | { type: "typing"; isTyping: boolean }
  | { type: "read_receipt"; lastReadMessageId: string }
  | { type: "load_history"; before?: string; limit?: number };

// ─── Server → Client ─────────────────────────────────────────────────────────

export type ServerMessage =
  | { type: "message"; message: ChatMessage }
  | { type: "history"; messages: ChatMessage[] }
  | { type: "typing"; userId: string; isTyping: boolean }
  | { type: "read_receipt"; userId: string; lastReadMessageId: string }
  | { type: "user_joined"; userId: string }
  | { type: "user_left"; userId: string }
  | { type: "error"; message: string };

// ─── WebSocket attachment (survives hibernation) ──────────────────────────────

export type WsAttachment = {
  userId: string;
  role: "doctor" | "patient";
  consultationId: string;
};
