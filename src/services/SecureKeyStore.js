/**
 * SecureKeyStore.js - Servizio sicuro per salvataggio API keys
 * Usa expo-secure-store per crittograficare le credenziali
 */

import * as SecureStore from 'expo-secure-store';
import { logger } from '../utils/Logger';

const KEY_PREFIX = 'echo_api_';

const STORAGE_KEYS = {
  GROQ_API_KEY: `${KEY_PREFIX}groq_key`,
  GROQ_MODEL: `${KEY_PREFIX}groq_model`,
  OPENAI_API_KEY: `${KEY_PREFIX}openai_key`,
  OPENAI_MODEL: `${KEY_PREFIX}openai_model`,
  ANTHROPIC_API_KEY: `${KEY_PREFIX}anthropic_key`,
  ANTHROPIC_MODEL: `${KEY_PREFIX}anthropic_model`,
  ELEVENLABS_API_KEY: `${KEY_PREFIX}elevenlabs_key`,
  ELEVENLABS_VOICE_ID: `${KEY_PREFIX}elevenlabs_voice`,
  SELECTED_PROVIDER: `${KEY_PREFIX}selected_provider`,
};

class SecureKeyStoreService {
  constructor() {
    this.cache = {};
    this.initialized = false;
  }

  /**
   * Inizializza il servizio e carica le chiavi in cache
   */
  async init() {
    try {
      for (const [key, storeKey] of Object.entries(STORAGE_KEYS)) {
        const value = await SecureStore.getItemAsync(storeKey);
        if (value) {
          this.cache[key] = value;
        }
      }
      this.initialized = true;
      logger.info('SecureKeyStore', 'Initialized successfully');
      return true;
    } catch (error) {
      logger.error('SecureKeyStore', 'Failed to initialize', error);
      return false;
    }
  }

  /**
   * Salva una chiave nel secure store
   */
  async setKey(key, value) {
    try {
      const storeKey = STORAGE_KEYS[key];
      if (!storeKey) {
        throw new Error(`Invalid key: ${key}`);
      }

      if (value && value.trim()) {
        await SecureStore.setItemAsync(storeKey, value.trim());
        this.cache[key] = value.trim();
      } else {
        await SecureStore.deleteItemAsync(storeKey);
        delete this.cache[key];
      }

      logger.info('SecureKeyStore', `Key ${key} saved successfully`);
      return true;
    } catch (error) {
      logger.error('SecureKeyStore', `Failed to save key ${key}`, error);
      return false;
    }
  }

  /**
   * Ottieni una chiave dal secure store (con cache)
   */
  getKey(key) {
    return this.cache[key] || '';
  }

  /**
   * Verifica se una chiave esiste
   */
  hasKey(key) {
    return !!this.cache[key];
  }

  /**
   * Ottieni tutte le chiavi (per la schermata impostazioni)
   */
  getAllKeys() {
    const keys = {};
    for (const key of Object.keys(STORAGE_KEYS)) {
      keys[key] = this.cache[key] || '';
    }
    return keys;
  }

  /**
   * Salva multiple chiavi in una volta
   */
  async setMultipleKeys(keysObject) {
    const results = [];
    for (const [key, value] of Object.entries(keysObject)) {
      const result = await this.setKey(key, value);
      results.push({ key, success: result });
    }
    return results;
  }

  /**
   * Cancella una chiave
   */
  async deleteKey(key) {
    try {
      const storeKey = STORAGE_KEYS[key];
      if (!storeKey) return false;

      await SecureStore.deleteItemAsync(storeKey);
      delete this.cache[key];
      logger.info('SecureKeyStore', `Key ${key} deleted`);
      return true;
    } catch (error) {
      logger.error('SecureKeyStore', `Failed to delete key ${key}`, error);
      return false;
    }
  }

  /**
   * Cancella tutte le chiavi
   */
  async clearAll() {
    try {
      for (const storeKey of Object.values(STORAGE_KEYS)) {
        await SecureStore.deleteItemAsync(storeKey);
      }
      this.cache = {};
      logger.info('SecureKeyStore', 'All keys cleared');
      return true;
    } catch (error) {
      logger.error('SecureKeyStore', 'Failed to clear all keys', error);
      return false;
    }
  }

  /**
   * Testa la connessione con un provider
   */
  async testConnection(provider) {
    const apiKey = this.getKey(`${provider.toUpperCase()}_API_KEY`);
    if (!apiKey) {
      return { success: false, error: 'API key non configurata' };
    }

    try {
      const testUrls = {
        groq: 'https://api.groq.com/openai/v1/models',
        openai: 'https://api.openai.com/v1/models',
        anthropic: 'https://api.anthropic.com/v1/messages',
      };

      const url = testUrls[provider];
      if (!url) {
        return { success: false, error: 'Provider non supportato' };
      }

      const headers = {
        'Content-Type': 'application/json',
      };

      if (provider === 'anthropic') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        timeout: 10000,
      });

      if (response.ok) {
        return { success: true, message: 'Connessione riuscita!' };
      } else {
        const data = await response.json().catch(() => ({}));
        return {
          success: false,
          error: data?.error?.message || `Errore ${response.status}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Errore di connessione',
      };
    }
  }

  /**
   * Verifica se almeno un provider LLM è configurato
   */
  isConfigured() {
    return this.hasKey('GROQ_API_KEY') || 
           this.hasKey('OPENAI_API_KEY') || 
           this.hasKey('ANTHROPIC_API_KEY');
  }
}

export const secureKeyStore = new SecureKeyStoreService();
export default SecureKeyStoreService;
export { STORAGE_KEYS };
