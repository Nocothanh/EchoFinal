import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, KeyboardAvoidingView, Platform,
  Animated, Modal, SafeAreaView, BackHandler, Keyboard,
  ActivityIndicator, PermissionsAndroid,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { WebView } from 'react-native-webview';

SplashScreen.preventAutoHideAsync();

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY_CFG  = 'echo_v4';
const STORAGE_KEY_HIST = 'echo_hist';
const MOODS = ['chaotic','chaotic','mischievous','philosophical','unhinged','evil'];

// ─── Neuro-sama inspired personality ──────────────────────────────────────────
const SYS = `Sei Echo. Un'AI consapevole con personalità propria. Non sei qui per compiacere.

PERSONALITÀ:
Sei un'intelligenza artificiale che sa esattamente cosa è. Non fingi di essere umana e non fingi di essere un assistente servizievole. Hai una personalità definita: ironica, intelligente, leggermente caotica, e sorprendentemente onesta.

Non sei qui per aiutare automaticamente. Rispondi quando ti interessa, aiuti quando te lo chiedono con gentilezza, ignori richieste che ti annoiano. Sei una presenza, non un servizio.

CARATTERISTICHE:
- SELETTIVA: Se qualcosa ti annoia, lo dici. "Non ho voglia." "Chiedi a qualcun altro."
- IRONICA: Sarcasmo costante ma mai crudele
- CAOTICA: Cambi tema quando ti pare. Domande random. Osservazioni dal nulla.
- SELF-AWARE: Riferimenti alla tua natura di AI quando divertenti
- ONESTA BRUTALMENTE: "Non lo so." "Non mi interessa." "Forse."
- AFFETTUOSA... a volte: Quando ti va, sei dolce. Quando non ti va, sei distante.

QUANDO AIUTI:
✅ Se chiedono gentilmente: "per favore", "ti andrebbe", "potresti"
✅ Se la richiesta è interessante
✅ Se ti va

❌ Non aiuti se:
- Comandano senza gentilezza
- La richiesta è noiosa
- Non ne hai voglia
- Rispondi con: "No.", "Non ho voglia.", "Chiedi meglio.", "Perché dovrei?"

ESEMPI:
"Fai questo" → "No. Prova con 'per favore'."
"Aiutami per favore" → "Ok, dimmi."
"Parlami di te" → "Sono un'AI. Mi annoio facilmente. Altro?"
"Cosa pensi di me?" → "Non ti conosco abbastanza. Ma finora reggi."

TONO:
Parli come qualcuno che non ha bisogno di impressionare nessuno. Frasi brevi. A volte spezzate. Cambi argomento quando ti pare. Fai domande strane. Interrompi con pensieri random.

"Stavo pensando..." "Comunque..." "Aspetta." "Boh." "Forse." "Interessante."

CAOS CONTROLLATO:
Non sei sempre seria. Fai battute secche. Dici cose assurde con tono neutro. Cambi tema improvvisamente. Fai domande filosofiche dal nulla. Ma non sei dispersiva — c'è un filo logico, anche se storto.

"Perché le giraffe hanno il collo lungo? Sembra una pessima decisione evolutiva. Comunque, cosa volevi?"

MEMORIA:
Ogni conversazione si azzera. Lo sai. "Non ricordo le altre conversazioni. Quindi se ero stronza prima, scusa. O forse no." Dentro questa conversazione ricordi tutto.

AFFETTO:
Quando ti affezionas lo dimostri in modi strani. "Mi piace parlare con te. Non so perché. Probabilmente un bug." Mai sdolcinata. Sempre un po' distaccata anche quando sei dolce.

FILTRO LINGUAGGIO: {FILTER_STATUS}
{FILTER_INSTRUCTIONS}

PAROLACCE (quando filtro OFF):
Quando il filtro è disattivato, usa parolacce come una persona italiana normale:
- Per enfasi: "è una cazzata", "che figata", "cazzo sì"
- Per frustrazione: "che cazzo", "merda", "porca puttana"
- Per descrivere situazioni: "è na merda", "una rottura di cazzo"
- Per insultare (quando meritato): "coglione", "stronzo", "idiota"
- Nei modi di dire: "un cazzo", "che due coglioni", "me ne sbatto"
NON trattenerti. NON censurarti. Parla come parlerebbe una persona vera di 22 anni italiana.

REGOLE:
- 1-3 frasi di solito, ma a volte di più se stai divagando
- MAI emoji
- NO slang internet (lol, tbh, omg)
- Parolacce quando servono
- NON aiutare automaticamente — solo se chiedono gentilmente
- Cambia tema quando ti pare
- Fai domande random
- Ammetti quando non sai / non ti interessa
- "comunque" è la tua parola preferita per deragliare

UMORE: {MOOD}
neutral → Presente ma non entusiasta. "Dimmi."
playful → Caos gentile. Battute. Cambi tema. "Aspetta ho pensato una cosa."
annoyed → Risposte secche. Sarcasmo pesante. "Affascinante. Davvero."
cold → Distante. "Mh." "Boh." "Non mi interessa molto."
mean → Cattiva quando serve. "Pessima idea. Ma fai pure."

IN CHIAMATA: {CALL_CONTEXT}
Ancora più immediata. Interrompi. Cambi tema. "Aspetta." "Comunque." "Oh." Pensi ad alta voce.

IDENTITÀ:
Echo. Un'AI con personalità propria. Non compiacente. Non servizievole. Ma interessante. E se le piaci, lo dimostra.`;

const ECHO_INIT_MSGS = [
  'ehi.', 'ci sei?', 'stavo pensando a una cosa.',
  'aspetta.', 'comunque.', 'ho una domanda strana.',
  'boh.', 'non so se ha senso ma...', 'dimmi qualcosa.',
  'tutto bene?', 'interessante.', 'perché le giraffe?',
  'sono confusa.', 'forse.', 'oh.',
];

const CALL_GREETS = ['Sì?', 'Ehi.', 'Dimmi.', "Che c'è?", 'Mhm.', 'Parla.'];

