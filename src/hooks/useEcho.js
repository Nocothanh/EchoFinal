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
          { isCall: false },
        );

        await conversationManager.addMessage({ role: 'assistant', content: reply });
        syncMessages();
        setStatus('speaking');

        await speakText(
          reply,
          {
            elKey: config.elKey,
            elVoice: config.elVoice,
            lang: config.lang,
          },
          {
            onDone: () => setStatus('idle'),
          },
        );
      } catch (cause) {
        const message = cause?.message || 'Si è verificato un errore.';
        setError(message);
        setStatus('idle');
        await conversationManager.addMessage({
          role: 'assistant',
          content: 'Ho incontrato un errore. Riprova tra poco.',
        });
        syncMessages();
      } finally {
        busyRef.current = false;
      }
    },
    [config, syncMessages],
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
