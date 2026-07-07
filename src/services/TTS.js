// TTS with an internal segment queue. Segments are enqueued as the LLM
// produces sentence/clause-sized text; each segment is spoken in order.
// ElevenLabs is attempted per-segment; on failure we fall back to
// expo-speech for that segment only. `stopSpeech` clears the queue and
// unloads any active expo-av sound to avoid overlapping audio.

import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

let currentSound = null;
let isSpeaking = false;
let queue = [];
let processing = false;
let stopRequested = false;
let globalCallbacks = null; // { onStart, onDone } for the current "utterance"
let startedEmitted = false;

async function unloadCurrentSound() {
  if (currentSound) {
    try { await currentSound.unloadAsync(); } catch (_) {}
    currentSound = null;
  }
}

export async function stopSpeech() {
  stopRequested = true;
  queue = [];
  await unloadCurrentSound();
  try { Speech.stop(); } catch (_) {}
  isSpeaking = false;
  processing = false;
  startedEmitted = false;
  globalCallbacks = null;
  stopRequested = false;
}

function speakWithExpo(text, lang) {
  return new Promise((resolve) => {
    try {
      Speech.speak(text, {
        language: lang || 'it-IT',
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    } catch (_) {
      resolve();
    }
  });
}

async function playElevenLabsSegment(text, cfg) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${cfg.elVoice}`, {
    method: 'POST',
    headers: { 'xi-api-key': cfg.elKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
  const blob = await res.blob();

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      try { resolve(String(reader.result).split(',')[1]); }
      catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const { sound } = await Audio.Sound.createAsync(
    { uri: `data:audio/mpeg;base64,${base64}` },
    { shouldPlay: true },
  );
  currentSound = sound;

  await new Promise((resolve) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status) return;
      if (status.didJustFinish || status.error) {
        sound.unloadAsync().catch(() => {});
        if (currentSound === sound) currentSound = null;
        resolve();
      }
    });
  });
}

async function playSegment(segment) {
  const { text, cfg } = segment;
  if (!text) return;

  if (cfg.elKey && cfg.elVoice) {
    try {
      await playElevenLabsSegment(text, cfg);
      return;
    } catch (_) {
      // Per-segment fallback to expo-speech.
    }
  }
  await speakWithExpo(text, cfg.lang);
}

async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0 && !stopRequested) {
      const segment = queue.shift();
      if (!startedEmitted) {
        startedEmitted = true;
        try { globalCallbacks?.onStart?.(); } catch (_) {}
      }
      await playSegment(segment);
    }
  } finally {
    processing = false;
    if (queue.length === 0 && !stopRequested) {
      const done = globalCallbacks?.onDone;
      // Only emit onDone if no more segments have been enqueued mid-drain.
      if (queue.length === 0) {
        isSpeaking = false;
        startedEmitted = false;
        globalCallbacks = null;
        try { done?.(); } catch (_) {}
      }
    }
  }
}

/**
 * speak(text, cfg, callbacks)
 *
 * Enqueues `text` as a segment. If nothing is currently speaking, this
 * begins a new utterance (onStart fires on first playback). Additional
 * calls append to the queue; existing playback is NOT interrupted.
 * To interrupt, call stopSpeech() first (the hook does this on new turns).
 */
export async function speak(text, cfg = {}, callbacks = {}) {
  const clean = String(text || '').trim();
  if (!clean) return;

  if (!isSpeaking) {
    isSpeaking = true;
    startedEmitted = false;
    globalCallbacks = callbacks;
  } else if (callbacks && (callbacks.onStart || callbacks.onDone)) {
    // Later enqueues can update the onDone terminator without dropping the
    // in-flight onStart contract.
    globalCallbacks = { ...(globalCallbacks || {}), ...callbacks };
  }

  queue.push({ text: clean, cfg });
  processQueue();
}

export function speaking() { return isSpeaking; }