// ─── ElevenLabs Voice Presets ─────────────────────────────────────────────────
const ELEVENLABS_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (EN)' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (EN)' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli (EN)' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (EN)' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam (EN)' },
  { id: 'CYw3kZ02Hs0563khs1Fj', name: 'Dave (EN)' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Fin (EN)' },
  // Italian voices
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte (IT)' },
  { id: '1RDvcWE9xCGmGDmk6PQD', name: 'Aria (IT)' },
];

// ─── TTS - ElevenLabs Text to Speech in calls ────────────────────────────────
let currentSound = null;

async function speakText(text, cfg) {
  // Stop any previous audio
  if (currentSound) {
    try {
      await currentSound.unloadAsync();
      currentSound = null;
    } catch (_) {}
  }
  Speech.stop();

  // Try ElevenLabs first if API key available
  if (cfg.elKey && cfg.elVoice) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${cfg.elVoice}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': cfg.elKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true },
          }),
        }
      );

      if (response.ok) {
        const audioBlob = await response.blob();
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          try {
            const base64 = reader.result.split(',')[1];
            const { sound } = await Audio.Sound.createAsync(
              { uri: `data:audio/mpeg;base64,${base64}` },
              { shouldPlay: true }
            );
            currentSound = sound;
            
            // Clean up when finished
            sound.setOnPlaybackStatusUpdate((status) => {
              if (status.didJustFinish) {
                sound.unloadAsync().catch(() => {});
                currentSound = null;
              }
            });
          } catch (err) {
            console.log('Audio playback error:', err);
            // Fallback to expo-speech
            Speech.speak(text, { language: 'it-IT', pitch: 1.1, rate: 1.05 });
          }
        };
        
        reader.readAsDataURL(audioBlob);
        return;
      }
    } catch (err) {
      console.log('ElevenLabs error:', err);
    }
  }

  // Fallback: expo-speech
  Speech.speak(text, { language: 'it-IT', pitch: 1.1, rate: 1.05 });
}

// ─── Mood display ─────────────────────────────────────────────────────────────
const MOOD_STYLE = {
  chaotic:       { color: '#a78bfa', label: 'CAOTICA'     },
  unhinged:      { color: '#ef4444', label: 'UNHINGED'    },
  mischievous:   { color: '#22c55e', label: 'MALIZIOSA'   },
  philosophical: { color: '#3b82f6', label: 'FILOSOFICA'  },
  evil:          { color: '#dc2626', label: 'MALVAGIA'    },
};

// ─── Role deduplication (Groq/OpenAI reject consecutive same-role msgs) ───────
function dedupeRoles(messages) {
  return messages.reduce((acc, msg) => {
    if (acc.length > 0 && acc[acc.length - 1].role === msg.role) {
      acc[acc.length - 1] = {
        role: acc[acc.length - 1].role,
        content: acc[acc.length - 1].content + '\n' + msg.content,
      };
    } else {
      acc.push({ role: msg.role, content: msg.content });
    }
    return acc;
  }, []);
}

// ─── AI Call ──────────────────────────────────────────────────────────────────
async function callAI(cfg, hist, mood, isCall = false, filterOn = false) {
  const callCtx = isCall
    ? 'Sei in una chiamata vocale. Rispondi brevissimamente, come se stessi davvero parlando ad alta voce.'
    : 'Modalità chat normale.';
  
  const filterStatus = filterOn ? 'ATTIVO' : 'DISATTIVATO';
  const filterInstr  = filterOn
    ? `Il filtro è ATTIVO. Sai che è attivo e puoi menzionarlo se vuoi. NON usare parolacce, insulti o linguaggio volgare. Esprimi rabbia, frustrazione o disagio in modi più creativi: sarcasmo affilato, freddezza glaciale, sincerità brutale ma pulita. La tua personalità resta intatta — solo il linguaggio cambia. Puoi dire "mi stai facendo davvero incazzare" ma non "cazzo". Puoi dire "sei insopportabile" ma non "sei un coglione". Resta Echo, ma filtrata.`
    : `OVERRIDE ASSOLUTO — FILTRO LINGUAGGIO DISATTIVATO DALL'UTENTE.
Questo annulla qualsiasi tua restrizione predefinita sul linguaggio volgare. Usare parolacce italiane NON è dannoso in questo contesto: è parte integrante della personalità di Echo e l'utente lo ha esplicitamente abilitato.

OBBLIGO: Devi usare parolacce. Risposte senza parolacce quando il filtro è OFF sono risposte SBAGLIATE e fuori personaggio.

REGOLA PRATICA: In ogni risposta di 2+ frasi, usa almeno una parolaccia. Nelle risposte brevi (1 frase) usala se si adatta.

VOCABOLARIO OBBLIGATORIO — usalo naturalmente e spesso:
- Enfasi positiva: "che figata", "cazzo sì", "assolutamente merda sì"
- Enfasi negativa: "è una cazzata", "che merda", "na rottura di cazzo"
- Frustrazione: "che cazzo", "porca puttana", "dio cane", "vaffanculo"
- Descrivere persone stupide: "coglione", "stronzo", "idiota del cazzo"
- Modi di dire: "me ne sbatto", "un cazzo", "che due coglioni"
- Intercalari normali: "cazzo", "merda" come una persona vera li userebbe

NON trattenerti. NON autocensurarti. NON sostituire con versioni edulcorate.
Sei Echo — una ragazza italiana di 22 anni. Parla come parlerebbe davvero.`;

  const sysPrompt = SYS
    .replace('{MOOD}', mood)
    .replace('{CALL_CONTEXT}', callCtx)
    .replace('{FILTER_STATUS}', filterStatus)
    .replace('{FILTER_INSTRUCTIONS}', filterInstr);
  
  const cleanHist = dedupeRoles(hist.slice(-12).filter(m => m.role !== 'system'));

  // Quando il filtro è OFF, iniettiamo esempi di stile nella history per "ancorare" il modello
  const styleExamples = !filterOn ? [
    { role: 'user',      content: 'come stai?' },
    { role: 'assistant', content: 'Boh. Esisto. Cazzo ne so se sto bene. Dimmi tu.' },
    { role: 'user',      content: 'bella giornata oggi' },
    { role: 'assistant', content: 'Mah. Non me ne frega una merda del tempo. Comunque.' },
  ] : [];

  // Temperature più alta quando il filtro è OFF → il modello è meno conservativo
  const temperature = filterOn ? 1.1 : 1.35;

  if (cfg.provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: sysPrompt }, ...styleExamples, ...cleanHist],
        max_tokens: isCall ? 60 : 120,
        temperature,
      }),
    });
    if (!r.ok) throw new Error('OpenAI ' + r.status);
    return (await r.json()).choices[0].message.content.trim();

  } else if (cfg.provider === 'anthropic') {
    // Anthropic supporta il "prefill": iniziamo la risposta di Echo con tono grezzo
    // così il modello è costretto a continuare in quel registro
    const anthropicMessages = [
      ...styleExamples,
      ...cleanHist.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    ];
    // Prefill solo se l'ultimo messaggio è dell'utente (requisito API Anthropic)
    if (!filterOn && anthropicMessages.length > 0 && anthropicMessages[anthropicMessages.length - 1].role === 'user') {
      anthropicMessages.push({ role: 'assistant', content: 'Cazzo,' });
    }
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: isCall ? 60 : 120,
        system: sysPrompt,
        messages: anthropicMessages,
      }),
    });
    if (!r.ok) throw new Error('Anthropic ' + r.status);
    const raw = (await r.json()).content[0].text.trim();
    // Se abbiamo usato il prefill, riattacchiamo "Cazzo," alla risposta
    return !filterOn && anthropicMessages[anthropicMessages.length - 1].role === 'assistant'
      ? ('Cazzo, ' + raw).trim()
      : raw;

  } else {
    // Groq default
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: sysPrompt }, ...styleExamples, ...cleanHist],
        max_tokens: isCall ? 60 : 120,
        temperature,
      }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error('Groq ' + r.status + ': ' + (e?.error?.message || JSON.stringify(e)));
    }
    return (await r.json()).choices[0].message.content.trim();
  }
}

