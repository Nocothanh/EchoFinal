let cachedModule = null;
let cachedEmitter = null;
let loadAttempted = false;
let activeSubscriptions = [];

// In expo-speech-recognition (sdk-51 build), imperative methods live on
// ExpoSpeechRecognitionModule while events are dispatched through the separate
// ExpoSpeechRecognitionModuleEmitter. Load both, tolerating absence (Expo Go).
async function loadModule() {
  if (loadAttempted) {
    return cachedModule;
  }

  loadAttempted = true;

  try {
    const mod = await import('expo-speech-recognition');
    cachedModule = mod?.ExpoSpeechRecognitionModule || null;
    cachedEmitter = mod?.ExpoSpeechRecognitionModuleEmitter || null;
    return cachedModule;
  } catch {
    cachedModule = null;
    cachedEmitter = null;
    return null;
  }
}

function getEmitter() {
  return cachedEmitter || cachedModule;
}

function cleanupSubscriptions() {
  for (const sub of activeSubscriptions) {
    try {
      sub?.remove?.();
    } catch {
      // Ignore listener cleanup issues.
    }
  }
  activeSubscriptions = [];
}

function getTranscript(event) {
  const result = event?.results?.[0];
  if (!result) {
    return '';
  }

  return String(result.transcript || '').trim();
}

export const VoiceInput = {
  async isAvailable() {
    try {
      const module = await loadModule();
      return Boolean(
        module &&
          typeof module.start === 'function' &&
          typeof module.stop === 'function' &&
          typeof module.requestPermissionsAsync === 'function',
      );
    } catch {
      return false;
    }
  },

  async requestPermissions() {
    try {
      const module = await loadModule();
      if (!module?.requestPermissionsAsync) {
        return { granted: false };
      }
      return await module.requestPermissionsAsync();
    } catch {
      return { granted: false };
    }
  },

  async start({ onPartial, onResult, onError, lang = 'it-IT' } = {}) {
    try {
      const module = await loadModule();
      if (!module?.start) {
        throw new Error('Speech recognition non disponibile');
      }

      cleanupSubscriptions();

      const emitter = getEmitter();

      if (typeof emitter?.removeAllListeners === 'function') {
        try {
          emitter.removeAllListeners('result');
          emitter.removeAllListeners('error');
          emitter.removeAllListeners('end');
        } catch {
          // Ignore listener reset problems.
        }
      }

      activeSubscriptions.push(
        emitter?.addListener?.('result', (event) => {
          const transcript = getTranscript(event);
          if (!transcript) {
            return;
          }

          if (event?.isFinal) {
            onResult?.(transcript, event);
          } else {
            onPartial?.(transcript, event);
          }
        }),
      );

      activeSubscriptions.push(
        emitter?.addListener?.('error', (event) => {
          onError?.(event);
        }),
      );

      activeSubscriptions.push(
        emitter?.addListener?.('end', () => {
          cleanupSubscriptions();
        }),
      );

      module.start({
        lang,
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
      });

      return true;
    } catch (error) {
      cleanupSubscriptions();
      onError?.(error);
      return false;
    }
  },

  async stop() {
    try {
      const module = await loadModule();
      if (!module) {
        cleanupSubscriptions();
        return;
      }

      if (typeof module.stop === 'function') {
        module.stop();
      } else if (typeof module.abort === 'function') {
        module.abort();
      }
    } catch {
      // Ignore stop failures.
    } finally {
      cleanupSubscriptions();
    }
  },
};

export default VoiceInput;
