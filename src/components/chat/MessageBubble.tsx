import type { ChatMessage, ChatUser } from "./types";

type Props = {
  message: ChatMessage;
  currentUser: ChatUser;
};

function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageBubble({ message, currentUser }: Props) {
  const isMine = message.senderId === currentUser.id;
  const isSystem = message.type === "system";

  if (isSystem) {
    return (
      <div class="flex justify-center my-3">
        <span class="text-xs text-[#64748b] bg-[#f1f5f9] px-3 py-1 rounded-full">{message.content}</span>
      </div>
    );
  }

  return (
    <div class={`flex mb-3 ${isMine ? "justify-end" : "justify-start"}`}>
      <div class={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
        <div
          class={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isMine
              ? "bg-[#1e6fb0] text-white rounded-br-sm"
              : "bg-white border border-[#e2e8f0] text-[#1e293b] rounded-bl-sm"
          }`}
        >
          {message.type === "text" && <p style="white-space: pre-wrap; word-break: break-word;">{message.content}</p>}

          {message.type === "image" && message.fileUrl && (
            <div>
              <img
                src={message.fileUrl}
                alt={message.fileName ?? "Image"}
                class="max-w-full rounded-lg max-h-64 object-cover cursor-pointer"
                onClick={() => window.open(message.fileUrl, "_blank")}
              />
              {message.fileName && <p class={`text-xs mt-1 ${isMine ? "text-blue-200" : "text-[#64748b]"}`}>{message.fileName}</p>}
            </div>
          )}

          {message.type === "file" && message.fileUrl && (
            <a
              href={message.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              class={`flex items-center gap-2.5 no-underline ${isMine ? "text-white" : "text-[#1e293b]"}`}
            >
              <span class={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isMine ? "bg-blue-600" : "bg-[#f1f5f9]"}`}>
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <div class="min-w-0">
                <p class="text-sm font-medium truncate max-w-[160px]">{message.fileName ?? "File"}</p>
                {message.fileSize && (
                  <p class={`text-xs ${isMine ? "text-blue-200" : "text-[#64748b]"}`}>{formatSize(message.fileSize)}</p>
                )}
              </div>
            </a>
          )}
        </div>
        <span class="text-[10px] text-[#94a3b8] px-1">{formatTime(message.createdAt)}</span>
      </div>
    </div>
  );
}
