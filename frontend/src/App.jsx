import { useState } from 'react';
import { Scale, Menu, X, LogIn } from 'lucide-react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useChat } from './hooks/useChat';
import Sidebar from './components/Sidebar/Sidebar';
import ChatWindow from './components/Chat/ChatWindow';
import AuthModal from './components/Auth/AuthModal';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '1008861057021-tuvpu1vq4drl4rfliui0gckpbgp5pgqv.apps.googleusercontent.com';

function AppContent() {
  const {
    messages,
    isLoading,
    sessionId,
    sessions,
    sendMessage,
    startNewChat,
    switchSession,
    deleteSession,
  } = useChat();

  const { isAuthModalOpen, setIsAuthModalOpen, user, isGuest } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-dark text-slate-100 overflow-hidden">
      {/* ── Mobile backdrop ──────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <div
        className={`
          fixed md:relative z-30 md:z-auto
          w-80 h-full flex-shrink-0
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <Sidebar
          sessions={sessions}
          activeSessionId={sessionId}
          onSelectSession={(id) => {
            switchSession(id);
            setSidebarOpen(false);
          }}
          onNewSession={() => {
            startNewChat();
            setSidebarOpen(false);
          }}
          onDeleteSession={deleteSession}
        />
      </div>

      {/* ── Main chat panel ───────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* Mobile header with sidebar toggle & sign in */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-dark-surface md:hidden flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-slate-400 hover:text-gold hover:bg-gold/10 transition-all"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-gold" />
              <span className="font-bold text-gold tracking-wider">SAUL</span>
            </div>
          </div>

          {(!user || isGuest) && (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gold/10 hover:bg-gold/20 text-gold text-xs font-semibold rounded-lg border border-gold/30 transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>

        {/* Chat window fills remaining height */}
        <div className="flex-1 min-h-0">
          <ChatWindow
            messages={messages}
            isLoading={isLoading}
            sendMessage={sendMessage}
            clearChat={startNewChat}
          />
        </div>
      </main>

      {/* Mobile sidebar close button (inside sidebar) */}
      {sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(false)}
          className="fixed top-4 right-4 z-40 p-2 rounded-full bg-dark-card border border-white/10 text-slate-400 hover:text-gold md:hidden"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Sign In / Sign Up Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
