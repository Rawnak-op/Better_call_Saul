import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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

  const { isAuthModalOpen, setIsAuthModalOpen } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Silently pre-warm the backend container the moment the user opens the page
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    fetch(`${apiUrl}/`, { method: 'GET' }).catch(() => {});
  }, []);

  const handleSelectPlaybook = (prompt) => {
    sendMessage(prompt);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen h-[100dvh] bg-dark text-slate-100 overflow-hidden">
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
          onSelectPlaybook={handleSelectPlaybook}
        />
      </div>

      {/* ── Main chat panel ───────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* Chat window fills full height */}
        <div className="flex-1 min-h-0">
          <ChatWindow
            messages={messages}
            isLoading={isLoading}
            sendMessage={sendMessage}
            clearChat={startNewChat}
            onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
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
