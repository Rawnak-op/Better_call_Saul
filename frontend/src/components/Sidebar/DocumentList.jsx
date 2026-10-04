import { useState } from 'react';
import { FileText, Trash2, BookOpen, Loader2 } from 'lucide-react';

/**
 * Get a display-friendly file extension label and icon color.
 */
function getFileStyle(filename) {
  if (!filename) return { label: 'FILE', color: 'text-slate-400 bg-slate-700/50' };
  const ext = filename.split('.').pop()?.toLowerCase();
  const map = {
    pdf: { label: 'PDF', color: 'text-red-400 bg-red-900/40' },
    docx: { label: 'DOCX', color: 'text-blue-400 bg-blue-900/40' },
    doc: { label: 'DOC', color: 'text-blue-400 bg-blue-900/40' },
    txt: { label: 'TXT', color: 'text-slate-300 bg-slate-700/50' },
    html: { label: 'HTML', color: 'text-orange-400 bg-orange-900/40' },
    htm: { label: 'HTML', color: 'text-orange-400 bg-orange-900/40' },
  };
  return map[ext] || { label: ext?.toUpperCase() || 'FILE', color: 'text-slate-400 bg-slate-700/50' };
}

/**
 * Format bytes to a human-readable size string.
 */
function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * DocumentList — shows uploaded documents with delete capability.
 *
 * Props:
 * - documents: array
 * - onDelete: fn(filename) => Promise<{success, message}>
 */
export default function DocumentList({ documents, onDelete }) {
  const [deletingFile, setDeletingFile] = useState(null);
  const [confirmFile, setConfirmFile] = useState(null);

  const handleDeleteClick = (filename) => {
    setConfirmFile(filename);
  };

  const handleConfirmDelete = async (filename) => {
    setConfirmFile(null);
    setDeletingFile(filename);
    await onDelete(filename);
    setDeletingFile(null);
  };

  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <BookOpen className="w-8 h-8 text-slate-600 mb-3" />
        <p className="text-sm text-slate-500">No documents uploaded yet</p>
        <p className="text-xs text-slate-600 mt-1">
          Upload legal documents above to power Saul's knowledge base.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {documents.map((doc) => {
        const { label, color } = getFileStyle(doc.filename);
        const isDeleting = deletingFile === doc.filename;
        const isConfirming = confirmFile === doc.filename;

        return (
          <li
            key={doc.filename}
            className="bg-dark-card/60 border border-white/5 rounded-xl p-3 flex items-start gap-3 group hover:border-white/10 transition-colors"
          >
            {/* File type badge */}
            <span
              className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${color} mt-0.5`}
            >
              {label}
            </span>

            {/* File info */}
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-medium text-slate-200 truncate"
                title={doc.filename}
              >
                {doc.filename}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {doc.chunks != null && (
                  <span className="text-[11px] text-slate-500">{doc.chunks} chunks</span>
                )}
                {doc.size != null && (
                  <span className="text-[11px] text-slate-600">{formatBytes(doc.size)}</span>
                )}
              </div>
            </div>

            {/* Delete / confirm area */}
            <div className="flex-shrink-0 flex items-center">
              {isDeleting ? (
                <Loader2 className="w-4 h-4 text-slate-500 animate-spin" />
              ) : isConfirming ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleConfirmDelete(doc.filename)}
                    className="text-[11px] px-2 py-0.5 rounded bg-red-800/70 hover:bg-red-700/70 text-red-300 font-medium transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmFile(null)}
                    className="text-[11px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleDeleteClick(doc.filename)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-900/40 text-slate-500 hover:text-red-400 transition-all"
                  title="Delete document"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
