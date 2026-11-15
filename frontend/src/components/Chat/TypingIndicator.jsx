/**
 * TypingIndicator — animated Saul thinking indicator.
 */
export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 transition-opacity duration-300">
      {/* Animated avatar with glowing pulsing ring */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border border-gold/50 flex items-center justify-center mt-1 bg-dark shadow-sm saul-avatar-glow">
        <img src="/saul-avatar.jpg" alt="Saul" className="w-full h-full object-cover" />
      </div>

      <div className="flex flex-col items-start">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-semibold text-gold tracking-wider uppercase">Saul</span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-gold/90"></span>
          </span>
        </div>

        <div className="bg-dark-card border border-gold/20 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-3 shadow-lg shadow-gold/5">
          {/* Animated Bouncing & Glowing Dots */}
          <div className="flex items-center gap-1.5 h-4">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block w-2 h-2 rounded-full bg-gold"
                style={{
                  animation: 'saul-dot-bounce 1.2s infinite ease-in-out both',
                  animationDelay: `${i * 0.18}s`,
                }}
              />
            ))}
          </div>
          <span className="text-xs italic saul-thinking-text font-medium">
            Saul is thinking…
          </span>
        </div>
      </div>
    </div>
  );
}
