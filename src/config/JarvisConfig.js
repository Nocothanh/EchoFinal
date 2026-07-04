/**
 * JarvisConfig.js - Centralizzazione della configurazione globale per Jarvis AI
 * Gestisce: API keys, modelli, impostazioni TTS, profilo utente
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_CONFIG = {
  // LLM Configuration
  llm: {
    provider: 'groq', // 'groq', 'openai', 'anthropic'
    apiKey: '',
    model: 'llama-3.3-70b-versatile', // Groq's fastest model for Jarvis
    temperature: 0.7,
    maxTokens: 200,
    requestTimeout: 10000,
    retryAttempts: 3,
    retryBaseDelay: 500,
  },

  // TTS Configuration
  tts: {
    provider: 'elevenlabs', // 'elevenlabs', 'expo-speech'
    apiKey: '',
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella voice ID
    voiceName: 'Bella',
    model: 'eleven_multilingual_v2',
    stability: 0.5,
    similarityBoost: 0.75,
    lang: 'it-IT',
  },

  // ASR Configuration
  asr: {
    provider: 'web-speech', // 'web-speech', 'whisper'
    language: 'it-IT',
    continuous: false,
    interimResults: true,
  },

  // User Profile & Memory
  user: {
    userId: '',
    name: '',
    timezone: 'Europe/Rome',
    preferences: {
      communicationStyle: 'professional', // 'formal', 'casual', 'professional'
      responseLength: 'medium', // 'brief', 'medium', 'detailed'
      proactivityLevel: 'high', // 'low', 'medium', 'high'
      notificationFrequency: 'smart', // 'always', 'smart', 'minimal'
    },
  },

  // Storage Configuration
  storage: {
    type: 'sqlite', // 'sqlite', 'cloud'
    databaseName: 'jarvis.db',
    enableEncryption: true,
  },

  // Time Tracking Configuration
  timeTracking: {
    enabled: true,
    trackLocation: false, // Privacy: false by default
    trackAppUsage: true,
    trackActivities: true,
    batchInterval: 60000, // 1 minute
  },

  // Scheduler & Proactivity
  scheduler: {
    enableDailyBriefing: true,
    briefingTime: '08:00', // HH:mm format
    enableProactiveNotifications: true,
    checkInterval: 300000, // 5 minutes
  },

  // Jarvis Personality
  personality: {
    name: 'Jarvis',
    role: 'Personal AI Assistant',
    voiceTone: 'helpful, intelligent, proactive',
    responseStyle: 'conversational yet professional',
  },
};

class JarvisConfigManager {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.listeners = [];
    this.initialized = false;
  }

  /**
   * Inizializza la configurazione da storage
   */
  async init() {
    try {
      const stored = await AsyncStorage.getItem('jarvis_config');
      if (stored) {
        const parsedConfig = JSON.parse(stored);
        this.config = { ...this.config, ...parsedConfig };
      }
      this.initialized = true;
      console.log('[JarvisConfig] Initialized successfully');
    } catch (error) {
      console.error('[JarvisConfig] Initialization error:', error);
    }
  }

  /**
   * Ottieni valore di configurazione
   */
  get(path) {
    const keys = path.split('.');
    let value = this.config;
    for (const key of keys) {
      value = value?.[key];
    }
    return value;
  }

  /**
   * Imposta valore di configurazione
   */
  async set(path, value) {
    const keys = path.split('.');
    let current = this.config;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;

    await this.persist();
    this.notifyListeners();
  }

  /**
   * Imposta API key in secure storage
   */
  async setSecureKey(keyName, value) {
    try {
      await SecureStore.setItemAsync(keyName, value);
      this.config.llm.apiKey = value;
      this.notifyListeners();
    } catch (error) {
      console.error(`[JarvisConfig] Error storing ${keyName}:`, error);
    }
  }

  /**
   * Ottieni API key da secure storage
   */
  async getSecureKey(keyName) {
    try {
      return await SecureStore.getItemAsync(keyName);
    } catch (error) {
      console.error(`[JarvisConfig] Error retrieving ${keyName}:`, error);
      return null;
    }
  }

  /**
   * Persisti configurazione
   */
  async persist() {
    try {
      await AsyncStorage.setItem('jarvis_config', JSON.stringify(this.config));
    } catch (error) {
      console.error('[JarvisConfig] Error persisting config:', error);
    }
  }

  /**
   * Registra listener per cambiamenti di configurazione
   */
  onChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notifica listener di cambiamenti
   */
  notifyListeners() {
    this.listeners.forEach(listener => listener(this.config));
  }

  /**
   * Ottieni configurazione completa
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Reset a configurazione di default
   */
  async reset() {
    this.config = { ...DEFAULT_CONFIG };
    await this.persist();
    this.notifyListeners();
  }
}

export const configManager = new JarvisConfigManager();
export default JarvisConfigManager;
