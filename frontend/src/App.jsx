import { useState } from 'react';
import { Scale, Menu, X } from 'lucide-react';
import { useChat } from './hooks/useChat';
import { useDocuments } from './hooks/useDocuments';
import Sidebar from './components/Sidebar/Sidebar';
import ChatWindow from './components/Chat/ChatWindow';

export default function App() {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const {
    documents,
    isUploading,
    uploadProgress,
    error: documentsError,
    uploadDocument,
    deleteDocument,
    fetchDocuments,
  } = useDocuments();

  // Mobile sidebar toggle
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
          documents={documents}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          onUpload={uploadDocument}
          onDelete={deleteDocument}
          onRefresh={fetchDocuments}
          documentsError={documentsError}
        />
      </div>

      {/* ── Main chat panel ───────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* Mobile header with sidebar toggle */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-dark-surface md:hidden flex-shrink-0">
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

        {/* Chat window fills remaining height */}
        <div className="flex-1 min-h-0">
          <ChatWindow
            messages={messages}
            isLoading={isLoading}
            sendMessage={sendMessage}
            clearChat={clearChat}
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
    </div>
  );
}
