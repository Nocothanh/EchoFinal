/**
 * EnvLoader.js - Caricamento sicuro delle variabili di ambiente
 * Protegge le credenziali e fornisce fallback sicuri
 */

import {
  GROQ_API_KEY,
  GROQ_MODEL,
  ELEVENLABS_API_KEY,
  ELEVENLABS_VOICE_ID,
  ELEVENLABS_VOICE_NAME,
  NODE_ENV,
  JARVIS_USER_NAME,
  JARVIS_TIMEZONE,
  JARVIS_WAKE_WORD,
  DEBUG_MODE,
} from '@env';

import { logger } from '../utils/Logger';

class EnvironmentLoader {
  constructor() {
    this.env = {};
    this.initialized = false;
  }

  /**
   * Carica e valida variabili di ambiente
   */
  async init() {
    try {
      this.env = {
        // LLM Configuration
        groq: {
          apiKey: GROQ_API_KEY || '',
          model: GROQ_MODEL || 'llama-3.3-70b-versatile',
        },

        // TTS Configuration
        elevenlabs: {
          apiKey: ELEVENLABS_API_KEY || '',
          voiceId: ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
          voiceName: ELEVENLABS_VOICE_NAME || 'Bella',
        },

        // Build Config
        nodeEnv: NODE_ENV || 'production',
        isProduction: (NODE_ENV || 'production') === 'production',
        isDevelopment: (NODE_ENV || 'production') === 'development',

        // Jarvis Config
        jarvis: {
          userName: JARVIS_USER_NAME || 'User',
          timezone: JARVIS_TIMEZONE || 'Europe/Rome',
          wakeWord: JARVIS_WAKE_WORD || 'Echo',
        },

        // Debug
        debugMode: DEBUG_MODE === 'true',
      };

      // Validazione credenziali critiche
      this._validateCredentials();

      this.initialized = true;
      logger.info('EnvLoader', 'Environment loaded successfully', {
        nodeEnv: this.env.nodeEnv,
        wakeWord: this.env.jarvis.wakeWord,
      });
    } catch (error) {
      logger.error('EnvLoader', 'Failed to load environment', error);
      throw error;
    }
  }

  /**
   * Valida che le credenziali essenziali siano presenti
   */
  _validateCredentials() {
    const missing = [];

    if (!this.env.groq.apiKey) {
      missing.push('GROQ_API_KEY');
      logger.warn('EnvLoader', 'Groq API key not configured');
    }

    if (!this.env.elevenlabs.apiKey) {
      logger.warn('EnvLoader', 'ElevenLabs API key not configured - using expo-speech fallback');
    }

    if (missing.length > 0) {
      logger.warn('EnvLoader', `Missing environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Ottieni valore di ambiente
   */
  get(path) {
    const keys = path.split('.');
    let value = this.env;
    for (const key of keys) {
      value = value?.[key];
    }
    return value;
  }

  /**
   * Ottieni tutte le variabili (senza credenziali sensibili)
   */
  getPublic() {
    return {
      nodeEnv: this.env.nodeEnv,
      jarvis: this.env.jarvis,
      debugMode: this.env.debugMode,
      // NON esporre API keys
    };
  }

  /**
   * Verifica se l'app è configurata
   */
  isConfigured() {
    return this.env.groq.apiKey && this.env.elevenlabs.apiKey;
  }
}

export const envLoader = new EnvironmentLoader();
export default EnvironmentLoader;
