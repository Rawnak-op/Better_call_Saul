import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Scale } from 'lucide-react';
import SourceCard from './SourceCard';

/**
 * Formats a Date object into a human-readable time string (e.g. "2:34 PM").
 * @param {Date} date
 */
function formatTime(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date instanceof Date ? date : new Date(date));
}

/**
 * UserBubble — right-aligned gold bubble for user messages.
 * Supports rendering attached evidence/photos.
 */
function UserBubble({ message }) {
  return (
    <div className="flex justify-end items-end gap-2 group">
      <div className="max-w-[85%] md:max-w-[75%] flex flex-col items-end">
        <div className="bg-gold text-dark rounded-2xl rounded-br-sm px-4 py-3 shadow-lg shadow-gold/20 space-y-2">
          {message.image && (
            <div className="rounded-xl overflow-hidden border border-black/10 bg-black/5 max-w-sm">
              <img
                src={message.image}
                alt="Case Evidence / Proof"
                className="max-h-60 w-auto object-contain cursor-pointer hover:opacity-95 transition-opacity"
                onClick={() => window.open(message.image, '_blank')}
                title="Click to view full image"
              />
            </div>
          )}
          {message.content && (
            <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}
        </div>
        <span className="text-xs text-slate-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

/**
 * SaulBubble — left-aligned dark card with SAUL avatar for assistant messages.
 */
function SaulBubble({ message }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const hasSources = message.sources && message.sources.length > 0;

  return (
    <div className="flex items-start gap-3 group">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gold/10 border border-gold/40 flex items-center justify-center mt-1">
        <Scale className="w-4 h-4 text-gold" />
      </div>

      <div className="flex-1 max-w-[90%] md:max-w-[80%]">
        <div
          className={`rounded-2xl rounded-tl-sm px-5 py-4 border shadow-sm ${
            message.error
              ? 'bg-rose-950/20 border-rose-800/40 text-rose-200'
              : 'bg-dark-card border-white/5 text-slate-100'
          }`}
        >
          {/* Markdown answer */}
          <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed space-y-3 prose-p:my-2 prose-headings:text-gold prose-strong:text-slate-100 prose-ul:my-2 prose-li:my-0.5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>

          {/* Source Citations Toggle */}
          {hasSources && (
            <div className="mt-4 pt-3 border-t border-white/5">
              <button
                onClick={() => setSourcesOpen((prev) => !prev)}
                className="text-xs font-medium text-gold hover:text-gold-light transition-colors flex items-center gap-1.5"
              >
                <span>{sourcesOpen ? '▾ Hide Legal Citations' : '▸ View Legal Citations'}</span>
                <span className="bg-gold/15 text-gold text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                  {message.sources.length}
                </span>
              </button>

              {sourcesOpen && (
                <div className="mt-3 space-y-2">
                  {message.sources.map((src, i) => (
                    <SourceCard key={i} source={src} index={i + 1} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <span className="text-xs text-slate-500 mt-1 inline-block opacity-0 group-hover:opacity-100 transition-opacity">
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

export default function MessageBubble({ message }) {
  if (message.role === 'user') {
    return <UserBubble message={message} />;
  }
  return <SaulBubble message={message} />;
}
