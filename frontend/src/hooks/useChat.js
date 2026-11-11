import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { api } from '../api/client';

const SESSIONS_STORAGE_KEY = 'saul_recent_sessions';
const ACTIVE_SESSION_KEY = 'saul_active_session_id';

/**
 * Helper to load all stored sessions from localStorage.
 */
function loadStoredSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to load stored sessions:', e);
    return [];
  }
}

/**
 * Helper to save sessions to localStorage.
 */
function saveStoredSessions(sessions) {
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.warn('Failed to save sessions:', e);
  }
}

export function useChat() {
  const [sessions, setSessions] = useState(() => loadStoredSessions());
  const [activeSessionId, setActiveSessionId] = useState(() => {
    return localStorage.getItem(ACTIVE_SESSION_KEY) || uuidv4();
  });
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Sync activeSessionId with localStorage
  useEffect(() => {
    localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
  }, [activeSessionId]);

  // When active session changes, load its messages
  useEffect(() => {
    const current = sessions.find((s) => s.id === activeSessionId);
    if (current && Array.isArray(current.messages)) {
      setMessages(current.messages);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  // Persist messages of active session whenever messages change
  const persistSessionMessages = useCallback((newMessages, explicitSessionId) => {
    const targetId = explicitSessionId || activeSessionId;
    setSessions((prev) => {
      const existingIndex = prev.findIndex((s) => s.id === targetId);
      const firstUserMsg = newMessages.find((m) => m.role === 'user');
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 32).trim() + (firstUserMsg.content.length > 32 ? '...' : '')
        : 'New Legal Query';

      let updated;
      if (existingIndex >= 0) {
        updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          title: updated[existingIndex].title === 'New Legal Query' ? title : updated[existingIndex].title,
          messages: newMessages,
          updatedAt: new Date().toISOString(),
        };
      } else {
        updated = [
          {
            id: targetId,
            title,
            messages: newMessages,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...prev,
        ];
      }
      saveStoredSessions(updated);
      return updated;
    });
  }, [activeSessionId]);

  /**
   * Start a brand new conversation session.
   */
  const startNewChat = useCallback(() => {
    const newId = uuidv4();
    setActiveSessionId(newId);
    setMessages([]);
    setIsLoading(false);
  }, []);

  /**
   * Switch to an existing past conversation.
   */
  const switchSession = useCallback((sessionId) => {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    setIsLoading(false);
  }, [activeSessionId]);

  /**
   * Delete an existing conversation session.
   */
  const deleteSession = useCallback((sessionId) => {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      saveStoredSessions(filtered);
      return filtered;
    });

    if (sessionId === activeSessionId) {
      const newId = uuidv4();
      setActiveSessionId(newId);
      setMessages([]);
    }
  }, [activeSessionId]);

  /**
   * Send a user message and fetch Saul's response.
   * Supports optional base64 image proof attachment.
   */
  const sendMessage = useCallback(
    async (content, image = null) => {
      if ((!content.trim() && !image) || isLoading) return;

      const userMessage = {
        id: uuidv4(),
        role: 'user',
        content: content.trim(),
        image: image || null,
        sources: [],
        timestamp: new Date(),
        error: false,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setIsLoading(true);
      persistSessionMessages(updatedMessages, activeSessionId);

      try {
        // Build the history payload for the API
        const history = updatedMessages
          .filter((m) => !m.error)
          .map(({ role, content, image }) => ({
            role,
            content,
            image: image || undefined,
          }));

        const data = await api.chat(history, activeSessionId);

        const assistantMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: data.answer || data.content || 'I could not generate a response.',
          sources: data.sources || [],
          timestamp: new Date(),
          error: false,
        };

        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);
        persistSessionMessages(finalMessages, activeSessionId);
      } catch (err) {
        const errorMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: `⚠️ **Connection error:** ${err.message}\n\nPlease ensure the Saul backend is running at the configured API URL.`,
          sources: [],
          timestamp: new Date(),
          error: true,
        };
        const errorMessages = [...updatedMessages, errorMessage];
        setMessages(errorMessages);
        persistSessionMessages(errorMessages, activeSessionId);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, activeSessionId, persistSessionMessages]
  );

  return {
    messages,
    isLoading,
    sessionId: activeSessionId,
    sessions,
    sendMessage,
    startNewChat,
    switchSession,
    deleteSession,
    clearChat: startNewChat,
  };
}
