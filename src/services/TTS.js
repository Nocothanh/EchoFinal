// Lightweight TTS wrapper. Uses expo-speech fallback and supports ElevenLabs if API key provided.
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

let currentSound = null;
let isSpeaking = false;

export async function stopSpeech() {
  if (currentSound) {
    try { await currentSound.unloadAsync(); currentSound = null; } catch (_) {}
  }
  Speech.stop();
  isSpeaking = false;
}

export async function speak(text, cfg = {}, callbacks = {}) {
  const { onStart, onDone } = callbacks;
  await stopSpeech();
  isSpeaking = true;
  onStart?.();

  // ElevenLabs path
  if (cfg.elKey && cfg.elVoice) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${cfg.elVoice}`, {
        method: 'POST', headers: { 'xi-api-key': cfg.elKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64 = reader.result.split(',')[1];
            const { sound } = await Audio.Sound.createAsync({ uri: `data:audio/mpeg;base64,${base64}` }, { shouldPlay: true });
            currentSound = sound;
            sound.setOnPlaybackStatusUpdate((status) => {
              if (status.didJustFinish) {
                sound.unloadAsync().catch(() => {});
                currentSound = null; isSpeaking = false; onDone?.();
              }
            });
          } catch (e) {
            Speech.speak(text, { onDone: () => { isSpeaking = false; onDone?.(); }, language: cfg.lang || 'it-IT' });
          }
        };
        reader.readAsDataURL(blob);
        return;
      }
    } catch (e) {
      // fallthrough to expo-speech
    }
  }

  Speech.speak(text, { language: cfg.lang || 'it-IT', onDone: () => { isSpeaking = false; onDone?.(); } });
}

export function speaking() { return isSpeaking; }
