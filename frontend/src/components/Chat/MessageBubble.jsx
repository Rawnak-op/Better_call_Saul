import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Volume2, VolumeX, Square } from 'lucide-react';

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
 * Includes Voice Message playback and no legal citations button.
 */
function SaulBubble({ message, onSpeak, isSpeakingThis }) {
  return (
    <div className="flex items-start gap-3 group">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border border-gold/40 shadow-sm shadow-gold/20 flex items-center justify-center mt-1 bg-dark">
        <img src="/saul-avatar.jpg" alt="Saul" className="w-full h-full object-cover" />
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

          {/* Voice Message Audio Player Action */}
          {!message.error && message.content && (
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => onSpeak && onSpeak(message.content, message.id)}
                className={`inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-xl border transition-all ${
                  isSpeakingThis
                    ? 'bg-gold/20 text-gold border-gold/40 shadow-sm shadow-gold/20'
                    : 'bg-white/5 text-slate-300 border-white/10 hover:border-gold/30 hover:text-gold'
                }`}
                title={isSpeakingThis ? 'Stop voice message' : 'Listen to Saul read this message aloud'}
              >
                {isSpeakingThis ? (
                  <>
                    <Square className="w-3.5 h-3.5 text-gold fill-gold" />
                    <span>Stop Voice Note</span>
                    {/* Animated sound wave bars */}
                    <div className="flex items-center gap-0.5 h-3 ml-1">
                      <span className="w-0.5 bg-gold rounded-full soundwave-bar" style={{ animationDelay: '0ms' }} />
                      <span className="w-0.5 bg-gold rounded-full soundwave-bar" style={{ animationDelay: '200ms' }} />
                      <span className="w-0.5 bg-gold rounded-full soundwave-bar" style={{ animationDelay: '400ms' }} />
                      <span className="w-0.5 bg-gold rounded-full soundwave-bar" style={{ animationDelay: '100ms' }} />
                    </div>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-gold" />
                    <span>Listen (Voice Note)</span>
                  </>
                )}
              </button>
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

export default function MessageBubble({ message, onSpeak, speakingId }) {
  if (message.role === 'user') {
    return <UserBubble message={message} />;
  }
  return (
    <SaulBubble
      message={message}
      onSpeak={onSpeak}
      isSpeakingThis={speakingId === message.id}
    />
  );
}
