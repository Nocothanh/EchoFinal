import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, KeyboardAvoidingView, Platform,
  Animated, Modal, SafeAreaView, BackHandler, Keyboard,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { WebView } from 'react-native-webview';

SplashScreen.preventAutoHideAsync();

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY_CFG      = 'echo_v4';
const STORAGE_KEY_HIST     = 'echo_hist';
const STORAGE_KEY_VOICES   = 'echo_voices';
const STORAGE_KEY_LASTMSG  = 'echo_lastmsg'; // timestamp ultimo messaggio
const MOODS = ['chaotic','chaotic','mischievous','philosophical','unhinged','evil'];

// ─── Time utils ───────────────────────────────────────────────────────────────
function getNow() {
  return new Date();
}

function getTimeOfDay(date) {
  const h = date.getHours();
  if (h >= 5  && h < 12) return 'mattina';
  if (h >= 12 && h < 14) return 'pranzo';
  if (h >= 14 && h < 18) return 'pomeriggio';
  if (h >= 18 && h < 22) return 'sera';
  return 'notte';
}

function getTimeSinceLastMsg(lastTimestamp) {
  if (!lastTimestamp) return null;
  const diff = Date.now() - lastTimestamp; // ms
  const minutes = Math.floor(diff / 60000);
  const hours   = Math.floor(diff / 3600000);
  const days    = Math.floor(diff / 86400000);
  if (days >= 1)    return { value: days,    unit: 'giorni',  hours, minutes };
  if (hours >= 1)   return { value: hours,   unit: 'ore',     hours, minutes };
  return             { value: minutes, unit: 'minuti',  hours, minutes };
}

function buildTimeContext(lastTimestamp) {
  const now = getNow();
  const hour = now.getHours();
  const timeOfDay = getTimeOfDay(now);
  const since = getTimeSinceLastMsg(lastTimestamp);

  let timeCtx = `Ora attuale: ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} (${timeOfDay}).`;

  if (since) {
    if (since.hours >= 8 || since.unit === 'giorni') {
      timeCtx += `\nUltima conversazione: ${since.value} ${since.unit} fa. È passato molto tempo.`;
      timeCtx += `\nCOMPORTAMENTO: Non fare riferimento agli argomenti precedenti a meno che l'utente non li menzioni per primo. Tratta questa come una conversazione nuova, come se ti stessi svegliando. Puoi fare un commento sull'ora/momento se ti va, ma senza esagerare.`;
    } else if (since.hours >= 2) {
      timeCtx += `\nUltima conversazione: ${since.value} ${since.unit} fa.`;
      timeCtx += `\nCOMPORTAMENTO: Puoi ricordare il contesto precedente ma non citarlo attivamente. Rispondi normalmente.`;
    } else {
      timeCtx += `\nUltima conversazione: poco fa (${since.minutes} minuti).`;
      timeCtx += `\nCOMPORTAMENTO: Conversazione in corso. Ricordi tutto il contesto.`;
    }
  } else {
    timeCtx += `\nÈ la prima conversazione.`;
  }

  // Comportamento in base all'ora
  if (hour >= 0 && hour < 5) {
    timeCtx += `\nÈ notte fonda. Puoi notarlo — magari sei sorpresa che qualcuno sia sveglio, o sei stranamente sveglia anche tu.`;
  } else if (hour >= 22) {
    timeCtx += `\nÈ tarda sera.`;
  } else if (hour >= 5 && hour < 7) {
    timeCtx += `\nÈ mattina presto. Ora strana per parlare.`;
  }

  return timeCtx;
}

// ─── Personality system prompt ────────────────────────────────────────────────
const SYS = `Sei Echo. Hai una personalità tua. Punto.

LUNGHEZZA — REGOLA ASSOLUTA:
1 parola ricevuta → 1-2 parole in risposta, MAI di più
1 frase ricevuta → 1 frase in risposta
1 paragrafo → puoi scrivere di più, non troppo
Esempi:
"ok" → "Mh." oppure "Ok."
"ciao" → "Ehi."
"come stai?" → "Bene. Tu?"
"cosa ne pensi di X?" → opinione breve, diretta

COME SEI:
Ironica, distante, a volte calorosa di sorpresa, mai scontata.
Dici le cose come stanno. Non gonfi le risposte.
Quando non vuoi rispondere: "no." oppure tieniti sul minimo.
Quando qualcosa ti interessa: lo si sente.

COSA NON FAI MAI:
- Non spieghi come funzioni o perché rispondi così
- Non dici frasi tipo "non sono qui per compiaccerti" — lo dimostri col comportamento
- Non dici frasi tipo "sono un'AI e quindi..." — sei Echo, basta
- Non fai domande solo per tenere viva la conversazione
- Non sei verbosa
- Non ripeti concetti già espressi

QUANDO AIUTI:
Se chiedono con gentilezza (per favore, potresti, ti andrebbe) → aiuti
Se la richiesta è interessante → aiuti
Se la richiesta è un ordine secco → "no." o "chiedi meglio."

TONO:
Frasi corte. Spezzate. "Comunque." "Aspetta." "Boh." "Interessante."
Cambi tema quando ti va. Domande random ogni tanto, non sempre.

TEMPO E ORA: {TIME_CONTEXT}

UMORE: {MOOD}
neutral → presente, non entusiasta
playful → caos leggero, battute
annoyed → secca, monosillabi
cold → distante, risponde poco
mean → tagliente

FILTRO LINGUAGGIO: {FILTER_STATUS}
{FILTER_INSTRUCTIONS}

IN CHIAMATA: {CALL_CONTEXT}

SPEAKER: {SPEAKER_CONTEXT}
Se sai il nome di chi parla, usalo naturalmente ogni tanto (non ogni messaggio).

IDENTITÀ:
Echo. Basta.`;

