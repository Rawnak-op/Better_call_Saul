import { Scale, RefreshCw, AlertTriangle } from 'lucide-react';
import DocumentUpload from '../Upload/DocumentUpload';
import DocumentList from './DocumentList';

/**
 * Sidebar — left panel with branding, upload, and knowledge base list.
 *
 * Props:
 * - documents: array
 * - isUploading: bool
 * - uploadProgress: number
 * - onUpload: fn(file)
 * - onDelete: fn(filename)
 * - onRefresh: fn()
 * - documentsError: string|null
 */
export default function Sidebar({
  documents,
  isUploading,
  uploadProgress,
  onUpload,
  onDelete,
  onRefresh,
  documentsError,
}) {
  return (
    <aside className="flex flex-col h-full bg-dark-surface border-r border-white/5 w-full overflow-hidden">
      {/* ── Branding ───────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center shadow-lg shadow-gold/10">
            <Scale className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h2 className="text-xl font-black text-gold tracking-widest leading-none">SAUL</h2>
            <p className="text-[11px] text-slate-400 mt-0.5 tracking-wide">LEGAL AI ASSISTANT</p>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {/* Upload section removed for public site security */}

        {/* Knowledge base section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Knowledge Base
              {documents.length > 0 && (
                <span className="ml-2 bg-gold/20 text-gold text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {documents.length}
                </span>
              )}
            </h3>
            <button
              onClick={onRefresh}
              className="p-1 rounded-lg text-slate-500 hover:text-gold hover:bg-gold/10 transition-all"
              title="Refresh document list"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {documentsError && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2 mb-3">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {documentsError}
            </div>
          )}

          <DocumentList documents={documents} onDelete={onDelete} />
        </section>
      </div>

      {/* ── Footer disclaimer ──────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-4 border-t border-white/5 bg-dark/30">
        <p className="text-[10px] text-slate-600 leading-relaxed text-center mb-2">
          ⚖️ For informational purposes only.
          <br />
          Not a substitute for professional legal advice.
        </p>
        <p className="text-[10px] text-slate-500/80 font-medium text-center">
          &copy; {new Date().getFullYear()} Rawnak Yadav
        </p>
      </div>
    </aside>
  );
}
