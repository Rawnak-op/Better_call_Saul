import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
  'text/plain': ['.txt'],
  'text/html': ['.html', '.htm'],
};

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * Toast — simple ephemeral notification.
 */
function Toast({ toast }) {
  if (!toast) return null;
  const isSuccess = toast.type === 'success';
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium mt-2 ${
        isSuccess
          ? 'bg-emerald-900/50 border border-emerald-700/50 text-emerald-300'
          : 'bg-red-900/50 border border-red-700/50 text-red-300'
      }`}
    >
      {isSuccess ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {toast.message}
    </div>
  );
}

/**
 * DocumentUpload — drag-and-drop upload zone.
 *
 * Props:
 * - onUpload: fn(file) => Promise<{success, message}>
 * - isUploading: bool
 * - uploadProgress: number (0-100)
 */
export default function DocumentUpload({ onUpload, isUploading, uploadProgress }) {
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const onDrop = useCallback(
    async (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        const reason = rejectedFiles[0]?.errors?.[0]?.message || 'Invalid file.';
        showToast('error', reason);
        return;
      }

      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      const result = await onUpload(file);
      if (result.success) {
        showToast('success', result.message || `"${file.name}" uploaded successfully.`);
      } else {
        showToast('error', result.message || 'Upload failed.');
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
    maxFiles: 1,
    disabled: isUploading,
    multiple: false,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all
          ${isUploading ? 'opacity-60 cursor-not-allowed' : ''}
          ${
            isDragReject
              ? 'border-red-500/60 bg-red-900/10'
              : isDragActive
              ? 'border-gold/70 bg-gold/5 scale-[1.01]'
              : 'border-white/10 hover:border-gold/40 hover:bg-gold/5'
          }
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-2">
          {isUploading ? (
            <Loader2 className="w-7 h-7 text-gold animate-spin" />
          ) : isDragReject ? (
            <XCircle className="w-7 h-7 text-red-400" />
          ) : isDragActive ? (
            <Upload className="w-7 h-7 text-gold animate-bounce" />
          ) : (
            <Upload className="w-7 h-7 text-slate-500" />
          )}

          <div>
            {isUploading ? (
              <p className="text-xs text-slate-400">
                Uploading… {uploadProgress > 0 ? `${uploadProgress}%` : ''}
              </p>
            ) : isDragReject ? (
              <p className="text-xs text-red-400 font-medium">File type not supported</p>
            ) : isDragActive ? (
              <p className="text-xs text-gold font-medium">Drop to upload</p>
            ) : (
              <>
                <p className="text-xs text-slate-400">
                  <span className="text-gold font-medium">Click to browse</span> or drag &amp; drop
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">PDF, DOCX, TXT, HTML · Max 50 MB</p>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {isUploading && (
          <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl bg-white/5 overflow-hidden">
            <div
              className="h-full bg-gold transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Supported file icons legend */}
      {!isUploading && (
        <div className="flex items-center justify-center gap-3 mt-2">
          {[
            { label: 'PDF', color: 'text-red-400' },
            { label: 'DOCX', color: 'text-blue-400' },
            { label: 'TXT', color: 'text-slate-400' },
            { label: 'HTML', color: 'text-orange-400' },
          ].map(({ label, color }) => (
            <span key={label} className={`flex items-center gap-1 text-[11px] font-medium ${color}`}>
              <File className="w-3 h-3" />
              {label}
            </span>
          ))}
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