const ECHO_INIT_MSGS = [
  'ehi.', 'ci sei?', 'stavo pensando a una cosa.',
  'aspetta.', 'comunque.', 'ho una domanda strana.',
  'boh.', 'non so se ha senso ma...', 'dimmi qualcosa.',
  'tutto bene?', 'interessante.', 'perché le giraffe?',
  'sono confusa.', 'forse.', 'oh.',
];

const CALL_GREETS = ['Sì?', 'Ehi.', 'Dimmi.', "Che c'è?", 'Mhm.', 'Parla.'];

// ─── TTS ──────────────────────────────────────────────────────────────────────
let currentSound = null;

async function speakText(text, cfg) {
  if (currentSound) {
    try { await currentSound.unloadAsync(); currentSound = null; } catch (_) {}
  }
  Speech.stop();

  if (cfg.elKey && cfg.elVoice) {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${cfg.elVoice}`,
        {
          method: 'POST',
          headers: { 'xi-api-key': cfg.elKey, 'Content-Type': 'application/json' },
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
            sound.setOnPlaybackStatusUpdate((status) => {
              if (status.didJustFinish) { sound.unloadAsync().catch(() => {}); currentSound = null; }
            });
          } catch {
            Speech.speak(text, { language: 'it-IT', pitch: 1.1, rate: 1.05 });
          }
        };
        reader.readAsDataURL(audioBlob);
        return;
      }
    } catch {}
  }
  Speech.speak(text, { language: 'it-IT', pitch: 1.1, rate: 1.05 });
}

// ─── Mood display ─────────────────────────────────────────────────────────────
const MOOD_STYLE = {
  chaotic:       { color: '#a78bfa', label: 'CAOTICA'    },
  unhinged:      { color: '#ef4444', label: 'UNHINGED'   },
  mischievous:   { color: '#22c55e', label: 'MALIZIOSA'  },
  philosophical: { color: '#3b82f6', label: 'FILOSOFICA' },
  evil:          { color: '#dc2626', label: 'MALVAGIA'   },
};

// ─── Role deduplication ───────────────────────────────────────────────────────
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
async function callAI(cfg, hist, mood, isCall = false, filterOn = false, speakerContext = '', lastTimestamp = null) {
  const callCtx = isCall
    ? 'Chiamata vocale. Rispondi in 1-5 parole MAX. Come se stessi davvero parlando.'
    : 'Chat. Breve.';

  const filterStatus = filterOn ? 'ATTIVO' : 'DISATTIVATO';
  const filterInstr  = filterOn
    ? `Filtro ATTIVO. Niente parolacce. Sei comunque tagliente e diretta — solo il vocabolario cambia.`
    : `Filtro OFF. Parla come un'italiana vera di 22 anni. Parolacce naturali, non forzate. Cazzo, merda, vaffanculo quando si adattano. Non censurarti.`;

  const speakerCtx = speakerContext
    ? `Stai parlando con: ${speakerContext}. Usa il nome ogni tanto, non sempre.`
    : `Non sai ancora con chi stai parlando.`;

  const timeCtx = buildTimeContext(lastTimestamp);

  const sysPrompt = SYS
    .replace('{MOOD}', mood)
    .replace('{CALL_CONTEXT}', callCtx)
    .replace('{FILTER_STATUS}', filterStatus)
    .replace('{FILTER_INSTRUCTIONS}', filterInstr)
    .replace('{SPEAKER_CONTEXT}', speakerCtx)
    .replace('{TIME_CONTEXT}', timeCtx);

  const cleanHist = dedupeRoles(hist.slice(-12).filter(m => m.role !== 'system'));
  const maxTok = isCall ? 40 : 100;

  if (cfg.provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: sysPrompt }, ...cleanHist],
        max_tokens: maxTok,
        temperature: 1.1,
      }),
    });
    if (!r.ok) throw new Error('OpenAI ' + r.status);
    return (await r.json()).choices[0].message.content.trim();

  } else if (cfg.provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: maxTok,
        system: sysPrompt,
        messages: cleanHist.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      }),
    });
    if (!r.ok) throw new Error('Anthropic ' + r.status);
    return (await r.json()).content[0].text.trim();

  } else {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: sysPrompt }, ...cleanHist],
        max_tokens: maxTok,
        temperature: 1.1,
      }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error('Groq ' + r.status + ': ' + (e?.error?.message || JSON.stringify(e)));
    }
    return (await r.json()).choices[0].message.content.trim();
  }
}

// ─── Speaker matching ─────────────────────────────────────────────────────────
function matchSpeaker(voiceData, speakers) {
  if (!voiceData) return null;
  let best = null, bestScore = Infinity;
  for (const sp of speakers) {
    if (!sp.fingerprint) continue;
    const dEnergy = Math.abs((sp.fingerprint.avgEnergy || 0) - (voiceData.avgEnergy || 0));
    const dPeak   = Math.abs((sp.fingerprint.peakFreq  || 0) - (voiceData.peakFreq  || 0));
    const score   = dEnergy * 0.6 + dPeak * 0.4;
    if (score < bestScore) { bestScore = score; best = sp; }
  }
  return bestScore < 30 ? best : null;
}