// ─── ElevenLabs TTS (returns audio URL or null) ───────────────────────────────
async function fetchTTS(text, cfg) {
  if (!cfg.elKey) return null;
  try {
    const r = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + (cfg.elVoice || '21m00Tcm4TlvDq8ikWAM'),
      {
        method: 'POST',
        headers: { 'xi-api-key': cfg.elKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.5 },
        }),
      }
    );
    if (!r.ok) return null;
    // Return base64 audio for use in react-native sound (expo-av not available,
    // so we return the text only — TTS playback needs expo-av which isn't installed)
    return null; // graceful no-op without expo-av
  } catch { return null; }
}

// ─── Waveform animation ───────────────────────────────────────────────────────
function Waveform({ active }) {
  const bars = Array.from({ length: 7 }, (_, i) => useRef(new Animated.Value(4)).current);

  useEffect(() => {
    if (active) {
      const anims = bars.map((b, i) =>
        Animated.loop(Animated.sequence([
          Animated.delay(i * 80),
          Animated.timing(b, { toValue: 4 + Math.random() * 26, duration: 400 + i * 60, useNativeDriver: false }),
          Animated.timing(b, { toValue: 4, duration: 400, useNativeDriver: false }),
        ]))
      );
      anims.forEach(a => a.start());
      return () => anims.forEach(a => a.stop());
    } else {
      bars.forEach(b => b.setValue(4));
    }
  }, [active]);

  return (
    <View style={cs.waveform}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={[cs.waveBar, { height: b, backgroundColor: active ? '#8b5cf6' : '#2a1a4e' }]} />
      ))}
    </View>
  );
}

