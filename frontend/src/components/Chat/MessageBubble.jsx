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
 */
function UserBubble({ message }) {
  return (
    <div className="flex justify-end items-end gap-2 group">
      <div className="max-w-[75%] flex flex-col items-end">
        <div className="bg-gold text-dark rounded-2xl rounded-br-sm px-4 py-3 shadow-lg shadow-gold/20">
          <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
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

      <div className="max-w-[80%] flex flex-col items-start">
        {/* Sender label */}
        <span className="text-xs font-semibold text-gold mb-1 tracking-wider uppercase">Saul</span>

        {/* Message card */}
        <div
          className={`rounded-2xl rounded-tl-sm px-4 py-3 shadow-lg ${
            message.error
              ? 'bg-red-950/50 border border-red-700/40'
              : 'bg-dark-card border border-white/5'
          }`}
        >
          <div className="prose-chat text-sm text-slate-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Legal sources collapsible section */}
          {hasSources && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setSourcesOpen((prev) => !prev)}
                className="flex items-center gap-2 text-xs font-semibold text-gold/80 hover:text-gold transition-colors"
              >
                <Scale className="w-3.5 h-3.5" />
                Legal Sources ({message.sources.length})
                <span className="text-slate-400">{sourcesOpen ? '▲' : '▼'}</span>
              </button>

              {sourcesOpen && (
                <div className="mt-2 flex flex-col gap-2">
                  {message.sources.map((source, i) => (
                    <SourceCard key={i} source={source} />
                  ))}
                </div>
              )}
            </div>
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
 * MessageBubble — renders either a user or assistant message.
 */
export default function MessageBubble({ message }) {
  if (message.role === 'user') {
    return <UserBubble message={message} />;
  }
  return <SaulBubble message={message} />;
}
