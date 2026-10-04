import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';

/**
 * useDocuments — manages document upload and listing state.
 *
 * Document shape from API:
 * {
 *   filename: string,
 *   chunks: number,
 *   size: number,   // bytes
 * }
 */
export function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  /**
   * Load documents from the backend.
   */
  const fetchDocuments = useCallback(async () => {
    try {
      const data = await api.getDocuments();
      // Accept both {documents: [...]} and plain array
      setDocuments(Array.isArray(data) ? data : (data?.documents ?? []));
      setError(null);
    } catch (err) {
      // Silently fail on initial load if backend isn't up yet
      console.warn('Could not fetch documents:', err.message);
      setDocuments([]);
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  /**
   * Upload a file to the knowledge base.
   * @param {File} file
   * @returns {Promise<{success: boolean, message: string}>}
   */
  const uploadDocument = useCallback(
    async (file) => {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        const result = await api.uploadDocument(file, (progress) => {
          setUploadProgress(progress);
        });
        await fetchDocuments();
        return { success: true, message: result?.message || 'Document uploaded successfully.' };
      } catch (err) {
        const message = err.message || 'Upload failed.';
        setError(message);
        return { success: false, message };
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    [fetchDocuments]
  );

  /**
   * Delete a document from the knowledge base.
   * @param {string} filename
   * @returns {Promise<{success: boolean, message: string}>}
   */
  const deleteDocument = useCallback(
    async (filename) => {
      setError(null);
      try {
        await api.deleteDocument(filename);
        await fetchDocuments();
        return { success: true, message: 'Document deleted.' };
      } catch (err) {
        const message = err.message || 'Delete failed.';
        setError(message);
        return { success: false, message };
      }
    },
    [fetchDocuments]
  );

  return {
    documents,
    isUploading,
    uploadProgress,
    error,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
  };
}
