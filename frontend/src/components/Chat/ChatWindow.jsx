import { useState, useRef, useEffect, useCallback } from 'react';
import { Scale, Send, RotateCcw } from 'lucide-react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

const WELCOME_MESSAGE = {
  id: '__welcome__',
  role: 'assistant',
  content:
    "Welcome! I'm **Saul**, your legal AI assistant. I'm well-versed in constitutions, statutes, case law, and legal codes. Upload documents to the knowledge base on the left, then ask me anything about the law.\n\nHow can I assist you today?",
  sources: [],
  timestamp: new Date(),
  error: false,
};

const MIN_TEXTAREA_HEIGHT = 44;
const MAX_TEXTAREA_HEIGHT = 160;

/**
 * ChatWindow — main chat UI panel.
 *
 * Props:
 * - messages: array
 * - isLoading: bool
 * - sendMessage: fn(content: string)
 * - clearChat: fn()
 */
export default function ChatWindow({ messages, isLoading, sendMessage, clearChat }) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [input]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
    }
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Allow Enter to naturally create a newline on mobile/touch devices
      const isMobile = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
      if (isMobile) {
        return;
      }
      
      e.preventDefault();
      handleSend();
    }
  };

  const displayMessages = messages.length === 0 ? [WELCOME_MESSAGE] : messages;
  const canSend = input.trim().length > 0 && !isLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-dark-surface/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold/40 flex items-center justify-center">
            <Scale className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gold tracking-wide">SAUL</h1>
            <p className="text-xs text-slate-400">Legal AI Assistant</p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-gold border border-white/10 hover:border-gold/40 px-3 py-1.5 rounded-lg transition-all"
            title="Start a new conversation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New Chat
          </button>
        )}
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-5">
        {displayMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && <TypingIndicator />}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 md:px-8 py-4 border-t border-white/5 bg-dark-surface/30 backdrop-blur-sm">
        <div className="flex items-end gap-3 bg-dark-card border border-white/10 rounded-2xl px-4 py-3 focus-within:border-gold/40 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Saul about the law… (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none outline-none leading-relaxed disabled:opacity-50"
            style={{ minHeight: MIN_TEXTAREA_HEIGHT, maxHeight: MAX_TEXTAREA_HEIGHT }}
          />

          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              canSend
                ? 'bg-gold hover:bg-gold-light text-dark shadow-lg shadow-gold/30 hover:shadow-gold/50'
                : 'bg-white/5 text-slate-600 cursor-not-allowed'
            }`}
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <p className="text-center text-xs text-slate-600 mt-2">
          For informational purposes only · Not a substitute for professional legal advice · &copy; {new Date().getFullYear()} Rawnak Yadav
        </p>
      </div>
    </div>
  );
}
