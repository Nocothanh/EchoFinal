/**
 * providers.js - Configurazione provider LLM
 * Definisce provider disponibili, modelli e opzioni
 */

export const PROVIDERS = {
  groq: {
    id: 'groq',
    name: 'Groq',
    description: 'Veloce e gratuito (open-source models)',
    baseUrl: 'https://api.groq.com/openai/v1',
    freeTier: true,
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', recommended: true },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Veloce)' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
    ],
    keyPlaceholder: 'gsk_...',
    keyPrefix: 'gsk_',
    color: '#7C3AED',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o e modelli avanzati',
    baseUrl: 'https://api.openai.com/v1',
    freeTier: false,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', recommended: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Economico)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    ],
    keyPlaceholder: 'sk-...',
    keyPrefix: 'sk-',
    color: '#10A37F',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude - assistente intelligente',
    baseUrl: 'https://api.anthropic.com/v1',
    freeTier: false,
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', recommended: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Veloce)' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    ],
    keyPlaceholder: 'sk-ant-...',
    keyPrefix: 'sk-ant-',
    color: '#D97706',
  },
};

export const DEFAULT_PROVIDER = 'groq';
export const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

/**
 * Ottieni lista provider per il selettore
 */
export function getProviderList() {
  return Object.values(PROVIDERS).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    freeTier: p.freeTier,
    color: p.color,
  }));
}

/**
 * Ottieni modelli per un provider
 */
export function getModelsForProvider(providerId) {
  const provider = PROVIDERS[providerId];
  if (!provider) return [];
  return provider.models;
}

/**
 * Ottieni il modello consigliato per un provider
 */
export function getRecommendedModel(providerId) {
  const models = getModelsForProvider(providerId);
  return models.find(m => m.recommended)?.id || models[0]?.id || '';
}

/**
 * Valida una chiave API (controllo prefisso base)
 */
export function validateApiKey(providerId, apiKey) {
  if (!apiKey || !apiKey.trim()) {
    return { valid: false, error: 'API key richiesta' };
  }

  const provider = PROVIDERS[providerId];
  if (!provider) {
    return { valid: false, error: 'Provider non valido' };
  }

  // Basic prefix validation
  if (provider.keyPrefix && !apiKey.startsWith(provider.keyPrefix)) {
    return {
      valid: false,
      error: `La chiave dovrebbe iniziare con "${provider.keyPrefix}"`,
    };
  }

  // Minimum length check
  if (apiKey.length < 10) {
    return { valid: false, error: 'API key troppo corta' };
  }

  return { valid: true };
}

/**
 * Ottieni il provider raccomandato per principianti
 */
export function getBeginnerRecommendation() {
  return {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    reason: 'Groq è gratuito e veloce - perfetto per iniziare!',
    signupUrl: 'https://console.groq.com',
  };
}

/**
 * Mappa chiavi di storage per ogni provider
 */
export const PROVIDER_STORAGE_KEYS = {
  groq: {
    apiKey: 'GROQ_API_KEY',
    model: 'GROQ_MODEL',
  },
  openai: {
    apiKey: 'OPENAI_API_KEY',
    model: 'OPENAI_MODEL',
  },
  anthropic: {
    apiKey: 'ANTHROPIC_API_KEY',
    model: 'ANTHROPIC_MODEL',
  },
};

/**
 * Messaggi di errore comuni
 */
export const ERROR_MESSAGES = {
  INVALID_KEY: 'API key non valida',
  RATE_LIMIT: 'Troppe richieste - riprova tra qualche secondo',
  NETWORK_ERROR: 'Errore di connessione - controlla la rete',
  UNAUTHORIZED: 'API key non valida o scaduta',
  QUOTA_EXCEEDED: 'Quota esaurita - controlla il tuo piano',
  UNKNOWN: 'Errore sconosciuto - riprova',
};

/**
 * Traduci errore API in messaggio utente
 */
export function translateError(error, provider) {
  const message = error?.message?.toLowerCase() || '';
  
  if (message.includes('rate limit') || message.includes('429')) {
    return ERROR_MESSAGES.RATE_LIMIT;
  }
  if (message.includes('401') || message.includes('unauthorized') || message.includes('invalid')) {
    return ERROR_MESSAGES.UNAUTHORIZED;
  }
  if (message.includes('402') || message.includes('quota') || message.includes('exceeded')) {
    return ERROR_MESSAGES.QUOTA_EXCEEDED;
  }
  if (message.includes('network') || message.includes('fetch')) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }
  
  return error?.message || ERROR_MESSAGES.UNKNOWN;
}

export default {
  PROVIDERS,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  getProviderList,
  getModelsForProvider,
  getRecommendedModel,
  validateApiKey,
  getBeginnerRecommendation,
  PROVIDER_STORAGE_KEYS,
  ERROR_MESSAGES,
  translateError,
};