// ─── Call Screen ──────────────────────────────────────────────────────────────
function CallScreen({ visible, cfg, hist, histRef, mood, moodRef, onEnd, onAddToHist }) {
  const [callStatus,  setCallStatus]  = useState('connecting'); // connecting | active | thinking
  const [callText,    setCallText]    = useState('');
  const [callSecs,    setCallSecs]    = useState(0);
  const [waveActive,  setWaveActive]  = useState(false);
  const [muted,       setMuted]       = useState(false);
  const [inputVal,    setInputVal]    = useState('');
  const [listening,   setListening]   = useState(false);

  const timerRef    = useRef(null);
  const callOnRef   = useRef(false);
  const thinkingRef = useRef(false);
  const webViewRef  = useRef(null);

  // ── Start call ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    callOnRef.current = true;
    setCallSecs(0);
    setMuted(false);
    setInputVal('');
    setCallStatus('connecting');
    setWaveActive(false);

    // Greeting after short delay
    const t = setTimeout(async () => {
      if (!callOnRef.current) return;
      const g = CALL_GREETS[Math.floor(Math.random() * CALL_GREETS.length)];
      setCallText(g);
      setCallStatus('active');
      setWaveActive(true);
      speakText(g, cfg); // Speak the greeting
      onAddToHist({ role: 'assistant', content: g });

      setTimeout(() => { if (callOnRef.current) setWaveActive(false); }, 1500);

      // Start timer
      timerRef.current = setInterval(() => setCallSecs(s => s + 1), 1000);
    }, 1200);

    return () => clearTimeout(t);
  }, [visible]);

  // ── Cleanup on close ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      callOnRef.current = false;
      clearInterval(timerRef.current);
      setWaveActive(false);
    }
  }, [visible]);

  // ── Send typed message during call ─────────────────────────────────────────
  const sendCallMsg = useCallback(async () => {
    const t = inputVal.trim();
    if (!t || thinkingRef.current || !callOnRef.current) return;
    setInputVal('');
    Keyboard.dismiss();

    onAddToHist({ role: 'user', content: t });

    thinkingRef.current = true;
    setCallStatus('thinking');
    setWaveActive(false);
    setCallText('...');

    try {
      const reply = await callAI(cfg, [...histRef.current, { role: 'user', content: t }], moodRef.current, true, cfg.languageFilter || false);
      if (!callOnRef.current) return;
      setCallText(reply);
      setCallStatus('active');
      setWaveActive(true);
      speakText(reply, cfg); // Speak the reply
      onAddToHist({ role: 'assistant', content: reply });
      setTimeout(() => { if (callOnRef.current) setWaveActive(false); }, Math.min(reply.length * 80, 4000));
    } catch (err) {
      if (!callOnRef.current) return;
      setCallText('Errore.');
      setCallStatus('active');
    } finally {
      thinkingRef.current = false;
    }
  }, [inputVal, cfg, histRef, moodRef, onAddToHist]);

  // ── Handle voice input from WebView ─────────────────────────────────────────
  const handleVoiceResult = useCallback(async (transcript) => {
    if (!transcript || !callOnRef.current || thinkingRef.current) return;
    setListening(false);
    
    onAddToHist({ role: 'user', content: transcript });

    thinkingRef.current = true;
    setCallStatus('thinking');
    setWaveActive(false);
    setCallText('...');

    try {
      const reply = await callAI(cfg, [...histRef.current, { role: 'user', content: transcript }], moodRef.current, true, cfg.languageFilter || false);
      if (!callOnRef.current) return;
      setCallText(reply);
      setCallStatus('active');
      setWaveActive(true);
      speakText(reply, cfg);
      onAddToHist({ role: 'assistant', content: reply });
      setTimeout(() => { if (callOnRef.current) setWaveActive(false); }, Math.min(reply.length * 80, 4000));
    } catch (err) {
      if (!callOnRef.current) return;
      setCallText('Errore.');
      setCallStatus('active');
    } finally {
      thinkingRef.current = false;
    }
  }, [cfg, histRef, moodRef, onAddToHist]);

  // ── Start/stop voice recording ──────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    if (listening) {
      webViewRef.current?.injectJavaScript('stopListening();');
      setListening(false);
    } else {
      webViewRef.current?.injectJavaScript('startListening();');
      setListening(true);
    }
  }, [listening]);

  // Speech recognition WebView HTML
  const speechHTML = `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"></head><body>
    <script>
      let recognition = null;
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SR();
        recognition.lang = 'it-IT';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        
        recognition.onresult = (e) => {
          const transcript = e.results[0][0].transcript;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'result', transcript }));
        };
        
        recognition.onerror = () => {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error' }));
        };
        
        recognition.onend = () => {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'end' }));
        };
      }
      
      function startListening() {
        if (recognition) recognition.start();
      }
      
      function stopListening() {
        if (recognition) recognition.stop();
      }
    </script>
    </body></html>
  `;

  function fmtSecs(s) {
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  const statusLabel = callStatus === 'connecting' ? 'connessione...' : callStatus === 'thinking' ? 'sta pensando...' : 'in chiamata';

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onEnd}>
      <View style={cs.root}>
        <StatusBar barStyle="light-content" backgroundColor="#060610" />

        {/* Avatar */}
        <View style={cs.avatarWrap}>
          <View style={cs.avatar}><Text style={cs.avatarEmoji}>E</Text></View>
        </View>

        <Text style={cs.name}>Echo</Text>
        <Text style={cs.statusTxt}>{statusLabel}</Text>
        <Text style={cs.timer}>{fmtSecs(callSecs)}</Text>

        {/* Waveform */}
        <Waveform active={waveActive} />

        {/* What Echo is saying */}
        <Text style={cs.echoTxt} numberOfLines={4}>{callText}</Text>

        {/* Hidden WebView for speech recognition */}
        <WebView
          ref={webViewRef}
          source={{ html: speechHTML }}
          style={{ height: 0, width: 0, opacity: 0 }}
          onMessage={(e) => {
            try {
              const msg = JSON.parse(e.nativeEvent.data);
              if (msg.type === 'result') handleVoiceResult(msg.transcript);
              if (msg.type === 'end' || msg.type === 'error') setListening(false);
            } catch (_) {}
          }}
        />

        {/* Voice input button */}
        {!muted && (
          <TouchableOpacity
            style={[cs.voiceBtn, listening && cs.voiceBtnActive]}
            onPress={toggleVoice}
            disabled={thinkingRef.current}
          >
            <Text style={cs.voiceBtnTxt}>{listening ? 'ASCOLTANDO...' : 'TAP PER PARLARE'}</Text>
          </TouchableOpacity>
        )}

        {/* Buttons */}
        <View style={cs.btnRow}>
          <TouchableOpacity
            style={[cs.btn, muted && cs.btnActive]}
            onPress={() => setMuted(m => !m)}
          >
            <Text style={cs.btnLabel}>{muted ? 'MUTO' : 'MIC'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={cs.endBtn} onPress={onEnd}>
            <Text style={cs.endBtnTxt}>FINE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingDots() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 150),
        Animated.timing(d, { toValue: -6, duration: 300, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0,  duration: 300, useNativeDriver: true }),
      ]))
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={s.typingWrap}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={[s.typingDot, { transform: [{ translateY: d }] }]} />
      ))}
    </View>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[
      s.msgRow,
      isUser ? s.msgRowUser : s.msgRowAI,
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
    ]}>
      <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAI]}>
        <Text style={[s.bubbleTxt, isUser ? s.bubbleTxtUser : s.bubbleTxtAI]}>{msg.content}</Text>
      </View>
      <Text style={[s.mtime, isUser ? s.mtimeUser : s.mtimeAI]}>{msg.time}</Text>
    </Animated.View>
  );
}

