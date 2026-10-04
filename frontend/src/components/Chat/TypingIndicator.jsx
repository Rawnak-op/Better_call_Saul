import { Scale } from 'lucide-react';

/**
 * TypingIndicator — animated three-dot indicator shown while Saul is generating a response.
 */
export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      {/* Avatar matching SaulBubble */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/10 border border-gold/40 flex items-center justify-center mt-1">
        <Scale className="w-4 h-4 text-gold" />
      </div>

      <div className="flex flex-col items-start">
        <span className="text-xs font-semibold text-gold mb-1 tracking-wider uppercase">Saul</span>

        <div className="bg-dark-card border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-3 shadow-lg">
          {/* Bouncing dots */}
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="typing-dot block w-2 h-2 rounded-full bg-gold/70"
                style={{
                  animation: 'bounce-dot 1.4s infinite ease-in-out both',
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
          <span className="text-xs text-slate-400 italic">Saul is thinking…</span>
        </div>
      </div>
    </div>
  );
}
