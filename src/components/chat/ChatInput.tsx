import { useState, useRef } from "preact/hooks";

type Props = {
  onSend: (text: string) => void;
  onTyping: (isTyping: boolean) => void;
  onFileUpload: (file: File) => Promise<void>;
  disabled?: boolean;
};

export function ChatInput({ onSend, onTyping, onFileUpload, disabled }: Props) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInput(e: Event) {
    const val = (e.target as HTMLTextAreaElement).value;
    setText(val);

    onTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping(false), 1500);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    if (typingTimer.current) clearTimeout(typingTimer.current);
    onTyping(false);
  }

  async function handleFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onFileUpload(file);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div class="border-t border-[#e2e8f0] bg-white p-3">
      <div class="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || uploading}
          class="p-2 rounded-lg text-[#64748b] hover:text-[#1e6fb0] hover:bg-[#f1f5f9] transition-colors disabled:opacity-50 shrink-0"
          title="Attach file"
        >
          {uploading ? (
            <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          )}
        </button>
        <input ref={fileRef} type="file" class="hidden" onChange={handleFile}
          accept="image/*,.pdf,.doc,.docx" />

        <textarea
          value={text}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          rows={1}
          disabled={disabled}
          class="flex-1 resize-none rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e6fb0] focus:border-transparent max-h-32 disabled:opacity-50"
          style={{ minHeight: "40px" }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          class="p-2 rounded-xl bg-[#1e6fb0] text-white hover:bg-[#155a91] transition-colors disabled:opacity-40 shrink-0"
          title="Send message"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
