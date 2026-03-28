export function TypingIndicator({ name }: { name: string }) {
  return (
    <div class="flex justify-start mb-2">
      <div class="bg-white border border-[#e2e8f0] px-4 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
        <span class="text-xs text-[#64748b]">{name} is typing</span>
        <div class="flex gap-0.5 items-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              class="w-1.5 h-1.5 rounded-full bg-[#94a3b8] inline-block"
              style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
