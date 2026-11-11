import { useState, useRef, useEffect, useCallback } from 'react';
import { Scale, Send, RotateCcw, Paperclip, X, Image as ImageIcon } from 'lucide-react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

const WELCOME_MESSAGE = {
  id: '__welcome__',
  role: 'assistant',
  content:
    "Welcome! I'm **Saul**, your criminal defense strategist and legal counsel.\n\nI am grounded in statutory law (IPC, BNS, CrPC, Evidence Act). You can consult me on legal troubles, cross-examine procedural risks, or **attach photos & screenshots of evidence** (FIR copies, WhatsApp chats, medical MLCs, notices) for forensic legal analysis.\n\nWhat legal issue are you facing?",
  sources: [],
  timestamp: new Date(),
  error: false,
};

const MIN_TEXTAREA_HEIGHT = 44;
const MAX_TEXTAREA_HEIGHT = 160;

export default function ChatWindow({ messages, isLoading, sendMessage, clearChat }) {
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null); // base64 data URL
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
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

  // Handle clipboard paste (Ctrl + V for screenshots)
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              setSelectedImage(event.target.result);
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target.result);
    };
    reader.readAsDataURL(file);

    // reset input so the same file can be re-selected if deleted
    e.target.value = '';
  };

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if ((!trimmed && !selectedImage) || isLoading) return;

    sendMessage(trimmed, selectedImage);
    setInput('');
    setSelectedImage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
    }
  }, [input, selectedImage, isLoading, sendMessage]);

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
  const canSend = (input.trim().length > 0 || selectedImage) && !isLoading;

  return (
    <div className="flex flex-col h-full bg-dark">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-dark-surface/50 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-gold/50 shadow-md shadow-gold/20 flex-shrink-0 bg-dark">
            <img src="/saul-avatar.jpg" alt="Saul Goodman" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gold tracking-wide">SAUL</h1>
            <p className="text-xs text-slate-400">Criminal Defense Strategist & Legal AI</p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-gold border border-white/10 hover:border-gold/40 px-3 py-1.5 rounded-lg transition-all"
            title="Start a new consultation session"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New Consultation
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
        {/* Evidence image preview if attached */}
        {selectedImage && (
          <div className="mb-3 flex items-center gap-3 bg-dark-card border border-gold/30 rounded-xl p-2.5 max-w-sm">
            <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 bg-black/40">
              <img src={selectedImage} alt="Attached Evidence" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gold">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Case Evidence Attached</span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Image ready for legal inspection</p>
            </div>
            <button
              onClick={() => setSelectedImage(null)}
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
              title="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-3 bg-dark-card border border-white/10 rounded-2xl px-4 py-3 focus-within:border-gold/40 transition-colors">
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          {/* Attach evidence button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 p-2 text-slate-400 hover:text-gold rounded-xl hover:bg-gold/10 transition-colors"
            title="Attach screenshot or photo proof (FIR, WhatsApp chat, MLC)"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedImage
                ? "Describe this evidence or ask legal questions about it..."
                : "Ask Saul about the law or paste screenshots (Ctrl+V)..."
            }
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