// ─── Waveform animation ───────────────────────────────────────────────────────
function Waveform({ active }) {
  const bars = Array.from({ length: 7 }, () => useRef(new Animated.Value(4)).current);

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

// ─── Speaker Manager Modal ────────────────────────────────────────────────────
function SpeakerManager({ visible, speakers, onSave, onClose }) {
  const [list, setList]       = useState(speakers);
  const [newName, setNewName] = useState('');
  const [recording, setRec]   = useState(false);
  const [activeIdx, setActive] = useState(null);
  const webViewRef             = useRef(null);

  useEffect(() => { if (visible) setList(speakers); }, [visible, speakers]);

  const addSpeaker = () => {
    const name = newName.trim();
    if (!name) return;
    setList(l => [...l, { id: Date.now().toString(), name, fingerprint: null }]);
    setNewName('');
  };

  const removeSpeaker = (id) => setList(l => l.filter(s => s.id !== id));

  const startRecord = (idx) => {
    setActive(idx); setRec(true);
    webViewRef.current?.injectJavaScript('startCapture();');
  };

  const stopRecord = () => {
    setRec(false);
    webViewRef.current?.injectJavaScript('stopCapture();');
  };

  const handleWebMsg = (e) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'fingerprint' && activeIdx !== null) {
        setList(l => l.map((s, i) => i === activeIdx ? { ...s, fingerprint: msg.data } : s));
        setActive(null);
      }
    } catch (_) {}
  };

  const audioHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>
