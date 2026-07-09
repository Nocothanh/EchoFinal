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
import { notificationTriage } from '../services/NotificationTriage';
import { webSearchService } from '../services/WebSearchService';
import { deepLinkService } from '../services/DeepLinkService';
import { wellnessService } from '../services/WellnessService';
import { mcpBridge } from '../services/MCPBridge';
import { intentClassifier } from '../services/IntentClassifier';
import { timerService } from '../services/TimerService';
import { alarmService } from '../services/AlarmService';
import { calendarService } from '../services/CalendarService';
import { smsService } from '../services/SMSService';
import { reminderService } from '../services/ReminderService';
import { translationService } from '../services/TranslationService';
import { clipboardService } from '../services/ClipboardService';
import { calculatorService } from '../services/CalculatorService';
import { musicControlService } from '../services/MusicControlService';
import { contactsService } from '../services/ContactsService';
import { screenshotService } from '../services/ScreenshotService';

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
        await timerService.init();
        await alarmService.init();
        await calendarService.init();
        await smsService.init();
        await reminderService.init();
        await translationService.init();
        await clipboardService.init();
        await calculatorService.init();
        await musicControlService.init();
        await contactsService.init();
        await screenshotService.init();

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

    // Intent classification on-device
    const classification = intentClassifier.classify(text);
    if (classification && !classification.needsLLM && intentClassifier.canHandleLocally(classification.intent)) {
      const localResult = await handleLocalIntent(classification, text);
      if (localResult) return localResult;
    }

    // Deep links (play/search in apps)
    const deepCmd = deepLinkService.parseCommand(text);
    if (deepCmd) {
      const deepResult = await deepLinkService.execute(deepCmd);
      if (deepResult.success) return deepResult.message;
    }

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

    // Notifiche - riepilogo
    if (lowerText.includes('notifiche') || lowerText.includes('notifications') || lowerText.includes('what did i miss') || lowerText.includes('che ho perso')) {
      return notificationTriage.generateDigestSummary(24);
    }

    // Codice 2FA
    if (lowerText.includes('2fa') || lowerText.includes('codice') || lowerText.includes('code') || lowerText.includes('otp')) {
      const code = notificationTriage.getLatest2FACode();
      if (code) {
        return `Il codice 2FA più recente è ${code.code} da ${code.from}`;
      }
      return 'Non ho trovato codici 2FA recenti nelle notifiche.';
    }

    // Web search
    if (lowerText.includes('cerca') || lowerText.includes('search') || lowerText.includes('google') || lowerText.includes('trova')) {
      const query = lowerText
        .replace(/cerca|search|google|trova|su|on|in|per|me|mi/g, '')
        .trim();
      if (query.length > 2) {
        const result = await webSearchService.search(query);
        if (result.success) {
          return webSearchService.formatSearchResults(result);
        }
      }
    }

    // Wellness
    if (lowerText.includes('respira') || lowerText.includes('breath') || lowerText.includes('medita') || lowerText.includes('calma')) {
      const pattern = lowerText.includes('box') ? 'box' : '4-7-8';
      const result = await wellnessService.startBreathing(pattern, 5);
      if (result.success) return result.message;
    }

    if (lowerText.includes('pioggia') || lowerText.includes('rain') || lowerText.includes('oceano') || lowerText.includes('ocean') || lowerText.includes('suono') || lowerText.includes('ambient')) {
      let soundId = 'rain';
      if (lowerText.includes('oceano') || lowerText.includes('ocean')) soundId = 'ocean';
      else if (lowerText.includes('foresta') || lowerText.includes('forest')) soundId = 'forest';
      else if (lowerText.includes('fuoco') || lowerText.includes('fire')) soundId = 'fire';
      else if (lowerText.includes('notte') || lowerText.includes('night')) soundId = 'night';
      const result = await wellnessService.playAmbientSound(soundId);
      if (result.success) return result.message;
    }

    if (lowerText.includes('ferma suono') || lowerText.includes('stop sound') || lowerText.includes('basta')) {
      const result = await wellnessService.stopAmbientSound();
      return result.message;
    }

    // Timer commands
    if (lowerText.includes('timer') || lowerText.includes('countdown') || lowerText.includes('cronometro')) {
      const duration = timerService.parseNaturalDuration(lowerText);
      if (duration > 0) {
        const result = timerService.createTimer('Timer vocale', duration);
        if (result.success) {
          timerService.startTimer(result.timer.id);
          return `Timer avviato per ${Math.floor(duration / 60)} minuti e ${duration % 60} secondi.`;
        }
      }
    }

    // Alarm commands
    if (lowerText.includes('sveglia') || lowerText.includes('alarm')) {
      const parsed = alarmService.parseNaturalAlarm(lowerText);
      if (parsed) {
        const result = await alarmService.setAlarmIn('Sveglia voce', parsed.hour * 60 + parsed.minute);
        if (result.success) return `Sveglia impostata per le ${parsed.hour}:${String(parsed.minute).padStart(2, '0')}`;
      }
    }

    // Calendar commands
    if (lowerText.includes('calendario') || lowerText.includes('agenda') || lowerText.includes('impegni') || lowerText.includes('eventi')) {
      const events = await calendarService.getTodayEvents();
      if (events.length > 0) {
        return calendarService.generateAgendaSummary(events);
      }
      return 'Nessun evento oggi nella tua agenda.';
    }

    // SMS commands
    if (lowerText.includes('sms') || lowerText.includes('messaggio') || lowerText.includes('mex')) {
      const parsed = smsService.parseNaturalSMS(lowerText);
      if (parsed.phone && parsed.message) {
        const result = await smsService.sendSMS(parsed.phone, parsed.message);
        if (result.success) return `SMS inviato a ${parsed.phone}!`;
        return `Errore nell'invio SMS: ${result.error}`;
      }
    }

    // Music control
    if (lowerText.includes('play') || lowerText.includes('riproduci') || lowerText.includes('metti su') || lowerText.includes('ascolta')) {
      const cmd = musicControlService.parseMusicCommand(lowerText);
      if (cmd) {
        if (cmd.command === 'next') { await musicControlService.nextTrack(); return 'Prossima canzone!'; }
        if (cmd.command === 'previous') { await musicControlService.previousTrack(); return 'Canzone precedente!'; }
        if (cmd.command === 'pause') { await musicControlService.pause(); return 'Pausa!'; }
        if (cmd.command === 'play' && cmd.query) {
          await musicControlService.playInSpotify(cmd.query);
          return `Riproduco "${cmd.query}" su Spotify.`;
        }
      }
    }

    // Translation
    if (lowerText.includes('traduci') || lowerText.includes('translate') || lowerText.includes('come si dice')) {
      const parsed = translationService.parseTranslationCommand(lowerText);
      if (parsed) {
        const result = await translationService.translate(parsed.text, parsed.targetLang);
        if (result.success) return `${parsed.text} → ${result.translation}`;
      }
    }

    // Calculator
    if (lowerText.includes('calcola') || lowerText.includes('calculate') || lowerText.includes('quanto fa')) {
      const expr = lowerText.replace(/(?:calcola|calculate|quanto.fa|what.is|quanto.e)\s*/i, '');
      const result = calculatorService.parseAndConvert(expr);
      if (result.success) return `Risultato: ${result.result}`;
    }

    // Clipboard
    if (lowerText.includes('clipboard') || lowerText.includes('incolla') || lowerText.includes('paste')) {
      const result = await clipboardService.paste();
      return result.success ? `Nella clipboard: "${result.text}"` : 'La clipboard è vuota.';
    }

    return null;
  }, []);

  // Gestisci comandi locali senza LLM
  const handleLocalIntent = async (classification, text) => {
    const { intent, entities, action } = classification;

    switch (intent) {
      case 'DEVICE_CONTROL': {
        const device = entities.device || action;
        if (device === 'flashlight' || device === 'torcia') {
          const result = await quickActions.toggleFlashlight();
          return result.success ? 'Torcia accesa/spegnita' : result.error;
        }
        if (device === 'volume') {
          if (text.toLowerCase().includes('alza') || text.toLowerCase().includes('up') || text.toLowerCase().includes('high')) {
            const result = await functionCallingService.executeFunction('control_device', { action: 'volume_up' }, {});
            return result.success ? 'Volume aumentato' : result.error;
          }
          if (text.toLowerCase().includes('abbassa') || text.toLowerCase().includes('down') || text.toLowerCase().includes('low')) {
            const result = await functionCallingService.executeFunction('control_device', { action: 'volume_down' }, {});
            return result.success ? 'Volume diminuito' : result.error;
          }
        }
        if (device === 'luminosita' || device === 'brightness' || device === 'schermo') {
          if (text.includes('alza') || text.includes('up')) {
            const result = await functionCallingService.executeFunction('control_device', { action: 'brightness_up' }, {});
            return result.success ? 'Luminosità aumentata' : result.error;
          }
          if (text.includes('abbassa') || text.includes('down')) {
            const result = await functionCallingService.executeFunction('control_device', { action: 'brightness_down' }, {});
            return result.success ? 'Luminosità diminuita' : result.error;
          }
        }
        break;
      }
      case 'TIME': {
        const now = new Date();
        return `Sono le ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      }
      case 'DATE': {
        const now = new Date();
        const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
        return `Oggi è ${days[now.getDay()]} ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
      }
      case 'ALARM':
      case 'TIMER': {
        const parsed = timerService.parseNaturalDuration(text);
        if (intent === 'TIMER' && parsed > 0) {
          const name = text.replace(/.*(?:timer|countdown|cronometro)\s*/i, '').trim() || 'Timer';
          const result = timerService.createTimer(name, parsed);
          if (result.success) {
            timerService.startTimer(result.timer.id);
            return `Timer impostato per ${Math.floor(parsed / 60)} minuti e ${parsed % 60} secondi. Avviato!`;
          }
        }
        if (intent === 'ALARM') {
          const parsedAlarm = alarmService.parseNaturalAlarm(text);
          if (parsedAlarm) {
            const result = await alarmService.setAlarmIn(`Sveglia voce`, parsedAlarm.hour * 60 + parsedAlarm.minute);
            if (result.success) return `Sveglia impostata per le ${parsedAlarm.hour}:${String(parsedAlarm.minute).padStart(2, '0')}`;
          }
        }
        return `Puoi dirmi: "timer per 5 minuti" oppure "sveglia alle 7".`;
      }
      case 'TRANSLATION': {
        const parsed = translationService.parseTranslationCommand(text);
        if (parsed) {
          const result = await translationService.translate(parsed.text, parsed.targetLang);
          if (result.success) return `${parsed.text} → ${result.translation}`;
        }
        return `Puoi dirmi: "traduci ciao in inglese" o "translate buongiorno in english".`;
      }
      case 'CALCULATOR': {
        const result = calculatorService.parseAndConvert(text);
        if (result.success) return `Risultato: ${result.result}`;
        return `Puoi dirmi: "calcola 2 + 2" o "100 km in miglia".`;
      }
      case 'CLIPBOARD': {
        const lower = text.toLowerCase();
        if (lower.includes('incolla') || lower.includes('paste') || lower.includes('cosa c')) {
          const result = await clipboardService.paste();
          return result.success ? `Nella clipboard: "${result.text}"` : 'La clipboard è vuota.';
        }
        if (lower.includes('codice') || lower.includes('otp') || lower.includes('2fa')) {
          const result = await clipboardService.readOTP();
          return result.success ? `Codice OTP: ${result.code}` : 'Nessun codice OTP nella clipboard.';
        }
        const copyMatch = lower.match(/(?:copia|copy)\s+(.+)/);
        if (copyMatch) {
          await clipboardService.copy(copyMatch[1]);
          return `Copiato: "${copyMatch[1]}"`;
        }
        return null;
      }
      case 'CONTACTS': {
        const searchMatch = text.match(/(?:cerca|find|search|chi e|who is)\s+(.+)/i);
        if (searchMatch) {
          const results = await contactsService.searchContacts(searchMatch[1]);
          if (results.length > 0) return contactsService.generateContactsSummary(results.slice(0, 5));
          return `Nessun contatto trovato per "${searchMatch[1]}".`;
        }
        return null;
      }
      case 'SCREENSHOT': {
        const result = await screenshotService.captureScreen();
        return result.success ? 'Screenshot catturato!' : `Errore: ${result.error}`;
      }
    }

    return null;
  };

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
