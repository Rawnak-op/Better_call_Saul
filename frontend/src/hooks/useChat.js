import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { api } from '../api/client';

/**
 * useChat — manages all chat state and interactions.
 *
 * Messages shape:
 * {
 *   id: string,         // uuid
 *   role: 'user' | 'assistant',
 *   content: string,
 *   sources: Array,     // source citations from the backend
 *   timestamp: Date,
 *   error: boolean,     // true if the message is an error notice
 * }
 */
export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Stable session ID for the lifetime of the hook instance
  const sessionId = useRef(uuidv4()).current;

  /**
   * Append a message to the messages array.
   */
  const addMessage = useCallback((message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  /**
   * Send a user message and fetch Saul's response.
   * @param {string} content — the raw user text
   */
  const sendMessage = useCallback(
    async (content) => {
      if (!content.trim() || isLoading) return;

      const userMessage = {
        id: uuidv4(),
        role: 'user',
        content: content.trim(),
        sources: [],
        timestamp: new Date(),
        error: false,
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        // Build the history payload for the API (exclude error messages)
        const history = [...messages, userMessage]
          .filter((m) => !m.error)
          .map(({ role, content }) => ({ role, content }));

        const data = await api.chat(history, sessionId);

        const assistantMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: data.answer || data.content || 'I could not generate a response.',
          sources: data.sources || [],
          timestamp: new Date(),
          error: false,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const errorMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: `⚠️ **Connection error:** ${err.message}\n\nPlease ensure the Saul backend is running at the configured API URL.`,
          sources: [],
          timestamp: new Date(),
          error: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, sessionId]
  );

  /**
   * Reset the conversation to its initial state.
   */
  const clearChat = useCallback(() => {
    setMessages([]);
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    sessionId,
    sendMessage,
    clearChat,
  };
}