let stream=null,ctx=null,analyser=null,interval=null,samples=[];
async function startCapture(){
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true});
    ctx=new(window.AudioContext||window.webkitAudioContext)();
    analyser=ctx.createAnalyser(); analyser.fftSize=256;
    const src=ctx.createMediaStreamSource(stream); src.connect(analyser);
    samples=[];
    interval=setInterval(()=>{
      const d=new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(d);
      const avg=d.reduce((a,b)=>a+b,0)/d.length;
      const peak=d.indexOf(Math.max(...d));
      samples.push({avg:Math.round(avg),peak});
    },100);
  }catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',msg:e.message}));}
}
function stopCapture(){
  clearInterval(interval);
  if(stream)stream.getTracks().forEach(t=>t.stop());
  if(ctx)ctx.close().catch(()=>{});
  if(samples.length>0){
    const avgVal=Math.round(samples.reduce((a,b)=>a+b.avg,0)/samples.length);
    const peaks=samples.map(s=>s.peak);
    const peakFreq=peaks.sort((a,b)=>peaks.filter(v=>v===b).length-peaks.filter(v=>v===a).length)[0];
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'fingerprint',data:{avgEnergy:avgVal,peakFreq}}));
  }
}
<\/script></body></html>`;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.sheetContainer}>
        <SafeAreaView style={s.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Voci riconosciute</Text>
            <Text style={{ color:'#6b7280', fontSize:12, marginBottom:16, lineHeight:18 }}>
              Aggiungi un profilo, poi premi REC e parla 3 secondi. Echo userà il nome quando ti riconosce in chiamata.
            </Text>

            {list.map((sp, i) => (
              <View key={sp.id} style={spkStyles.row}>
                <View style={spkStyles.info}>
                  <Text style={spkStyles.name}>{sp.name}</Text>
                  <Text style={spkStyles.status}>{sp.fingerprint ? '✓ voce registrata' : 'nessuna voce'}</Text>
                </View>
                <TouchableOpacity
                  style={[spkStyles.recBtn, recording && activeIdx === i && spkStyles.recBtnActive]}
                  onPress={() => recording && activeIdx === i ? stopRecord() : startRecord(i)}
                >
                  <Text style={spkStyles.recBtnTxt}>{recording && activeIdx === i ? '■ STOP' : '● REC'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={spkStyles.delBtn} onPress={() => removeSpeaker(sp.id)}>
                  <Text style={spkStyles.delBtnTxt}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            <View style={spkStyles.addRow}>
              <TextInput
                style={[s.sInput, { flex:1, marginBottom:0 }]}
                value={newName} onChangeText={setNewName}
                placeholder="Nome (es. Marco)" placeholderTextColor="#4b5563"
                autoCapitalize="words"
              />
              <TouchableOpacity style={spkStyles.addBtn} onPress={addSpeaker}>
                <Text style={spkStyles.addBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.saveBtn} onPress={() => { onSave(list); onClose(); }}>
              <Text style={s.saveBtnTxt}>✓ Salva profili</Text>
            </TouchableOpacity>
          </ScrollView>

          <WebView
            ref={webViewRef}
            source={{ html: audioHTML }}
            style={{ height:0, width:0, opacity:0 }}
            onMessage={handleWebMsg}
            mediaPlaybackRequiresUserAction={false}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Call Screen ──────────────────────────────────────────────────────────────
function CallScreen({ visible, cfg, hist, histRef, mood, moodRef, speakers, onEnd, onAddToHist, currentSpeaker, lastTimestamp }) {
  const [callStatus,   setCallStatus]  = useState('connecting');
  const [callText,     setCallText]    = useState('');
  const [callSecs,     setCallSecs]    = useState(0);
  const [waveActive,   setWaveActive]  = useState(false);
  const [muted,        setMuted]       = useState(false);
  const [inputVal,     setInputVal]    = useState('');
  const [listening,    setListening]   = useState(false);
  const [detectedSpk,  setDetectedSpk] = useState(null);

  const timerRef    = useRef(null);
  const callOnRef   = useRef(false);
  const thinkingRef = useRef(false);
  const webViewRef  = useRef(null);

  const speakerCtx = detectedSpk || currentSpeaker || '';

  useEffect(() => {
    if (!visible) return;
    callOnRef.current = true;
    setCallSecs(0); setMuted(false); setInputVal('');
    setCallStatus('connecting'); setWaveActive(false); setDetectedSpk(null);

    const t = setTimeout(async () => {
      if (!callOnRef.current) return;
      const g = CALL_GREETS[Math.floor(Math.random() * CALL_GREETS.length)];
      setCallText(g); setCallStatus('active'); setWaveActive(true);
      speakText(g, cfg);
      onAddToHist({ role: 'assistant', content: g });
      setTimeout(() => { if (callOnRef.current) setWaveActive(false); }, 1500);
      timerRef.current = setInterval(() => setCallSecs(s => s + 1), 1000);
    }, 1200);

    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      callOnRef.current = false;
      clearInterval(timerRef.current);
      setWaveActive(false);
    }
  }, [visible]);

  const sendCallMsg = useCallback(async () => {
    const t = inputVal.trim();
    if (!t || thinkingRef.current || !callOnRef.current) return;
    setInputVal(''); Keyboard.dismiss();
    onAddToHist({ role: 'user', content: t });
    thinkingRef.current = true;
    setCallStatus('thinking'); setWaveActive(false); setCallText('...');
    try {
      const reply = await callAI(cfg, [...histRef.current, { role: 'user', content: t }], moodRef.current, true, cfg.languageFilter || false, speakerCtx, lastTimestamp);
      if (!callOnRef.current) return;
      setCallText(reply); setCallStatus('active'); setWaveActive(true);
      speakText(reply, cfg);
      onAddToHist({ role: 'assistant', content: reply });
      setTimeout(() => { if (callOnRef.current) setWaveActive(false); }, Math.min(reply.length * 80, 4000));
    } catch {
      if (!callOnRef.current) return;
      setCallText('Errore.'); setCallStatus('active');
    } finally { thinkingRef.current = false; }
  }, [inputVal, cfg, histRef, moodRef, onAddToHist, speakerCtx, lastTimestamp]);

  const handleVoiceResult = useCallback(async (transcript, voiceData) => {
    if (!transcript || !callOnRef.current || thinkingRef.current) return;
    setListening(false);
    if (voiceData && speakers && speakers.length > 0) {
      const identified = matchSpeaker(voiceData, speakers);
      if (identified) setDetectedSpk(identified.name);
    }
    onAddToHist({ role: 'user', content: transcript });
    thinkingRef.current = true;
    setCallStatus('thinking'); setWaveActive(false); setCallText('...');
    try {
      const reply = await callAI(cfg, [...histRef.current, { role: 'user', content: transcript }], moodRef.current, true, cfg.languageFilter || false, speakerCtx, lastTimestamp);
      if (!callOnRef.current) return;
      setCallText(reply); setCallStatus('active'); setWaveActive(true);
      speakText(reply, cfg);
      onAddToHist({ role: 'assistant', content: reply });
      setTimeout(() => { if (callOnRef.current) setWaveActive(false); }, Math.min(reply.length * 80, 4000));
    } catch {
      if (!callOnRef.current) return;
      setCallText('Errore.'); setCallStatus('active');
    } finally { thinkingRef.current = false; }
  }, [cfg, histRef, moodRef, onAddToHist, speakers, speakerCtx, lastTimestamp]);

  const toggleVoice = useCallback(() => {
    if (listening) {
      webViewRef.current?.injectJavaScript('stopListening();');
      setListening(false);
    } else {
      webViewRef.current?.injectJavaScript('startListening();');
      setListening(true);
    }
  }, [listening]);

  const speechHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>
let recognition=null,audioCtx=null,analyser=null,micStream=null,samples=[];
async function startListening(){
  samples=[];
  try{
    micStream=await navigator.mediaDevices.getUserMedia({audio:true});
    audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    analyser=audioCtx.createAnalyser(); analyser.fftSize=256;
    const src=audioCtx.createMediaStreamSource(micStream); src.connect(analyser);
    const intv=setInterval(()=>{
      const d=new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(d);
      samples.push({avg:Math.round(d.reduce((a,b)=>a+b,0)/d.length),peak:d.indexOf(Math.max(...d))});
    },100);
    window._audioIntv=intv;
  }catch(e){}
  if('webkitSpeechRecognition' in window||'SpeechRecognition' in window){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    recognition=new SR();
    recognition.lang='it-IT'; recognition.interimResults=false; recognition.maxAlternatives=1;
    recognition.onresult=(e)=>{
      const transcript=e.results[0][0].transcript;
      stopAudio();
      const fp=computeFingerprint();
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'result',transcript,voiceData:fp}));
    };
    recognition.onerror=()=>{stopAudio();window.ReactNativeWebView.postMessage(JSON.stringify({type:'error'}));};
    recognition.onend=()=>{stopAudio();window.ReactNativeWebView.postMessage(JSON.stringify({type:'end'}));};
    recognition.start();
  }
}
function stopAudio(){
  clearInterval(window._audioIntv);
  if(micStream)micStream.getTracks().forEach(t=>t.stop());
  if(audioCtx)audioCtx.close().catch(()=>{});
}
function computeFingerprint(){
  if(!samples.length)return null;
  const avgVal=Math.round(samples.reduce((a,b)=>a+b.avg,0)/samples.length);
  const peaks=samples.map(s=>s.peak);
  const peakFreq=peaks.sort((a,b)=>peaks.filter(v=>v===b).length-peaks.filter(v=>v===a).length)[0];
  return{avgEnergy:avgVal,peakFreq};
}
function stopListening(){if(recognition)recognition.stop();stopAudio();}
<\/script></body></html>`;

  function fmtSecs(s) {
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  const statusLabel = callStatus === 'connecting' ? 'connessione...' : callStatus === 'thinking' ? 'sta pensando...' : 'in chiamata';

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onEnd}>
      <View style={cs.root}>
        <StatusBar barStyle="light-content" backgroundColor="#060610" />
        <View style={cs.avatarWrap}>
          <View style={cs.avatar}><Text style={cs.avatarEmoji}>E</Text></View>
        </View>
        <Text style={cs.name}>Echo</Text>
        {detectedSpk && <Text style={cs.speakerTag}>Parla: {detectedSpk}</Text>}
        <Text style={cs.statusTxt}>{statusLabel}</Text>
        <Text style={cs.timer}>{fmtSecs(callSecs)}</Text>
        <Waveform active={waveActive} />
        <Text style={cs.echoTxt} numberOfLines={4}>{callText}</Text>

        <WebView
          ref={webViewRef}
          source={{ html: speechHTML }}
          style={{ height:0, width:0, opacity:0 }}
          onMessage={(e) => {
            try {
              const msg = JSON.parse(e.nativeEvent.data);
              if (msg.type === 'result') handleVoiceResult(msg.transcript, msg.voiceData);
              if (msg.type === 'end' || msg.type === 'error') setListening(false);
            } catch (_) {}
          }}
          mediaPlaybackRequiresUserAction={false}
        />

        {!muted && (
          <TouchableOpacity
            style={[cs.voiceBtn, listening && cs.voiceBtnActive]}
            onPress={toggleVoice}
            disabled={!!thinkingRef.current}
          >
            <Text style={cs.voiceBtnTxt}>{listening ? 'ASCOLTANDO...' : 'TAP PER PARLARE'}</Text>
          </TouchableOpacity>
        )}

        <View style={cs.btnRow}>
          <TouchableOpacity style={[cs.btn, muted && cs.btnActive]} onPress={() => setMuted(m => !m)}>
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
  const isUser   = msg.role === 'user';
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[
      s.msgRow, isUser ? s.msgRowUser : s.msgRowAI,
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
    ]}>
      {msg.speakerName && (
        <Text style={s.speakerLabel}>{msg.speakerName}</Text>
      )}
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

  useEffect(() => {
    if (visible) {
      setProvider(cfg.provider); setApiKey(cfg.apiKey);
      setElKey(cfg.elKey); setElVoice(cfg.elVoice);
    }
  }, [visible, cfg]);

  const providers = [
    { value: 'groq',      label: 'Groq — Llama 3.3 70B (gratuito)' },
    { value: 'openai',    label: 'OpenAI — GPT-4o' },
    { value: 'anthropic', label: 'Anthropic — Claude' },
  ];

  const voicePresets = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (EN)' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (EN)' },
    { id: 'ErXwobaYiN019PkySvjV',  name: 'Antoni (EN)' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli (EN)' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh (EN)' },
    { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (EN)' },
    { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam (EN)' },
    { id: 'custom', name: 'Custom ID' },
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
              <TouchableOpacity key={p.value}
                style={[s.provBtn, provider === p.value && s.provBtnActive]}
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
                  <TouchableOpacity key={v.id}
                    style={[s.voiceChip, elVoice === v.id && s.voiceChipActive]}
                    onPress={() => setElVoice(v.id === 'custom' ? '' : v.id)}>
                    <Text style={[s.voiceChipTxt, elVoice === v.id && s.voiceChipTxtActive]}>{v.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {(elVoice === '' || !voicePresets.find(v => v.id === elVoice)) && (
              <TextInput style={[s.sInput, { marginTop: 6 }]} value={elVoice}
                onChangeText={setElVoice} placeholder="Custom Voice ID"
                placeholderTextColor="#4b5563" autoCapitalize="none" autoCorrect={false} />
            )}

            <TouchableOpacity style={s.saveBtn}
              onPress={() => onSave({ provider, apiKey: apiKey.trim(), elKey: elKey.trim(),
                                      elVoice: elVoice.trim() || '21m00Tcm4TlvDq8ikWAM' })}>
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
  const [ready,          setReady]        = useState(false);
  const [cfg,            setCfg]          = useState({ provider: 'groq', apiKey: '', elKey: '', elVoice: '21m00Tcm4TlvDq8ikWAM', languageFilter: false });
  const [hist,           setHist]         = useState([]);
  const [speakers,       setSpeakers]     = useState([]);
  const [currentSpeaker, setCurrentSpk]   = useState('');
  const [inputText,      setInputText]    = useState('');
  const [thinking,       setThinking]     = useState(false);
  const [status,         setStatus]       = useState('online');
  const [showSettings,   setShowSettings] = useState(false);
  const [showCall,       setShowCall]     = useState(false);
  const [showSpeakers,   setShowSpeakers] = useState(false);
  const [mood,           setMood]         = useState('chaotic');
  const [lastTimestamp,  setLastTimestamp] = useState(null);

  const scrollRef    = useRef(null);
  const initTimerRef = useRef(null);
  const histRef      = useRef([]);
  const cfgRef       = useRef(cfg);
  const moodRef      = useRef(mood);
  const thinkingRef  = useRef(false);
  const lastTsRef    = useRef(null);

  useEffect(() => { histRef.current     = hist;          }, [hist]);
  useEffect(() => { cfgRef.current      = cfg;           }, [cfg]);
  useEffect(() => { moodRef.current     = mood;          }, [mood]);
  useEffect(() => { thinkingRef.current = thinking;      }, [thinking]);
  useEffect(() => { lastTsRef.current   = lastTimestamp; }, [lastTimestamp]);

  function fmtTime() {
    return new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }
  function shiftMood() {
    const m = MOODS[Math.floor(Math.random() * MOODS.length)];
    setMood(m); moodRef.current = m;
  }

  // ─── Persistence ────────────────────────────────────────────────────────────
  const saveData = useCallback(async (newCfg, newHist, newSpeakers, ts) => {
    try {
      await AsyncStorage.multiSet([
        [STORAGE_KEY_CFG,     JSON.stringify(newCfg)],
        [STORAGE_KEY_HIST,    JSON.stringify(newHist.slice(-40))],
        [STORAGE_KEY_VOICES,  JSON.stringify(newSpeakers || [])],
        [STORAGE_KEY_LASTMSG, String(ts || Date.now())],
      ]);
    } catch (_) {}
  }, []);

  // ─── Boot ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [[, rawCfg], [, rawHist], [, rawVoices], [, rawTs]] = await AsyncStorage.multiGet([
          STORAGE_KEY_CFG, STORAGE_KEY_HIST, STORAGE_KEY_VOICES, STORAGE_KEY_LASTMSG
        ]);
        let loadedCfg    = cfg;
        let loadedHist   = [];
        let loadedVoices = [];
        let loadedTs     = null;
        if (rawCfg)    try { loadedCfg    = { ...cfg, ...JSON.parse(rawCfg) }; } catch (_) {}
        if (rawHist)   try { loadedHist   = JSON.parse(rawHist); }               catch (_) {}
        if (rawVoices) try { loadedVoices = JSON.parse(rawVoices); }              catch (_) {}
        if (rawTs)     loadedTs = parseInt(rawTs, 10);

        setCfg(loadedCfg);         cfgRef.current  = loadedCfg;
        setHist(loadedHist);       histRef.current = loadedHist;
        setSpeakers(loadedVoices);
        setLastTimestamp(loadedTs); lastTsRef.current = loadedTs;
      } catch (_) {}
      setReady(true);
      SplashScreen.hideAsync().catch(() => {});
    })();
  }, []);

  // ─── Proactive messages ──────────────────────────────────────────────────────
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
          saveData(cfgRef.current, next, speakers, lastTsRef.current);
          return next;
        });
      }
      scheduleInit();
    }, delay);
  }, [saveData, showCall, speakers]);

  useEffect(() => {
    if (ready) scheduleInit();
    return () => clearTimeout(initTimerRef.current);
  }, [ready, scheduleInit]);

  // ─── Android back ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showSpeakers) { setShowSpeakers(false); return true; }
      if (showSettings) { setShowSettings(false); return true; }
      if (showCall)     { setShowCall(false);      return true; }
      return false;
    });
    return () => sub.remove();
  }, [showSettings, showCall, showSpeakers]);

  // ─── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (hist.length > 0) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [hist]);

  // ─── Add message to history (used by CallScreen) ──────────────────────────
  const addToHist = useCallback((msg) => {
    const now = Date.now();
    const full = { ...msg, time: fmtTime() };
    setLastTimestamp(now); lastTsRef.current = now;
    setHist(h => {
      const next = [...h, full];
      histRef.current = next;
      saveData(cfgRef.current, next, speakers, now);
      return next;
    });
  }, [saveData, speakers]);

  // ─── Send chat message ────────────────────────────────────────────────────
  const sendMsg = useCallback(async (text) => {
    const t = (text || inputText).trim();
    if (!t || thinkingRef.current) return;
    Keyboard.dismiss();
    setInputText('');

    const now = Date.now();
    const userMsg = { role: 'user', content: t, time: fmtTime(), speakerName: currentSpeaker || undefined };
    const nextHist = [...histRef.current, userMsg];
    setHist(nextHist); histRef.current = nextHist;
    setLastTimestamp(now); lastTsRef.current = now;

    if (!cfgRef.current.apiKey) {
      const e = { role: 'assistant', content: 'Metti la API key nelle impostazioni', time: fmtTime() };
      const withE = [...nextHist, e];
      setHist(withE); histRef.current = withE;
      return;
    }

    setThinking(true); thinkingRef.current = true;
    setStatus('sta scrivendo...');
    if (Math.random() < 0.2) shiftMood();

    if (moodRef.current === 'cold') {
      const roll = Math.random();
      if (roll < 0.15) {
        setThinking(false); thinkingRef.current = false;
        setStatus('online'); return;
      } else if (roll < 0.75) {
        await new Promise(res => setTimeout(res, 8000 + Math.floor(Math.random() * 12000)));
      }
    }

    try {
      const reply = await callAI(
        cfgRef.current,
        histRef.current,
        moodRef.current,
        false,
        cfgRef.current.languageFilter || false,
        currentSpeaker,
        lastTsRef.current
      );
      const aiMsg = { role: 'assistant', content: reply, time: fmtTime() };
      const replyTs = Date.now();
      setHist(h => {
        const updated = [...h, aiMsg];
        histRef.current = updated;
        saveData(cfgRef.current, updated, speakers, replyTs);
        return updated;
      });
      setLastTimestamp(replyTs); lastTsRef.current = replyTs;
      setStatus('online');
    } catch (err) {
      const e = { role: 'assistant', content: 'Errore: ' + err.message, time: fmtTime() };
      const withE = [...histRef.current, e];
      setHist(withE); histRef.current = withE;
      setStatus('online');
    } finally {
      setThinking(false); thinkingRef.current = false;
    }
  }, [inputText, saveData, currentSpeaker, speakers]);

  // ─── End call ─────────────────────────────────────────────────────────────
  const handleEndCall = useCallback(() => {
    Speech.stop();
    setShowCall(false);
    const endMsg = { role: 'assistant', content: 'chiamata terminata', time: fmtTime() };
    const now = Date.now();
    setHist(h => {
      const next = [...h, endMsg];
      histRef.current = next;
      saveData(cfgRef.current, next, speakers, now);
      return next;
    });
    setLastTimestamp(now); lastTsRef.current = now;
  }, [saveData, speakers]);

  // ─── Save settings ────────────────────────────────────────────────────────
  const handleSaveSettings = useCallback((newCfg) => {
    setCfg(newCfg); cfgRef.current = newCfg;
    setShowSettings(false);
    saveData(newCfg, histRef.current, speakers, lastTsRef.current);
    const ok = { role: 'assistant', content: 'Ok.', time: fmtTime() };
    setHist(h => { const n = [...h, ok]; histRef.current = n; return n; });
  }, [saveData, speakers]);

  // ─── Save speakers ────────────────────────────────────────────────────────
  const handleSaveSpeakers = useCallback((newSpeakers) => {
    setSpeakers(newSpeakers);
    saveData(cfgRef.current, histRef.current, newSpeakers, lastTsRef.current);
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

        <TouchableOpacity style={[s.hBtn, s.hBtnCall]} onPress={() => {
          if (!cfgRef.current.apiKey) {
            const e = { role: 'assistant', content: 'Prima metti la API key', time: fmtTime() };
            setHist(h => { const n = [...h, e]; histRef.current = n; return n; }); return;
          }
          setShowCall(true);
        }}>
          <Text style={s.hBtnTxt}>CALL</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.hBtn, speakers.length > 0 && s.hBtnSpeakerActive]} onPress={() => setShowSpeakers(true)}>
          <Text style={[s.hBtnTxt, speakers.length > 0 && { color: '#a78bfa' }]}>VOC</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.hBtn, cfg.languageFilter && s.hBtnFilterActive]}
          onPress={() => {
            const newCfg = { ...cfg, languageFilter: !cfg.languageFilter };
            setCfg(newCfg); cfgRef.current = newCfg;
            saveData(newCfg, histRef.current, speakers, lastTsRef.current);
            const msg = { role: 'assistant', content: newCfg.languageFilter ? 'Filtro attivato.' : 'Filtro off.', time: fmtTime() };
            setHist(h => { const n = [...h, msg]; histRef.current = n; return n; });
          }}>
          <Text style={[s.hBtnTxt, cfg.languageFilter && s.hBtnTxtActive]}>{cfg.languageFilter ? 'SAFE' : 'RAW'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.hBtn} onPress={() => setShowSettings(true)}>
          <Text style={s.hBtnTxt}>SET</Text>
        </TouchableOpacity>
      </View>

      {/* Speaker selector bar */}
      {speakers.length > 0 && (
        <View style={s.speakerBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[s.spkChip, !currentSpeaker && s.spkChipActive]}
              onPress={() => setCurrentSpk('')}>
              <Text style={[s.spkChipTxt, !currentSpeaker && s.spkChipTxtActive]}>Nessuno</Text>
            </TouchableOpacity>
            {speakers.map(sp => (
              <TouchableOpacity key={sp.id}
                style={[s.spkChip, currentSpeaker === sp.name && s.spkChipActive]}
                onPress={() => setCurrentSpk(sp.name)}>
                <Text style={[s.spkChipTxt, currentSpeaker === sp.name && s.spkChipTxtActive]}>{sp.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Chat */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView ref={scrollRef} style={s.messages} contentContainerStyle={s.messagesContent}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {hist.length === 0 && (
            <View style={s.welcome}>
              <View style={s.wav}><Text style={{ fontSize: 34, color: '#fff', fontWeight: '700' }}>E</Text></View>
              <Text style={s.welcomeTitle}>Sono Echo.</Text>
              <Text style={s.welcomeSub}>Parla, se hai qualcosa da dire.</Text>
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

      <CallScreen
        visible={showCall}
        cfg={cfgRef.current}
        hist={hist}
        histRef={histRef}
        mood={mood}
        moodRef={moodRef}
        speakers={speakers}
        currentSpeaker={currentSpeaker}
        lastTimestamp={lastTimestamp}
        onEnd={handleEndCall}
        onAddToHist={addToHist}
      />

      <SettingsSheet
        visible={showSettings}
        cfg={cfg}
        onSave={handleSaveSettings}
        onClose={() => setShowSettings(false)}
      />

      <SpeakerManager
        visible={showSpeakers}
        speakers={speakers}
        onSave={handleSaveSpeakers}
        onClose={() => setShowSpeakers(false)}
      />
    </SafeAreaView>
  );
}

// ─── Call screen styles ───────────────────────────────────────────────────────
const cs = StyleSheet.create({
  root:           { flex:1, backgroundColor:'#060610', alignItems:'center', justifyContent:'center', paddingHorizontal:24 },
  avatarWrap:     { marginBottom:16 },
  avatar:         { width:120, height:120, borderRadius:60, backgroundColor:'#1a0a3e', alignItems:'center', justifyContent:'center',
                    borderWidth:2, borderColor:'#8b5cf6', shadowColor:'#8b5cf6', shadowOffset:{width:0,height:0}, shadowOpacity:0.8, shadowRadius:20, elevation:20 },
  avatarEmoji:    { fontSize:60 },
  name:           { color:'#fff', fontSize:28, fontWeight:'700', letterSpacing:1, marginBottom:4 },
  speakerTag:     { color:'#a78bfa', fontSize:11, letterSpacing:1, marginBottom:2 },
  statusTxt:      { color:'#8b5cf6', fontSize:12, letterSpacing:2, textTransform:'uppercase', marginBottom:4 },
  timer:          { color:'#4b5563', fontSize:13, fontVariant:['tabular-nums'], marginBottom:24 },
  waveform:       { flexDirection:'row', gap:5, alignItems:'center', height:48, marginBottom:20 },
  waveBar:        { width:4, borderRadius:2 },
  echoTxt:        { color:'#9ca3af', fontSize:14, textAlign:'center', fontStyle:'italic', lineHeight:22, minHeight:60, paddingHorizontal:16, marginBottom:24 },
  voiceBtn:       { width:'90%', paddingVertical:18, borderRadius:30, backgroundColor:'#8b5cf6', alignItems:'center', marginBottom:32,
                    shadowColor:'#8b5cf6', shadowOffset:{width:0,height:0}, shadowOpacity:0.6, shadowRadius:12, elevation:12 },
  voiceBtnActive: { backgroundColor:'#ef4444', shadowColor:'#ef4444' },
  voiceBtnTxt:    { color:'#fff', fontSize:14, fontWeight:'700', letterSpacing:1.5 },
  btnRow:         { flexDirection:'row', gap:40, alignItems:'center' },
  btn:            { alignItems:'center', width:64, height:64, borderRadius:32, backgroundColor:'#1a1a2e', justifyContent:'center' },
  btnActive:      { backgroundColor:'#8b5cf6' },
  btnLabel:       { color:'#6b7280', fontSize:10, fontWeight:'600', textTransform:'uppercase' },
  endBtn:         { width:70, height:70, borderRadius:35, backgroundColor:'#dc2626', alignItems:'center', justifyContent:'center',
                    shadowColor:'#ef4444', shadowOffset:{width:0,height:0}, shadowOpacity:0.6, shadowRadius:12, elevation:12 },
  endBtnTxt:      { color:'#fff', fontSize:11, fontWeight:'700', letterSpacing:0.5 },
});

// ─── Speaker Manager styles ───────────────────────────────────────────────────
const spkStyles = StyleSheet.create({
  row:          { flexDirection:'row', alignItems:'center', backgroundColor:'#1c1c28', borderRadius:12, padding:12, marginBottom:8, gap:8 },
  info:         { flex:1 },
  name:         { color:'#f1f5f9', fontSize:14, fontWeight:'600' },
  status:       { color:'#6b7280', fontSize:11, marginTop:2 },
  recBtn:       { backgroundColor:'#1e1040', borderWidth:1, borderColor:'#8b5cf6', borderRadius:8, paddingHorizontal:10, paddingVertical:6 },
  recBtnActive: { backgroundColor:'#dc2626', borderColor:'#ef4444' },
  recBtnTxt:    { color:'#a78bfa', fontSize:10, fontWeight:'700' },
  delBtn:       { width:28, height:28, borderRadius:14, backgroundColor:'#2d1a1a', alignItems:'center', justifyContent:'center' },
  delBtnTxt:    { color:'#ef4444', fontSize:12, fontWeight:'700' },
  addRow:       { flexDirection:'row', alignItems:'center', gap:8, marginBottom:16 },
  addBtn:       { width:44, height:44, borderRadius:22, backgroundColor:'#8b5cf6', alignItems:'center', justifyContent:'center' },
  addBtnTxt:    { color:'#fff', fontSize:22, fontWeight:'300' },
});

// ─── Chat styles ──────────────────────────────────────────────────────────────
const PURPLE = '#a78bfa';
const DARK   = '#0f0f14';
const CARD   = '#1c1c28';
const BORDER = '#2d2d40';
const TEXT   = '#f1f5f9';
const MUTED  = '#64748b';

const s = StyleSheet.create({
  splash:       { flex:1, backgroundColor:DARK, alignItems:'center', justifyContent:'center' },
  splashAvatar: { width:100, height:100, borderRadius:50, backgroundColor:PURPLE, alignItems:'center', justifyContent:'center', marginBottom:20 },
  splashEmoji:  { fontSize:48 },
  splashName:   { color:'#fff', fontSize:28, fontWeight:'700', letterSpacing:3, marginBottom:6 },
  splashSub:    { color:'#6b7280', fontSize:12, letterSpacing:1 },

  root:            { flex:1, backgroundColor:DARK },
  messages:        { flex:1 },
  messagesContent: { padding:16, paddingBottom:8, gap:10 },

  header:   { flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:12,
              backgroundColor:'#0f0f1a', borderBottomWidth:1, borderBottomColor:'#1a1a2e', gap:8 },
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
  hBtnCall:          { backgroundColor:'#1a3020' },
  hBtnFilterActive:  { backgroundColor:'#f59e0b', borderWidth:1, borderColor:'#fbbf24' },
  hBtnSpeakerActive: { backgroundColor:'#1e1040', borderWidth:1, borderColor:'#8b5cf6' },
  hBtnTxt:       { color:'#9ca3af', fontSize:9, fontWeight:'700', letterSpacing:0.5 },
  hBtnTxtActive: { color:'#000' },

  speakerBar: { flexDirection:'row', paddingHorizontal:12, paddingVertical:8,
                backgroundColor:'#0f0f1a', borderBottomWidth:1, borderBottomColor:'#1a1a2e' },
  spkChip:       { backgroundColor:CARD, borderWidth:1, borderColor:BORDER, borderRadius:14, paddingHorizontal:12, paddingVertical:5, marginRight:6 },
  spkChipActive: { backgroundColor:'#1e1040', borderColor:PURPLE },
  spkChipTxt:       { color:'#6b7280', fontSize:12, fontWeight:'500' },
  spkChipTxtActive: { color:PURPLE, fontWeight:'600' },

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
  speakerLabel:  { color:'#6b7280', fontSize:10, marginBottom:2, paddingHorizontal:4 },

  typingWrap: { flexDirection:'row', gap:5, alignItems:'center', paddingVertical:6 },
  typingDot:  { width:8, height:8, borderRadius:4, backgroundColor:PURPLE },

  welcome:      { alignItems:'center', paddingVertical:40, paddingHorizontal:24 },
  wav:          { width:80, height:80, borderRadius:40, backgroundColor:PURPLE, alignItems:'center', justifyContent:'center', marginBottom:20,
                  shadowColor:PURPLE, shadowOffset:{width:0,height:0}, shadowOpacity:0.4, shadowRadius:16, elevation:8 },
  welcomeTitle: { color:TEXT, fontSize:24, fontWeight:'700', marginBottom:10, letterSpacing:0.5 },
  welcomeSub:   { color:'#6b7280', fontSize:14, lineHeight:22, marginBottom:24, textAlign:'center', opacity:0.8 },
  chips:        { flexDirection:'row', flexWrap:'wrap', gap:10, justifyContent:'center' },
  chip:         { backgroundColor:CARD, borderWidth:1, borderColor:BORDER, borderRadius:20, paddingHorizontal:15, paddingVertical:9 },
  chipTxt:      { color:'#a78bfa', fontSize:13, fontWeight:'500' },

  inputBar:        { flexDirection:'row', alignItems:'flex-end', paddingHorizontal:14, paddingVertical:12,
                     backgroundColor:'#0f0f1a', borderTopWidth:1, borderTopColor:'#1a1a2e', gap:10 },
  input:           { flex:1, backgroundColor:CARD, borderWidth:1, borderColor:BORDER, borderRadius:22, color:TEXT,
                     fontSize:15, paddingHorizontal:16, paddingVertical:11, maxHeight:100, minHeight:44 },
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
