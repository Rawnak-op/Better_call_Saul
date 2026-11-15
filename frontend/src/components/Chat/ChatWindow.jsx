import { useState, useRef, useEffect, useCallback } from 'react';
import { Menu, LogIn, Send, RotateCcw, Paperclip, X, Image as ImageIcon, Mic, MicOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useVoice } from '../../hooks/useVoice';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

const WELCOME_MESSAGE = {
  id: '__welcome__',
  role: 'assistant',
  content:
    "Welcome! I'm **Saul Goodman**, attorney at law and your criminal defense counsel.\n\nI have complete mastery over Indian criminal law (IPC, BNS, CrPC, BNSS, and the Evidence Act). You can consult me on police trouble, arrest procedures, bail, cross-examine risks, **speak your situation via voice note**, or **attach photos & screenshots of evidence** (FIR copies, WhatsApp chats, medical MLCs, notices) for forensic legal strategy.\n\nWhat legal trouble are we facing?",
  sources: [],
  timestamp: new Date(),
  error: false,
};

const MIN_TEXTAREA_HEIGHT = 44;
const MAX_TEXTAREA_HEIGHT = 160;

export default function ChatWindow({ messages, isLoading, sendMessage, clearChat, onToggleSidebar }) {
  const { user, isGuest, setIsAuthModalOpen } = useAuth();
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null); // base64 data URL
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const {
    isListening,
    speechSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    speakingId,
    loadingId,
  } = useVoice();
  const [voiceError, setVoiceError] = useState(null);

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

    if (isListening) {
      stopListening();
    }

    sendMessage(trimmed, selectedImage);
    setInput('');
    setSelectedImage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
    }
  }, [input, selectedImage, isLoading, sendMessage, isListening, stopListening]);

  const handleToggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      setVoiceError(null);
      startListening(
        (transcript) => {
          setInput(transcript);
        },
        (err) => {
          setVoiceError(err === 'not-allowed' ? 'Microphone permission denied. Please allow mic access.' : 'Speech recognition error.');
          setTimeout(() => setVoiceError(null), 5000);
        }
      );
    }
  };

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
      <header className="flex items-center justify-between px-3 md:px-6 py-2.5 md:py-3.5 border-b border-white/5 bg-dark-surface/60 backdrop-blur-md flex-shrink-0 z-10">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {/* 3 lines / hamburger menu button for mobile */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 -ml-1 rounded-xl text-slate-300 hover:text-gold hover:bg-gold/10 border border-white/10 hover:border-gold/30 transition-all md:hidden flex-shrink-0"
            title="Chat History & Menu"
            aria-label="Chat History & Menu"
          >
            <Menu className="w-5 h-5 text-gold" />
          </button>

          <div className="w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden border border-gold/50 shadow-md shadow-gold/20 flex-shrink-0 bg-dark">
            <img src="/saul-avatar.jpg" alt="Saul Goodman" className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold text-gold tracking-wide leading-none">SAUL</h1>
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gold/10 text-gold border border-gold/30">ATTORNEY AT LAW</span>
            </div>
            <p className="text-[11px] md:text-xs text-slate-400 truncate mt-0.5">Criminal Defense Strategist & Legal Counsel</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {(!user || isGuest) && (
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gold/10 hover:bg-gold/20 text-gold text-xs font-semibold rounded-lg border border-gold/30 hover:border-gold/50 transition-all shadow-sm"
              title="Sign In to Save Consultations"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-gold border border-white/10 hover:border-gold/40 px-2.5 md:px-3 py-1.5 rounded-lg transition-all"
              title="Start a new consultation session"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Consultation</span>
            </button>
          )}
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-5">
        {displayMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onSpeak={speak}
            speakingId={speakingId}
            loadingId={loadingId}
          />
        ))}

        {isLoading && <TypingIndicator />}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 md:px-8 py-4 border-t border-white/5 bg-dark-surface/30 backdrop-blur-sm">
        {/* Voice listening indicator */}
        {isListening && (
          <div className="mb-2.5 flex items-center justify-between bg-rose-950/40 border border-rose-500/30 rounded-xl px-3.5 py-2 text-xs text-rose-300 shadow-sm shadow-rose-500/10">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="font-medium">Listening... speak your legal query clearly</span>
            </div>
            <button
              type="button"
              onClick={stopListening}
              className="text-xs text-rose-300 hover:text-white font-semibold underline underline-offset-2"
            >
              Done Recording
            </button>
          </div>
        )}

        {/* Voice Error notice */}
        {voiceError && (
          <div className="mb-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/40 rounded-xl px-3 py-1.5 flex items-center justify-between">
            <span>{voiceError}</span>
            <button onClick={() => setVoiceError(null)} className="text-rose-400 hover:text-rose-200 ml-2">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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

          {/* Voice message button */}
          <button
            type="button"
            onClick={handleToggleMic}
            className={`flex-shrink-0 p-2 rounded-xl transition-all relative ${
              isListening
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm shadow-rose-500/30'
                : 'text-slate-400 hover:text-gold hover:bg-gold/10'
            }`}
            title={isListening ? 'Click to stop recording' : 'Speak your legal situation (Voice Message)'}
          >
            {isListening ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75 top-0 left-0"></span>
                <Mic className="w-4 h-4 relative z-10 text-rose-400" />
              </>
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedImage
                ? "Describe this evidence or ask legal questions about it..."
                : isListening
                ? "Listening... speak now..."
                : "Ask Saul about your legal matter, speak via mic, or attach proof..."
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
          Better Call Saul · Criminal Defense Counsel · &copy; {new Date().getFullYear()} Rawnak Yadav
        </p>
      </div>
    </div>
  );
}
