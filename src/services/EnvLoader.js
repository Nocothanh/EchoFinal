/**
 * EnvLoader.js - Caricamento sicuro delle variabili di ambiente
 * Priorità: SecureStore > .env (file di ambiente)
 * 
 * Questo allows gli utenti di configurare le API keys direttamente
 * dall'app, con salvataggio sicuro in SecureStore.
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
import { secureKeyStore, STORAGE_KEYS } from './SecureKeyStore';
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from '../config/providers';

class EnvironmentLoader {
  constructor() {
    this.env = {};
    this.initialized = false;
    this.listeners = [];
  }

  /**
   * Carica e valida variabili di ambiente
   * Priorità: SecureStore > .env
   */
  async init() {
    try {
      // 1. Carica valori base da .env
      this.env = {
        // LLM Configuration
        provider: DEFAULT_PROVIDER,
        groq: {
          apiKey: GROQ_API_KEY || '',
          model: GROQ_MODEL || 'llama-3.3-70b-versatile',
        },
        openai: {
          apiKey: '',
          model: 'gpt-4o',
        },
        anthropic: {
          apiKey: '',
          model: 'claude-3-5-sonnet-20241022',
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

      // 2. Inizializza SecureStore e sovrascrivi con valori salvati
      await secureKeyStore.init();
      this._loadFromSecureStore();

      // 3. Validazione credenziali critiche
      this._validateCredentials();

      this.initialized = true;
      logger.info('EnvLoader', 'Environment loaded successfully', {
        nodeEnv: this.env.nodeEnv,
        wakeWord: this.env.jarvis.wakeWord,
        provider: this.env.provider,
      });
    } catch (error) {
      logger.error('EnvLoader', 'Failed to load environment', error);
      throw error;
    }
  }

  /**
   * Carica valori da SecureStore e sovrascrivi .env
   */
  _loadFromSecureStore() {
    // Provider selezionato
    const selectedProvider = secureKeyStore.getKey('SELECTED_PROVIDER');
    if (selectedProvider) {
      this.env.provider = selectedProvider;
    }

    // Groq
    const groqKey = secureKeyStore.getKey('GROQ_API_KEY');
    if (groqKey) {
      this.env.groq.apiKey = groqKey;
    }
    const groqModel = secureKeyStore.getKey('GROQ_MODEL');
    if (groqModel) {
      this.env.groq.model = groqModel;
    }

    // OpenAI
    const openaiKey = secureKeyStore.getKey('OPENAI_API_KEY');
    if (openaiKey) {
      this.env.openai.apiKey = openaiKey;
    }
    const openaiModel = secureKeyStore.getKey('OPENAI_MODEL');
    if (openaiModel) {
      this.env.openai.model = openaiModel;
    }

    // Anthropic
    const anthropicKey = secureKeyStore.getKey('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.env.anthropic.apiKey = anthropicKey;
    }
    const anthropicModel = secureKeyStore.getKey('ANTHROPIC_MODEL');
    if (anthropicModel) {
      this.env.anthropic.model = anthropicModel;
    }

    // ElevenLabs
    const elKey = secureKeyStore.getKey('ELEVENLABS_API_KEY');
    if (elKey) {
      this.env.elevenlabs.apiKey = elKey;
    }
    const elVoice = secureKeyStore.getKey('ELEVENLABS_VOICE_ID');
    if (elVoice) {
      this.env.elevenlabs.voiceId = elVoice;
    }

    logger.info('EnvLoader', 'Loaded from SecureStore', {
      provider: this.env.provider,
      hasGroqKey: !!this.env.groq.apiKey,
      hasOpenaiKey: !!this.env.openai.apiKey,
      hasAnthropicKey: !!this.env.anthropic.apiKey,
    });
  }

  /**
   * Valida che le credenziali essenziali siano presenti
   */
  _validateCredentials() {
    const missing = [];
    const provider = this.env.provider;

    // Controlla chiave per il provider selezionato
    if (provider === 'groq' && !this.env.groq.apiKey) {
      missing.push('GROQ_API_KEY');
      logger.warn('EnvLoader', 'Groq API key not configured');
    } else if (provider === 'openai' && !this.env.openai.apiKey) {
      missing.push('OPENAI_API_KEY');
      logger.warn('EnvLoader', 'OpenAI API key not configured');
    } else if (provider === 'anthropic' && !this.env.anthropic.apiKey) {
      missing.push('ANTHROPIC_API_KEY');
      logger.warn('EnvLoader', 'Anthropic API key not configured');
    }

    // Controlla almeno un provider disponibile
    const hasAnyKey = this.env.groq.apiKey || this.env.openai.apiKey || this.env.anthropic.apiKey;
    if (!hasAnyKey) {
      logger.warn('EnvLoader', 'No LLM provider configured - app needs API key to work');
    }

    if (!this.env.elevenlabs.apiKey) {
      logger.warn('EnvLoader', 'ElevenLabs API key not configured - using expo-speech fallback');
    }

    if (missing.length > 0) {
      logger.warn('EnvLoader', `Missing keys for selected provider: ${missing.join(', ')}`);
    }
  }

  /**
   * Aggiorna una chiave API e salva in SecureStore
   */
  async updateKey(provider, apiKey, model = null) {
    const providerUpper = provider.toUpperCase();
    
    // Salva API key
    await secureKeyStore.setKey(`${providerUpper}_API_KEY`, apiKey);
    
    // Salva modello se fornito
    if (model) {
      await secureKeyStore.setKey(`${providerUpper}_MODEL`, model);
    }

    // Aggiorna env in memoria
    if (this.env[provider]) {
      this.env[provider].apiKey = apiKey;
      if (model) {
        this.env[provider].model = model;
      }
    }

    this._notifyListeners();
    logger.info('EnvLoader', `Updated ${provider} configuration`);
  }

  /**
   * Cambia provider attivo
   */
  async setProvider(provider) {
    this.env.provider = provider;
    await secureKeyStore.setKey('SELECTED_PROVIDER', provider);
    this._notifyListeners();
    logger.info('EnvLoader', `Provider changed to ${provider}`);
  }

  /**
   * Aggiorna ElevenLabs config
   */
  async updateElevenLabs(apiKey, voiceId) {
    if (apiKey !== undefined) {
      await secureKeyStore.setKey('ELEVENLABS_API_KEY', apiKey);
      this.env.elevenlabs.apiKey = apiKey;
    }
    if (voiceId !== undefined) {
      await secureKeyStore.setKey('ELEVENLABS_VOICE_ID', voiceId);
      this.env.elevenlabs.voiceId = voiceId;
    }
    this._notifyListeners();
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
      provider: this.env.provider,
      // NON esporre API keys
    };
  }

  /**
   * Ottieni configurazione corrente (per schermata impostazioni)
   */
  getConfig() {
    return {
      provider: this.env.provider,
      groq: {
        apiKey: this.env.groq.apiKey ? '••••••••' : '',
        model: this.env.groq.model,
        configured: !!this.env.groq.apiKey,
      },
      openai: {
        apiKey: this.env.openai.apiKey ? '••••••••' : '',
        model: this.env.openai.model,
        configured: !!this.env.openai.apiKey,
      },
      anthropic: {
        apiKey: this.env.anthropic.apiKey ? '••••••••' : '',
        model: this.env.anthropic.model,
        configured: !!this.env.anthropic.apiKey,
      },
      elevenlabs: {
        apiKey: this.env.elevenlabs.apiKey ? '••••••••' : '',
        voiceId: this.env.elevenlabs.voiceId,
        voiceName: this.env.elevenlabs.voiceName,
        configured: !!this.env.elevenlabs.apiKey,
      },
    };
  }

  /**
   * Verifica se l'app è configurata (almeno un provider LLM)
   */
  isConfigured() {
    const provider = this.env.provider;
    if (provider === 'groq') return !!this.env.groq.apiKey;
    if (provider === 'openai') return !!this.env.openai.apiKey;
    if (provider === 'anthropic') return !!this.env.anthropic.apiKey;
    return false;
  }

  /**
   * Verifica se almeno un provider è configurato
   */
  hasAnyProvider() {
    return !!(this.env.groq.apiKey || this.env.openai.apiKey || this.env.anthropic.apiKey);
  }

  /**
   * Listener per cambiamenti di configurazione
   */
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  _notifyListeners() {
    this.listeners.forEach(cb => {
      try { cb(this.env); } catch (e) {}
    });
  }

  /**
   * Reset tutte le impostazioni
   */
  async resetAll() {
    await secureKeyStore.clearAll();
    this.env.groq.apiKey = '';
    this.env.openai.apiKey = '';
    this.env.anthropic.apiKey = '';
    this.env.elevenlabs.apiKey = '';
    this.env.provider = DEFAULT_PROVIDER;
    this._notifyListeners();
    logger.info('EnvLoader', 'All settings reset');
  }
}

export const envLoader = new EnvironmentLoader();
export default EnvironmentLoader;
