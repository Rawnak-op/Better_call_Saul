import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client';

/**
 * useVoice — hook providing both Speech-to-Text (Microphone input)
 * and Text-to-Speech (Saul voice playback with streaming & caching).
 */
export function useVoice() {
  // ── Speech-to-Text (Voice input) ──────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  // ── Text-to-Speech (Voice playback) ───────────────────────────────
  const [speakingId, setSpeakingId] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);
  const audioCache = useRef(new Map());

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(Boolean(SpeechRecognition));

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  /**
   * Start listening to user voice and streaming text into callback.
   */
  const startListening = useCallback((onResult, onError) => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (onError) onError('Speech recognition is not supported in this browser.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (onResult) {
          onResult(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (onError && event.error !== 'no-speech') {
          onError(event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
      if (onError) onError(err.message || 'Microphone access failed');
    }
  }, []);

  /**
   * Stop listening to user voice.
   */
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }
  }, []);

  /**
   * Stop speaking any active audio.
   */
  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingId(null);
    setLoadingId(null);
    setIsSpeaking(false);
  }, []);

  /**
   * Fallback browser SpeechSynthesis if backend audio is unavailable.
   */
  const fallbackSpeechSynthesis = useCallback((text, messageId) => {
    if (!('speechSynthesis' in window)) {
      setSpeakingId(null);
      setLoadingId(null);
      setIsSpeaking(false);
      return;
    }

    const cleanText = text
      .replace(/[*#_`~>[\]]/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/---+/g, '')
      .replace(/\n+/g, '. ')
      .trim();

    if (!cleanText) {
      setSpeakingId(null);
      setLoadingId(null);
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice =
      voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') ||
            v.name.includes('Guy') ||
            v.name.includes('Male') ||
            v.name.includes('David') ||
            v.name.includes('Google US English'))
      ) || voices.find((v) => v.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setLoadingId(null);
      setSpeakingId(messageId);
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setSpeakingId(null);
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setSpeakingId(null);
      setLoadingId(null);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  /**
   * Play Saul's answer aloud with Saul Goodman neural audio stream.
   */
  const speak = useCallback(
    async (text, messageId) => {
      // Toggle stop if already playing or loading this message
      if (speakingId === messageId || loadingId === messageId) {
        stopSpeaking();
        return;
      }

      stopSpeaking();

      // Check client-side audio cache for instantaneous replay (0ms delay)
      if (audioCache.current.has(messageId)) {
        const cachedUrl = audioCache.current.get(messageId);
        const audio = new Audio(cachedUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setSpeakingId(null);
          setIsSpeaking(false);
          audioRef.current = null;
        };

        setSpeakingId(messageId);
        setIsSpeaking(true);
        audio.play().catch(() => {});
        return;
      }

      // Show immediate loading indicator on the button
      setLoadingId(messageId);

      try {
        // Fetch neural audio from backend
        const audioBlob = await api.tts(text);
        const audioUrl = URL.createObjectURL(audioBlob);
        audioCache.current.set(messageId, audioUrl);

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setSpeakingId(null);
          setIsSpeaking(false);
          audioRef.current = null;
        };

        audio.onerror = () => {
          setLoadingId(null);
          fallbackSpeechSynthesis(text, messageId);
        };

        // When the sound actually begins playing, switch state to speaking
        audio.onplay = () => {
          setLoadingId(null);
          setSpeakingId(messageId);
          setIsSpeaking(true);
        };

        await audio.play();
      } catch (err) {
        console.warn('Backend TTS audio fetch failed, falling back to browser speech:', err);
        setLoadingId(null);
        fallbackSpeechSynthesis(text, messageId);
      }
    },
    [speakingId, loadingId, stopSpeaking, fallbackSpeechSynthesis]
  );

  return {
    isListening,
    speechSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    speakingId,
    loadingId,
    isSpeaking,
  };
}