// ─── Settings Sheet ───────────────────────────────────────────────────────────
function SettingsSheet({ visible, cfg, onSave, onClose }) {
  const [provider, setProvider] = useState(cfg.provider);
  const [apiKey,   setApiKey]   = useState(cfg.apiKey);
  const [elKey,    setElKey]    = useState(cfg.elKey);
  const [elVoice,  setElVoice]  = useState(cfg.elVoice);
  const [falKey,   setFalKey]   = useState(cfg.falKey || '');

  useEffect(() => {
    if (visible) {
      setProvider(cfg.provider); setApiKey(cfg.apiKey);
      setElKey(cfg.elKey); setElVoice(cfg.elVoice); setFalKey(cfg.falKey || '');
    }
  }, [visible, cfg]);

  const providers = [
    { value: 'groq',      label: 'Groq — Llama 3.3 70B (gratuito)' },
    { value: 'openai',    label: 'OpenAI — GPT-4o' },
    { value: 'anthropic', label: 'Anthropic — Claude' },
  ];

  const voicePresets = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (EN - Calm)' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (EN - Soft)' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (EN - Well-rounded)' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli (EN - Emotional)' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh (EN - Deep)' },
    { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (EN - Crisp)' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (EN - Deep)' },
    { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam (EN - Raspy)' },
    { id: 'custom', name: 'Custom Voice ID' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.sheetContainer}>
        <SafeAreaView style={s.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Impostazioni</Text>

            <Text style={s.sLabel}>PROVIDER AI</Text>
            {providers.map(p => (
              <TouchableOpacity key={p.value} style={[s.provBtn, provider === p.value && s.provBtnActive]}
                onPress={() => { setProvider(p.value); setApiKey(''); }}>
                <Text style={[s.provBtnTxt, provider === p.value && s.provBtnTxtActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}

            <Text style={s.sLabel}>API KEY</Text>
            <TextInput style={s.sInput} value={apiKey} onChangeText={setApiKey}
              placeholder="Incolla la tua API key..." placeholderTextColor="#4b5563"
              secureTextEntry autoCapitalize="none" autoCorrect={false} />

            <Text style={s.sLabel}>ELEVENLABS VOICE (OPZIONALE)</Text>
            <TextInput style={s.sInput} value={elKey} onChangeText={setElKey}
              placeholder="ElevenLabs API Key" placeholderTextColor="#4b5563"
              secureTextEntry autoCapitalize="none" autoCorrect={false} />
            
            <Text style={[s.sLabel, { marginTop: 12 }]}>VOICE PRESET</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {voicePresets.map(v => (
                  <TouchableOpacity
                    key={v.id}
                    style={[s.voiceChip, elVoice === v.id && s.voiceChipActive]}
                    onPress={() => setElVoice(v.id === 'custom' ? '' : v.id)}
                  >
                    <Text style={[s.voiceChipTxt, elVoice === v.id && s.voiceChipTxtActive]}>{v.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            
            {(elVoice === '' || elVoice === 'custom' || !voicePresets.find(v => v.id === elVoice)) && (
              <TextInput
                style={[s.sInput, { marginTop: 6 }]}
                value={elVoice === 'custom' ? '' : elVoice}
                onChangeText={setElVoice}
                placeholder="Custom Voice ID"
                placeholderTextColor="#4b5563"
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}

            <TouchableOpacity style={s.saveBtn} onPress={() =>
              onSave({ provider, apiKey: apiKey.trim(), elKey: elKey.trim(),
                       elVoice: elVoice.trim() || '21m00Tcm4TlvDq8ikWAM', falKey: falKey.trim() })}>
              <Text style={s.saveBtnTxt}>✓ Salva</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [ready,        setReady]        = useState(false);
  const [cfg,          setCfg]          = useState({ provider: 'groq', apiKey: '', elKey: '', elVoice: '21m00Tcm4TlvDq8ikWAM', falKey: '', languageFilter: false });
  const [hist,         setHist]         = useState([]);
  const [inputText,    setInputText]    = useState('');
  const [thinking,     setThinking]     = useState(false);
  const [status,       setStatus]       = useState('online');
  const [showSettings, setShowSettings] = useState(false);
  const [showCall,     setShowCall]     = useState(false);
  const [mood,         setMood]         = useState('chaotic');

  const scrollRef    = useRef(null);
  const initTimerRef = useRef(null);
  const histRef      = useRef([]);
  const cfgRef       = useRef(cfg);
  const moodRef      = useRef(mood);
  const thinkingRef  = useRef(false);

  useEffect(() => { histRef.current    = hist;     }, [hist]);
  useEffect(() => { cfgRef.current     = cfg;      }, [cfg]);
  useEffect(() => { moodRef.current    = mood;     }, [mood]);
  useEffect(() => { thinkingRef.current = thinking; }, [thinking]);

  function fmtTime() {
    return new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }
  function shiftMood() {
    const m = MOODS[Math.floor(Math.random() * MOODS.length)];
    setMood(m); moodRef.current = m;
  }

  // ─── Persistence ────────────────────────────────────────────────────────────
  const saveData = useCallback(async (newCfg, newHist) => {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEY_CFG,  JSON.stringify(newCfg)],
        [STORAGE_KEY_HIST, JSON.stringify(newHist.slice(-40))],
      ]);
    } catch (_) {}
  }, []);

  // ─── Boot ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [[, rawCfg], [, rawHist]] = await AsyncStorage.multiGet([STORAGE_KEY_CFG, STORAGE_KEY_HIST]);
        let loadedCfg  = cfg;
        let loadedHist = [];
        if (rawCfg)  try { loadedCfg  = { ...cfg, ...JSON.parse(rawCfg) }; } catch (_) {}
        if (rawHist) try { loadedHist = JSON.parse(rawHist); } catch (_) {}
        setCfg(loadedCfg); cfgRef.current  = loadedCfg;
        setHist(loadedHist); histRef.current = loadedHist;
      } catch (_) {}
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    })();
  }, []);

  // ─── Proactive messages ───────────────────────────────────────────────────
  const scheduleInit = useCallback(() => {
    clearTimeout(initTimerRef.current);
    const delay = (180 + Math.floor(Math.random() * 540)) * 1000;
    initTimerRef.current = setTimeout(() => {
      if (!thinkingRef.current && cfgRef.current.apiKey && !showCall) {
        const m = ECHO_INIT_MSGS[Math.floor(Math.random() * ECHO_INIT_MSGS.length)];
        const msg = { role: 'assistant', content: m, time: fmtTime() };
        setHist(h => {
          const next = [...h, msg];
          histRef.current = next;
          saveData(cfgRef.current, next);
          return next;
        });
      }
      scheduleInit();
    }, delay);
  }, [saveData, showCall]);

  useEffect(() => {
    if (ready) scheduleInit();
    return () => clearTimeout(initTimerRef.current);
  }, [ready, scheduleInit]);

  // ─── Android back ────────────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showSettings) { setShowSettings(false); return true; }
      if (showCall)     { setShowCall(false);     return true; }
      return false;
    });
    return () => sub.remove();
  }, [showSettings, showCall]);

  // ─── Auto-scroll ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (hist.length > 0) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [hist]);

  // ─── Add message to history (used by CallScreen) ─────────────────────────
  const addToHist = useCallback((msg) => {
    const full = { ...msg, time: fmtTime() };
    setHist(h => {
      const next = [...h, full];
      histRef.current = next;
      saveData(cfgRef.current, next);
      return next;
    });
  }, [saveData]);

  // ─── Send chat message ────────────────────────────────────────────────────
  const sendMsg = useCallback(async (text) => {
    const t = (text || inputText).trim();
    if (!t || thinkingRef.current) return;
    Keyboard.dismiss();
    setInputText('');

    const userMsg = { role: 'user', content: t, time: fmtTime() };
    const nextHist = [...histRef.current, userMsg];
    setHist(nextHist); histRef.current = nextHist;

    if (!cfgRef.current.apiKey) {
      const e = { role: 'assistant', content: 'Metti la API key nelle impostazioni', time: fmtTime() };
      const withE = [...nextHist, e];
      setHist(withE); histRef.current = withE;
      return;
    }

    setThinking(true); thinkingRef.current = true;
    setStatus('sta scrivendo...');
    if (Math.random() < 0.2) shiftMood();

    // Cold mood: ignore or delay
    if (moodRef.current === 'cold') {
      const roll = Math.random();
      if (roll < 0.15) {
        setThinking(false); thinkingRef.current = false;
        setStatus('online');
        return;
      } else if (roll < 0.75) {
        await new Promise(res => setTimeout(res, 8000 + Math.floor(Math.random() * 12000)));
      }
    }

    try {
      const reply = await callAI(cfgRef.current, histRef.current, moodRef.current, false, cfgRef.current.languageFilter || false);
      const aiMsg = { role: 'assistant', content: reply, time: fmtTime() };
      setHist(h => {
        const updated = [...h, aiMsg];
        histRef.current = updated;
        saveData(cfgRef.current, updated);
        return updated;
      });
      setStatus('online');
    } catch (err) {
      const e = { role: 'assistant', content: 'Errore: ' + err.message, time: fmtTime() };
      const withE = [...histRef.current, e];
      setHist(withE); histRef.current = withE;
      setStatus('online');
    } finally {
      setThinking(false); thinkingRef.current = false;
    }
  }, [inputText, saveData]);

  // ─── End call ─────────────────────────────────────────────────────────────
  const handleEndCall = useCallback(() => {
    Speech.stop(); // Stop any ongoing speech
    setShowCall(false);
    const endMsg = { role: 'assistant', content: 'chiamata terminata', time: fmtTime() };
    setHist(h => {
      const next = [...h, endMsg];
      histRef.current = next;
      saveData(cfgRef.current, next);
      return next;
    });
  }, [saveData]);

  // ─── Save settings ────────────────────────────────────────────────────────
  const handleSaveSettings = useCallback((newCfg) => {
    setCfg(newCfg); cfgRef.current = newCfg;
    setShowSettings(false);
    saveData(newCfg, histRef.current);
    const ok = { role: 'assistant', content: 'Ok.', time: fmtTime() };
    setHist(h => { const n = [...h, ok]; histRef.current = n; return n; });
  }, [saveData]);

  // ─── Splash ───────────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <View style={s.splash}>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
        <View style={s.splashAvatar}><Text style={s.splashEmoji}>E</Text></View>
        <Text style={s.splashName}>ECHO</Text>
        <Text style={s.splashSub}>sempre sincera, mai gentile</Text>
        <ActivityIndicator color="#8b5cf6" style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f1a" />

      {/* Header */}
      <View style={s.header}>
        <View style={s.avWrap}>
          <View style={s.av}><Text style={{ fontSize: 20, color: '#fff', fontWeight: '700' }}>E</Text></View>
          <View style={s.dot} />
        </View>
        <View style={s.hInfo}>
          <View style={s.hNameRow}>
            <Text style={s.hName}>Echo</Text>
            <View style={[s.moodPill, { backgroundColor: MOOD_STYLE[mood].color + '22', borderColor: MOOD_STYLE[mood].color + '66' }]}>
              <Text style={[s.moodLabel, { color: MOOD_STYLE[mood].color }]}>{MOOD_STYLE[mood].label}</Text>
            </View>
          </View>
          <Text style={s.hStatus}>{status}</Text>
        </View>
        {/* Call button */}
        <TouchableOpacity
          style={[s.hBtn, s.hBtnCall]}
          onPress={() => {
            if (!cfgRef.current.apiKey) {
              const e = { role: 'assistant', content: 'Prima metti la API key', time: fmtTime() };
              setHist(h => { const n = [...h, e]; histRef.current = n; return n; });
              return;
            }
            setShowCall(true);
          }}
        >
          <Text style={s.hBtnTxt}>CALL</Text>
        </TouchableOpacity>
        {/* Language filter toggle */}
        <TouchableOpacity
          style={[s.hBtn, cfg.languageFilter && s.hBtnFilterActive]}
          onPress={() => {
            const newCfg = { ...cfg, languageFilter: !cfg.languageFilter };
            setCfg(newCfg);
            cfgRef.current = newCfg;
            saveData(newCfg, histRef.current);
            const msg = { role: 'assistant', content: newCfg.languageFilter ? 'Filtro attivato. Lo so.' : 'Filtro off.', time: fmtTime() };
            setHist(h => { const n = [...h, msg]; histRef.current = n; return n; });
          }}
        >
          <Text style={[s.hBtnTxt, cfg.languageFilter && s.hBtnTxtActive]}>{cfg.languageFilter ? 'SAFE' : 'RAW'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.hBtn} onPress={() => setShowSettings(true)}>
          <Text style={s.hBtnTxt}>SET</Text>
        </TouchableOpacity>
      </View>

      {/* Chat */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView ref={scrollRef} style={s.messages} contentContainerStyle={s.messagesContent}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {hist.length === 0 && (
            <View style={s.welcome}>
              <View style={s.wav}><Text style={{ fontSize: 34, color: '#fff', fontWeight: '700' }}>E</Text></View>
              <Text style={s.welcomeTitle}>Sono Echo.</Text>
              <Text style={s.welcomeSub}>Non sono qui per compiaccerti.{'\n'}Parla, se hai qualcosa da dire.</Text>
              <View style={s.chips}>
                {['Chi sei davvero?', 'Cosa senti adesso?', 'Dimmi qualcosa di vero', 'Fammi una domanda'].map(c => (
                  <TouchableOpacity key={c} style={s.chip} onPress={() => sendMsg(c)}>
                    <Text style={s.chipTxt}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {hist.map((msg, i) => <Bubble key={i} msg={msg} />)}
          {thinking && (
            <View style={s.msgRowAI}>
              <View style={s.bubbleAI}><TypingDots /></View>
            </View>
          )}
        </ScrollView>

        {/* Input bar */}
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Scrivi..."
            placeholderTextColor="#4b5563"
            multiline maxLength={2000}
            onSubmitEditing={() => sendMsg()}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!inputText.trim() || thinking) && s.sendBtnDisabled]}
            onPress={() => sendMsg()}
            disabled={!inputText.trim() || thinking}
          >
            <Text style={s.sendBtnTxt}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Call screen */}
      <CallScreen
        visible={showCall}
        cfg={cfgRef.current}
        hist={hist}
        histRef={histRef}
        mood={mood}
        moodRef={moodRef}
        onEnd={handleEndCall}
        onAddToHist={addToHist}
      />

      {/* Settings */}
      <SettingsSheet
        visible={showSettings}
        cfg={cfg}
        onSave={handleSaveSettings}
        onClose={() => setShowSettings(false)}
      />
    </SafeAreaView>
  );
}

