/**
 * useEcho.js - Hook principale JARVIS
 * Integra tutti i servizi: context, quick actions, notifiche, meteo, email, etc.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { envLoader } from '../services/EnvLoader';
import { callProvider } from '../services/LLMClient';
import { generateEchoPersonaPrompt, getRandomGreeting, getRandomThinking, getRandomError, getRandomHumor, getRandomProactive } from '../../persona-generator-develop';
import { speak as speakText, stopSpeech } from '../services/TTS';
import { conversationManager } from '../services/ConversationManager';
import { VoiceInput } from '../services/VoiceInput';
import { contextEngine } from '../services/ContextEngine';
import { quickActions } from '../services/QuickActions';
import { proactiveNotifications } from '../services/ProactiveNotifications';
import { weatherService } from '../services/WeatherService';
import { emailService } from '../services/EmailService';
import { deviceControlService } from '../services/DeviceControlService';
import { mapsService } from '../services/MapsService';
import { sentimentService } from '../services/SentimentService';
import { functionCallingService } from '../services/FunctionCallingService';
import { wakeWordService } from '../services/WakeWordService';
import { bargeInHandler } from '../services/BargeInHandler';
import { dailyBriefing } from '../services/DailyBriefing';

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
const SEG_BOUNDARY = /([.!?…]+["'")\]]?\s+|[:;,]\s+(?=\S{6,}))/;
function extractSegments(buffer) {
  const segments = [];
  let rest = buffer;
  while (true) {
    const m = rest.match(SEG_BOUNDARY);
    if (!m) break;
    const end = m.index + m[0].length;
    const chunk = rest.slice(0, end).trim();
    if (chunk) segments.push(chunk);
    rest = rest.slice(end);
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
  const [context, setContext] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [userName, setUserName] = useState(null);
  const [weather, setWeather] = useState(null);
  const [emails, setEmails] = useState([]);
  const [sentiment, setSentiment] = useState(null);
  const [wakeWordActive, setWakeWordActive] = useState(false);
  const busyRef = useRef(false);
  const proactiveTimerRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // Inizializza tutti i servizi
        await envLoader.init();
        await conversationManager.init();
        await contextEngine.init();
        await proactiveNotifications.init();
        await weatherService.init();
        await emailService.init();
        await deviceControlService.init();
        await mapsService.init();
        await sentimentService.init();
        await functionCallingService.init();
        await dailyBriefing.init();

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

        setContext(contextEngine.getFullContext());
        setMessages(conversationManager.getMessages());
        setVoiceAvailable(await VoiceInput.isAvailable());

        // Carica meteo iniziale
        const weatherResult = await weatherService.getCurrentWeather();
        if (weatherResult.success) {
          setWeather(weatherResult.data);
        }

        // Avvia notifiche proattive
        startProactiveNotifications();

        // Avvia barge-in handler
        await bargeInHandler.init({
          onBargeIn: async () => {
            await bargeInHandler.handleBargeIn();
            setStatus('listening');
          },
          onAudioLevel: (level) => setAudioLevel(level)
        });

      } catch (cause) {
        if (!mounted) {
          return;
        }
        setError(cause?.message || 'Impossibile inizializzare Echo.');
      }
    })();

    // Ascolta cambiamenti di contesto
    const unsubscribe = contextEngine.addListener((newContext) => {
      setContext(contextEngine.getFullContext());
    });

    return () => {
      mounted = false;
      unsubscribe();
      if (proactiveTimerRef.current) {
        clearInterval(proactiveTimerRef.current);
      }
      bargeInHandler.cleanup();
    };
  }, []);

  // Notifiche proattive
  const startProactiveNotifications = useCallback(() => {
    proactiveTimerRef.current = setInterval(async () => {
      const suggestion = contextEngine.getProactiveSuggestion();
      if (suggestion) {
        await proactiveNotifications.sendSuggestionNotification();
      }
    }, 30 * 60 * 1000); // 30 minuti
  }, []);

  const syncMessages = useCallback(() => {
    setMessages(conversationManager.getMessages());
  }, []);

  // Gestisci comandi rapidi
  const handleQuickCommand = useCallback(async (text) => {
    const command = quickActions.detectCommand(text);
    if (command) {
      setStatus('thinking');
      
      const result = await quickActions.executeCommand(command);
      
      if (result.success) {
        const response = `Perfetto! ${result.message}`;
        await conversationManager.addMessage({ role: 'assistant', content: response });
        syncMessages();
        speakText(response, { lang: config.lang });
        return true;
      }
    }
    return false;
  }, [config.lang, syncMessages]);

  // Gestisci function calling dal LLM
  const handleFunctionCalling = useCallback(async (text, services) => {
    // Analizza sentimento
    const sentimentResult = sentimentService.analyzeSentiment(text);
    setSentiment(sentimentResult);

    // Controlla se il testo contiene comandi che il LLM potrebbe voler eseguire
    const lowerText = text.toLowerCase();
    
    // Comandi meteo
    if (lowerText.includes('meteo') || lowerText.includes('tempo') || lowerText.includes('che tempo')) {
      const city = lowerText.replace(/.*(?:a|di|per|in)\s+/, '').trim() || null;
      const result = await functionCallingService.executeFunction('get_weather', { city }, services);
      if (result.success) {
        return result.briefing;
      }
    }

    // Comandi navigazione
    if (lowerText.includes('naviga') || lowerText.includes('portami') || lowerText.includes('vai a')) {
      const destination = lowerText.replace(/.*(?:a|per|in)\s+/, '').trim();
      if (destination) {
        const result = await functionCallingService.executeFunction('navigate_to', { destination }, services);
        if (result.success) {
          return result.action;
        }
      }
    }

    // Comandi email
    if (lowerText.includes('email') || lowerText.includes('mail') || lowerText.includes('posta')) {
      const result = await functionCallingService.executeFunction('get_emails', { unread_only: true }, services);
      if (result.success) {
        return result.briefing;
      }
    }

    // Comandi dispositivo
    if (lowerText.includes('luminosità') || lowerText.includes('schermo')) {
      if (lowerText.includes('alza') || lowerText.includes('aumenta')) {
        const result = await functionCallingService.executeFunction('control_device', { action: 'brightness_up' }, services);
        return result.success ? 'Luminosità aumentata' : result.error;
      }
      if (lowerText.includes('abbassa') || lowerText.includes('diminuisci')) {
        const result = await functionCallingService.executeFunction('control_device', { action: 'brightness_down' }, services);
        return result.success ? 'Luminosità diminuita' : result.error;
      }
    }

    return null;
  }, []);

  const sendText = useCallback(
    async (rawText) => {
      const text = String(rawText || '').trim();
      if (!text || busyRef.current) {
        return;
      }

      busyRef.current = true;
      setError('');

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

        if (!assistantAdded) {
          assistantAdded = true;
          conversationManager.addMessage({ role: 'assistant', content: fullText });
        } else {
          try {
            conversationManager.updateLastMessage?.({ role: 'assistant', content: fullText });
          } catch (_) {}
        }
        syncMessages();
        flushSegments(false);
      };

      try {
        await stopSpeech();
        await VoiceInput.stop();
        
        // Avvia barge-in monitoring
        await bargeInHandler.startMonitoring();
        
        // Registra interazione nel contesto
        await contextEngine.recordInteraction();
        
        await conversationManager.addMessage({ role: 'user', content: text });
        syncMessages();
        setInput('');
        setStatus('thinking');

        // Prova a gestire come comando rapido
        const isQuickCommand = await handleQuickCommand(text);
        if (isQuickCommand) {
          busyRef.current = false;
          await bargeInHandler.stopMonitoring();
          return;
        }

        // Prova function calling
        const services = {
          weatherService,
          emailService,
          deviceControlService,
          mapsService,
          quickActions
        };
        
        const functionResponse = await handleFunctionCalling(text, services);
        if (functionResponse) {
          await conversationManager.addMessage({ role: 'assistant', content: functionResponse });
          syncMessages();
          speakText(functionResponse, ttsCfg);
          busyRef.current = false;
          await bargeInHandler.stopMonitoring();
          return;
        }

        // Genera prompt con contesto JARVIS e sentimento
        const contextData = contextEngine.getFullContext();
        const sentimentContext = sentiment ? `\n\nStato emotivo utente: ${sentiment.label} (${sentiment.description})` : '';
        
        const systemPrompt = generateEchoPersonaPrompt({
          lastUserMessage: text,
          isCall: false,
          contextData,
          userName,
        }) + sentimentContext;

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

        if (!assistantAdded) {
          await conversationManager.addMessage({ role: 'assistant', content: reply });
        } else if (conversationManager.updateLastMessage) {
          try {
            conversationManager.updateLastMessage({ role: 'assistant', content: reply });
          } catch (_) {}
        }
        syncMessages();

        flushSegments(true);
      } catch (cause) {
        const message = cause?.message || 'Si è verificato un errore.';
        setError(message);
        setStatus('idle');
        await stopSpeech();
        
        const errorMessage = getRandomError();
        await conversationManager.addMessage({
          role: 'assistant',
          content: `${errorMessage} ${message}`,
        });
        syncMessages();
      } finally {
        busyRef.current = false;
        await bargeInHandler.stopMonitoring();
      }
    },
    [config, status, syncMessages, userName, handleQuickCommand, handleFunctionCalling, sentiment],
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

  // Saluta l'utente
  const greetUser = useCallback(async () => {
    const greeting = getRandomGreeting();
    await conversationManager.addMessage({ role: 'assistant', content: greeting });
    syncMessages();
    speakText(greeting, { lang: config.lang });
  }, [config.lang, syncMessages]);

  // Imposta nome utente
  const setUserNameCallback = useCallback((name) => {
    setUserName(name);
    contextEngine.updatePreference('userName', name);
  }, []);

  // Avvia wake word
  const startWakeWord = useCallback(async () => {
    const result = await wakeWordService.init({
      wakeWord: 'echo',
      language: config.lang,
      onWakeWord: () => {
        setWakeWordActive(true);
        startListening();
      }
    });
    
    if (result) {
      await wakeWordService.startListening();
      setWakeWordActive(true);
    }
  }, [config.lang, startListening]);

  // Ferma wake word
  const stopWakeWord = useCallback(async () => {
    await wakeWordService.stopListening();
    setWakeWordActive(false);
  }, []);

  // Ottieni briefing giornaliero
  const getDailyBriefing = useCallback(async () => {
    const briefing = await dailyBriefing.generateBriefing(
      'default',
      { name: userName || 'Utente' },
      {}
    );
    return briefing;
  }, [userName]);

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
    context,
    audioLevel,
    userName,
    setUserName: setUserNameCallback,
    greetUser,
    weather,
    emails,
    sentiment,
    wakeWordActive,
    startWakeWord,
    stopWakeWord,
    getDailyBriefing,
  };
}

export default useEcho;
