/**
 * API Client for the Saul backend.
 * All requests are fetch-based (no axios dependency).
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Generic fetch wrapper with consistent error handling.
 * @param {string} path
 * @param {RequestInit} options
 * @returns {Promise<any>}
 */
async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errBody = await response.json();
      errorMessage = errBody.detail || errBody.message || errorMessage;
    } catch {
      // ignore JSON parse errors on error responses
    }
    throw new Error(errorMessage);
  }

  // Return null for 204 No Content
  if (response.status === 204) return null;

  return response.json();
}

export const api = {
  /**
   * Send a chat message to the backend.
   * @param {Array<{role: string, content: string}>} messages
   * @param {string} sessionId
   * @returns {Promise<{answer: string, sources: Array}>}
   */
  chat: async (messages, sessionId) => {
    return request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, session_id: sessionId }),
    });
  },

  /**
   * Upload a document to the knowledge base.
   * Supports upload progress via XMLHttpRequest.
   * @param {File} file
   * @param {(progress: number) => void} onProgress
   * @returns {Promise<{filename: string, chunks: number, message: string}>}
   */
  uploadDocument: async (file, onProgress) => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve({ message: 'Upload complete' });
          }
        } else {
          let errorMessage = `HTTP ${xhr.status}`;
          try {
            const errBody = JSON.parse(xhr.responseText);
            errorMessage = errBody.detail || errBody.message || errorMessage;
          } catch {
            // ignore
          }
          reject(new Error(errorMessage));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload aborted'));
      });

      xhr.open('POST', `${BASE_URL}/api/documents/upload`);
      xhr.send(formData);
    });
  },

  /**
   * Get all uploaded documents.
   * @returns {Promise<Array<{filename: string, chunks: number, size: number}>>}
   */
  getDocuments: async () => {
    return request('/api/documents');
  },

  /**
   * Delete a document from the knowledge base.
   * @param {string} filename
   * @returns {Promise<null>}
   */
  deleteDocument: async (filename) => {
    return request(`/api/documents/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': undefined }, // no body for DELETE
    });
  },

  /**
   * Check the API health status.
   * @returns {Promise<{status: string, version: string}>}
   */
  getHealth: async () => {
    return request('/api/health');
  },
};