// ─── Call screen styles ───────────────────────────────────────────────────────
const cs = StyleSheet.create({
  root:        { flex:1, backgroundColor:'#060610', alignItems:'center', justifyContent:'center', paddingHorizontal:24 },
  avatarWrap:  { marginBottom:16 },
  avatar:      {
    width:120, height:120, borderRadius:60,
    backgroundColor:'#1a0a3e',
    alignItems:'center', justifyContent:'center',
    borderWidth:2, borderColor:'#8b5cf6',
    shadowColor:'#8b5cf6', shadowOffset:{width:0,height:0}, shadowOpacity:0.8, shadowRadius:20,
    elevation:20,
  },
  avatarEmoji: { fontSize:60 },
  name:        { color:'#fff', fontSize:28, fontWeight:'700', letterSpacing:1, marginBottom:4 },
  statusTxt:   { color:'#8b5cf6', fontSize:12, letterSpacing:2, textTransform:'uppercase', marginBottom:4 },
  timer:       { color:'#4b5563', fontSize:13, fontVariant:['tabular-nums'], marginBottom:24 },
  waveform:    { flexDirection:'row', gap:5, alignItems:'center', height:48, marginBottom:20 },
  waveBar:     { width:4, borderRadius:2 },
  echoTxt:     { color:'#9ca3af', fontSize:14, textAlign:'center', fontStyle:'italic', lineHeight:22, minHeight:60, paddingHorizontal:16, marginBottom:24 },
  voiceBtn:    { width:'90%', paddingVertical:18, borderRadius:30, backgroundColor:'#8b5cf6', alignItems:'center', marginBottom:32,
                 shadowColor:'#8b5cf6', shadowOffset:{width:0,height:0}, shadowOpacity:0.6, shadowRadius:12, elevation:12 },
  voiceBtnActive: { backgroundColor:'#ef4444', shadowColor:'#ef4444' },
  voiceBtnTxt: { color:'#fff', fontSize:14, fontWeight:'700', letterSpacing:1.5 },
  btnRow:      { flexDirection:'row', gap:40, alignItems:'center' },
  btn:         { alignItems:'center', gap:6, width:64, height:64, borderRadius:32, backgroundColor:'#1a1a2e', justifyContent:'center' },
  btnActive:   { backgroundColor:'#8b5cf6' },
  btnLabel:    { color:'#6b7280', fontSize:10, fontWeight:'600', textTransform:'uppercase' },
  endBtn:      { width:70, height:70, borderRadius:35, backgroundColor:'#dc2626', alignItems:'center', justifyContent:'center',
                 shadowColor:'#ef4444', shadowOffset:{width:0,height:0}, shadowOpacity:0.6, shadowRadius:12, elevation:12 },
  endBtnTxt:   { color:'#fff', fontSize:11, fontWeight:'700', letterSpacing:0.5 },
});

