/**
 * ChatWindow — the only Preact island in the app.
 * Loaded with client:only="preact" — no SSR.
 *
 * Connects to /api/chat/:consultationId?token=<session_cookie_value>
 * WebSocket protocol defined in src/lib/chat/types.ts
 */
import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { ChatInput } from "./ChatInput";
import type { ChatMessage, ChatUser } from "./types";

type Props = {
  consultationId: string;
  currentUser: ChatUser;
  otherUser: ChatUser;
  sessionToken: string;
  isDoctor: boolean;
  onComplete?: () => void;
};

type ServerMessage =
  | { type: "message"; message: ChatMessage }
  | { type: "history"; messages: ChatMessage[] }
  | { type: "typing"; userId: string; isTyping: boolean }
  | { type: "user_joined"; userId: string }
  | { type: "user_left"; userId: string }
  | { type: "error"; message: string };

export function ChatWindow({
  consultationId,
  currentUser,
  otherUser,
  sessionToken,
  isDoctor,
  onComplete,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const connect = useCallback(() => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${location.host}/api/chat/${consultationId}?token=${sessionToken}&consultationId=${consultationId}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        switch (msg.type) {
          case "history":
            setMessages(msg.messages);
            setTimeout(scrollToBottom, 50);
            break;
          case "message":
            setMessages((prev) => [...prev, msg.message]);
            setTimeout(scrollToBottom, 50);
            break;
          case "typing":
            if (msg.userId !== currentUser.id) setOtherTyping(msg.isTyping);
            break;
          case "user_joined":
            if (msg.userId !== currentUser.id) setOtherOnline(true);
            break;
          case "user_left":
            if (msg.userId !== currentUser.id) {
              setOtherOnline(false);
              setOtherTyping(false);
            }
            break;
          case "error":
            setError(msg.message);
            break;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setOtherOnline(false);
      // Auto-reconnect after 3s
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      setError("Connection error. Reconnecting…");
      ws.close();
    };
  }, [consultationId, sessionToken]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  function sendText(text: string) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "text", content: text }));
    }
  }

  function sendTyping(isTyping: boolean) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", isTyping }));
    }
  }

  async function uploadAndSendFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const d = await res.json<{ error: string }>();
      throw new Error(d.error ?? "Upload failed");
    }
    const { key, url } = await res.json<{ key: string; url: string }>();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "file",
        fileUrl: url,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      }));
    }
  }

  async function handleComplete() {
    if (!confirm("Mark this consultation as complete?")) return;
    setCompleting(true);
    try {
      const res = await fetch(`/api/consultation/${consultationId}/complete`, { method: "POST" });
      if (res.ok) {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "text", content: "— Consultation marked as complete —" }));
        }
        onComplete?.();
        setTimeout(() => window.location.href = "/dashboard/doctor", 1000);
      }
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div class="flex flex-col h-[calc(100dvh-56px)] bg-[#f8fafc]">
      {/* Header */}
      <div class="bg-white border-b border-[#e2e8f0] px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <a href={isDoctor ? "/dashboard/doctor" : "/dashboard/patient"}
            class="text-[#64748b] hover:text-[#1e293b] transition-colors mr-1">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </a>
          <div class={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${otherOnline ? "bg-green-100 text-[#2d9f6a]" : "bg-[#f1f5f9] text-[#64748b]"}`}>
            {otherUser.name.charAt(0)}
          </div>
          <div>
            <p class="font-semibold text-sm">{otherUser.name}</p>
            <p class="text-xs text-[#64748b]">
              {otherOnline ? (
                <span class="text-[#2d9f6a]">● Online</span>
              ) : connected ? "● Away" : "Connecting…"}
            </p>
          </div>
        </div>
        {isDoctor && (
          <button
            onClick={handleComplete}
            disabled={completing}
            class="px-3 py-1.5 rounded-lg bg-[#2d9f6a] text-white text-xs font-semibold hover:bg-[#1d7a50] transition-colors disabled:opacity-60"
          >
            {completing ? "Completing…" : "Complete"}
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div class="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800">{error}</div>
      )}

      {/* Messages */}
      <div class="flex-1 overflow-y-auto px-4 py-4 space-y-0">
        {messages.length === 0 && connected && (
          <div class="text-center text-[#94a3b8] text-sm mt-8">
            <p>Consultation started. Say hello!</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} currentUser={currentUser} />
        ))}
        {otherTyping && <TypingIndicator name={otherUser.name} />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <ChatInput
        onSend={sendText}
        onTyping={sendTyping}
        onFileUpload={uploadAndSendFile}
        disabled={!connected}
      />
    </div>
  );
}
