import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { envLoader } from '../services/EnvLoader';
import { callProvider } from '../services/LLMClient';
import { generateEchoPersonaPrompt } from '../../persona-generator-develop';
import { speak as speakText, stopSpeech } from '../services/TTS';
import { conversationManager } from '../services/ConversationManager';
import { VoiceInput } from '../services/VoiceInput';

const DEFAULT_CONFIG = {
  provider: 'groq',
  apiKey: '',
  model: 'llama-3.3-70b-versatile',
  elKey: '',
  elVoice: '',
  lang: 'it-IT',
};

// Split streamed text into speech-friendly segments at sentence/clause
// boundaries. Returns { segments, rest }.
const SEG_BOUNDARY = /([.!?…]+["'”)\]]?\s+|[:;,]\s+(?=\S{6,}))/;
function extractSegments(buffer) {
  const segments = [];
  let rest = buffer;
  // Simple loop: peel off matches from the start.
  while (true) {
    const m = rest.match(SEG_BOUNDARY);
    if (!m) break;
    const end = m.index + m[0].length;
    const chunk = rest.slice(0, end).trim();
    if (chunk) segments.push(chunk);
    rest = rest.slice(end);
    // Only flush on strong (sentence) boundaries eagerly; keep short clauses
    // buffered unless they've grown long.
    if (!/[.!?…]/.test(m[0]) && rest.length < 40) break;
  }
  return { segments, rest };
}

export function useEcho() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('idle');
  const [input, setInput] = useState('');
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const busyRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await envLoader.init();
        await conversationManager.init();

        if (!mounted) {
          return;
        }

        setConfig({
          provider: 'groq',
          apiKey: envLoader.get('groq.apiKey') || '',
          model: envLoader.get('groq.model') || DEFAULT_CONFIG.model,
          elKey: envLoader.get('elevenlabs.apiKey') || '',
          elVoice: envLoader.get('elevenlabs.voiceId') || '',
          lang: 'it-IT',
        });

        setMessages(conversationManager.getMessages());
        setVoiceAvailable(await VoiceInput.isAvailable());
      } catch (cause) {
        if (!mounted) {
          return;
        }
        setError(cause?.message || 'Impossibile inizializzare Echo.');
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const syncMessages = useCallback(() => {
    setMessages(conversationManager.getMessages());
  }, []);

  const sendText = useCallback(
    async (rawText) => {
      const text = String(rawText || '').trim();
      if (!text || busyRef.current) {
        return;
      }

      busyRef.current = true;
      setError('');

      // Streamed assistant message state.
      let streamBuffer = '';
      let fullText = '';
      let assistantAdded = false;

      const ttsCfg = {
        elKey: config.elKey,
        elVoice: config.elVoice,
        lang: config.lang,
      };

      const flushSegments = (force = false) => {
        const { segments, rest } = extractSegments(streamBuffer);
        for (const seg of segments) {
          if (status !== 'speaking') setStatus('speaking');
          speakText(seg, ttsCfg, {
            onDone: () => setStatus('idle'),
          });
        }
        streamBuffer = force ? '' : rest;
        if (force && rest.trim()) {
          setStatus('speaking');
          speakText(rest.trim(), ttsCfg, { onDone: () => setStatus('idle') });
        }
      };

      const onChunk = (delta) => {
        if (!delta) return;
        fullText += delta;
        streamBuffer += delta;

        // Update / insert the in-progress assistant message in the chat log.
        if (!assistantAdded) {
          assistantAdded = true;
          conversationManager.addMessage({ role: 'assistant', content: fullText });
        } else {
          try {
            conversationManager.updateLastMessage?.({ role: 'assistant', content: fullText });
          } catch (_) {
            /* fallback below */
          }
        }
        syncMessages();

        flushSegments(false);
      };

      try {
        await stopSpeech();
        await VoiceInput.stop();
        await conversationManager.addMessage({ role: 'user', content: text });
        syncMessages();
        setInput('');
        setStatus('thinking');

        const systemPrompt = generateEchoPersonaPrompt({
          lastUserMessage: text,
          isCall: false,
        });

        const contextMessages = conversationManager.getContextMessages(12);
        const reply = await callProvider(
          {
            provider: config.provider || 'groq',
            apiKey: config.apiKey,
            model: config.model,
            systemPrompt,
          },
          contextMessages,
          { isCall: false, stream: true, onChunk },
        );

        // Ensure the final message reflects the fully-sanitized reply.
        if (!assistantAdded) {
          await conversationManager.addMessage({ role: 'assistant', content: reply });
        } else if (conversationManager.updateLastMessage) {
          try {
            conversationManager.updateLastMessage({ role: 'assistant', content: reply });
          } catch (_) {}
        }
        syncMessages();

        // Flush any trailing buffered text as a final segment.
        flushSegments(true);
      } catch (cause) {
        const message = cause?.message || 'Si è verificato un errore.';
        setError(message);
        setStatus('idle');
        await stopSpeech();
        await conversationManager.addMessage({
          role: 'assistant',
          content: 'Ho incontrato un errore. Riprova tra poco.',
        });
        syncMessages();
      } finally {
        busyRef.current = false;
      }
    },
    [config, status, syncMessages],
  );

  const startListening = useCallback(async () => {
    if (busyRef.current || status === 'speaking') {
      return;
    }

    setError('');
    const granted = await VoiceInput.requestPermissions();
    if (granted && granted.granted === false) {
      setError('Permesso microfono non concesso.');
      return;
    }

    const started = await VoiceInput.start({
      lang: config.lang,
      onPartial: (partial) => {
        setInput(partial);
      },
      onResult: (finalText) => {
        setInput('');
        sendText(finalText);
      },
      onError: (voiceError) => {
        setError(voiceError?.message || 'Errore nel riconoscimento vocale.');
        setStatus('idle');
      },
    });

    if (started) {
      setStatus('listening');
    }
  }, [config.lang, sendText, status]);

  const stopListening = useCallback(async () => {
    await VoiceInput.stop();
    if (status === 'listening') {
      setStatus('idle');
    }
  }, [status]);

  const sendFromInput = useCallback(() => {
    sendText(input);
  }, [input, sendText]);

  const isDisabled = useMemo(() => status === 'thinking' || status === 'speaking', [status]);
  const isThinking = status === 'thinking';
  const isListening = status === 'listening';
  const isSpeaking = status === 'speaking';

  return {
    messages,
    input,
    setInput,
    status,
    isThinking,
    isListening,
    isSpeaking,
    voiceAvailable,
    error,
    isDisabled,
    sendText,
    sendFromInput,
    startListening,
    stopListening,
  };
}

export default useEcho;