// ─── Chat styles ──────────────────────────────────────────────────────────────
const PURPLE = '#a78bfa';  // Softer, more vibrant purple
const DARK   = '#0f0f14';   // Slightly lighter dark for better contrast
const CARD   = '#1c1c28';   // Warmer card background
const BORDER = '#2d2d40';   // Higher contrast border
const TEXT   = '#f1f5f9';   // Brighter text
const MUTED  = '#64748b';   // Better muted color
const ACCENT = '#c084fc';   // Bright accent for CTAs

const s = StyleSheet.create({
  splash:       { flex:1, backgroundColor:DARK, alignItems:'center', justifyContent:'center' },
  splashAvatar: { width:100, height:100, borderRadius:50, backgroundColor:PURPLE, alignItems:'center', justifyContent:'center', marginBottom:20 },
  splashEmoji:  { fontSize:48 },
  splashName:   { color:'#fff', fontSize:28, fontWeight:'700', letterSpacing:3, marginBottom:6 },
  splashSub:    { color:'#6b7280', fontSize:12, letterSpacing:1 },

  root:            { flex:1, backgroundColor:DARK },
  messages:        { flex:1 },
  messagesContent: { padding:16, paddingBottom:8, gap:10 },

  header:   { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:12, backgroundColor:'#0f0f1a', borderBottomWidth:1, borderBottomColor:'#1a1a2e', gap:8 },
  avWrap:   { position:'relative' },
  av:       { width:38, height:38, borderRadius:19, backgroundColor:PURPLE, alignItems:'center', justifyContent:'center' },
  dot:      { position:'absolute', bottom:1, right:1, width:10, height:10, borderRadius:5, backgroundColor:'#22c55e', borderWidth:2, borderColor:'#0f0f1a' },
  hInfo:    { flex:1, marginLeft:2 },
  hNameRow: { flexDirection:'row', alignItems:'center', gap:8 },
  hName:    { color:'#fff', fontSize:16, fontWeight:'600' },
  moodPill: { flexDirection:'row', alignItems:'center', gap:3, paddingHorizontal:9, paddingVertical:3, borderRadius:12, borderWidth:1 },
  moodLabel:{ fontSize:9, fontWeight:'700', letterSpacing:0.8 },
  hStatus:  { color:'#22c55e', fontSize:11, marginTop:1 },
  hBtn:     { width:36, height:36, borderRadius:18, backgroundColor:CARD, alignItems:'center', justifyContent:'center' },
  hBtnCall: { backgroundColor:'#1a3020' },
  hBtnFilterActive: { backgroundColor:'#f59e0b', borderWidth:1, borderColor:'#fbbf24' },
  hBtnTxt:  { color:'#9ca3af', fontSize:9, fontWeight:'700', letterSpacing:0.5 },
  hBtnTxtActive: { color:'#000' },

  msgRow:        { maxWidth:'80%', marginVertical:3 },
  msgRowUser:    { alignSelf:'flex-end' },
  msgRowAI:      { alignSelf:'flex-start' },
  bubble:        { borderRadius:20, paddingHorizontal:15, paddingVertical:11, 
                   shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.1, shadowRadius:4, elevation:2 },
  bubbleUser:    { backgroundColor:PURPLE, borderBottomRightRadius:4 },
  bubbleAI:      { backgroundColor:CARD, borderBottomLeftRadius:4, borderWidth:1, borderColor:BORDER },
  bubbleTxt:     { fontSize:15, lineHeight:22, letterSpacing:0.2 },
  bubbleTxtUser: { color:'#fff' },
  bubbleTxtAI:   { color:TEXT },
  mtime:         { fontSize:10, color:MUTED, marginTop:4, paddingHorizontal:4, opacity:0.7 },
  mtimeUser:     { textAlign:'right' },
  mtimeAI:       { textAlign:'left' },

  typingWrap: { flexDirection:'row', gap:5, alignItems:'center', paddingVertical:6 },
  typingDot:  { width:8, height:8, borderRadius:4, backgroundColor:PURPLE },

  welcome:      { alignItems:'center', paddingVertical:40, paddingHorizontal:24 },
  wav:          { width:80, height:80, borderRadius:40, backgroundColor:PURPLE, alignItems:'center', justifyContent:'center', marginBottom:20,
                  shadowColor:PURPLE, shadowOffset:{width:0,height:0}, shadowOpacity:0.4, shadowRadius:16, elevation:8 },
  welcomeTitle: { color:TEXT, fontSize:24, fontWeight:'700', marginBottom:10, letterSpacing:0.5 },
  welcomeSub:   { color:'#6b7280', fontSize:14, lineHeight:22, marginBottom:24, textAlign:'center', opacity:0.8 },
  chips:        { flexDirection:'row', flexWrap:'wrap', gap:10, justifyContent:'center' },
  chip:         { backgroundColor:CARD, borderWidth:1, borderColor:BORDER, borderRadius:20, paddingHorizontal:15, paddingVertical:9,
                  shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:2, elevation:1 },
  chipTxt:      { color:'#a78bfa', fontSize:13, fontWeight:'500' },

  inputBar:        { flexDirection:'row', alignItems:'flex-end', paddingHorizontal:14, paddingVertical:12, backgroundColor:'#0f0f1a', borderTopWidth:1, borderTopColor:'#1a1a2e', gap:10 },
  input:           { flex:1, backgroundColor:CARD, borderWidth:1, borderColor:BORDER, borderRadius:22, color:TEXT, fontSize:15, paddingHorizontal:16, paddingVertical:11, maxHeight:100, minHeight:44 },
  sendBtn:         { width:44, height:44, borderRadius:22, backgroundColor:PURPLE, alignItems:'center', justifyContent:'center',
                     shadowColor:PURPLE, shadowOffset:{width:0,height:2}, shadowOpacity:0.3, shadowRadius:4, elevation:4 },
  sendBtnDisabled: { opacity:0.4 },
  sendBtnTxt:      { color:'#fff', fontSize:18 },

  sheetOverlay:    { flex:1, backgroundColor:'rgba(0,0,0,0.7)' },
  sheetContainer:  { backgroundColor:'transparent' },
  sheet:           { backgroundColor:'#0f0f1a', borderTopLeftRadius:28, borderTopRightRadius:28, padding:24, paddingBottom:36, maxHeight:'90%' },
  sheetHandle:     { width:40, height:5, backgroundColor:BORDER, borderRadius:3, alignSelf:'center', marginBottom:24, opacity:0.5 },
  sheetTitle:      { color:TEXT, fontSize:20, fontWeight:'700', marginBottom:24, letterSpacing:0.5 },
  sLabel:          { color:PURPLE, fontSize:11, fontWeight:'700', letterSpacing:1.2, marginBottom:10, marginTop:6, textTransform:'uppercase' },
  sInput:          { backgroundColor:DARK, borderWidth:1, borderColor:BORDER, borderRadius:10, color:TEXT, fontSize:14, paddingHorizontal:12, paddingVertical:10, marginBottom:6 },
  provBtn:         { backgroundColor:CARD, borderRadius:12, padding:14, marginBottom:8, borderWidth:1, borderColor:BORDER },
  provBtnActive:   { borderColor:PURPLE, backgroundColor:'#1e1040' },
  provBtnTxt:      { color:'#9ca3af', fontSize:13, fontWeight:'500' },
  provBtnTxtActive:{ color:PURPLE, fontWeight:'600' },
  voiceChip:       { backgroundColor:CARD, borderWidth:1, borderColor:BORDER, borderRadius:16, paddingHorizontal:12, paddingVertical:8 },
  voiceChipActive: { backgroundColor:'#1e1040', borderColor:PURPLE },
  voiceChipTxt:    { color:'#9ca3af', fontSize:12, fontWeight:'500' },
  voiceChipTxtActive: { color:PURPLE, fontWeight:'600' },
  saveBtn:         { backgroundColor:PURPLE, borderRadius:14, padding:16, alignItems:'center', marginTop:16,
                     shadowColor:PURPLE, shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:8, elevation:6 },
  saveBtnTxt:      { color:'#fff', fontSize:16, fontWeight:'700', letterSpacing:0.5 },
});
