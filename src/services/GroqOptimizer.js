/**
 * GroqOptimizer.js - Ottimizzazione specifica per API Groq
 * Focus: velocità, latency ultra-bassa, streaming support
 */

import { configManager } from '../config/JarvisConfig';
import { logger } from '../utils/Logger';
import { errorHandler } from '../middleware/ErrorHandler';

const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

class GroqOptimizer {
  constructor() {
    this.requestCache = new Map();
    this.cacheMaxAge = 3600000; // 1 hour
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatency: 0,
      averageLatency: 0,
    };
  }

  /**
   * Chiama Groq con ottimizzazioni
   */
  async call(messages, options = {}) {
    const {
      model = configManager.get('llm.model'),
      maxTokens = configManager.get('llm.maxTokens'),
      temperature = configManager.get('llm.temperature'),
      useCache = true,
      stream = false,
      onChunk = null,
    } = options;

    const apiKey = configManager.get('llm.apiKey');
    if (!apiKey) {
      throw new Error('Groq API key not configured');
    }

    const cacheKey = this._generateCacheKey(messages, model);

    // Verifica cache
    if (useCache) {
      const cached = this._getFromCache(cacheKey);
      if (cached) {
        logger.debug('GroqOptimizer', 'Cache hit');
        return cached;
      }
    }

    const startTime = Date.now();

    try {
      const response = stream
        ? await this._callStream(messages, model, maxTokens, temperature, apiKey, onChunk)
        : await this._callNormal(messages, model, maxTokens, temperature, apiKey);

      const latency = Date.now() - startTime;
      this._updateMetrics(true, latency);

      // Cache result
      if (useCache && !stream) {
        this._setCache(cacheKey, response);
      }

      logger.info('GroqOptimizer', `Response received in ${latency}ms`, {
        model,
        tokensUsed: response.usage?.total_tokens,
      });

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      this._updateMetrics(false, latency);
      logger.error('GroqOptimizer', 'API call failed', error);
      throw error;
    }
  }

  /**
   * Chiamata normale (non-streaming)
   */
  async _callNormal(messages, model, maxTokens, temperature, apiKey) {
    const response = await errorHandler.handleWithRetry(
      async () => {
        const res = await fetch(`${GROQ_API_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
            top_p: 1,
          }),
        });

        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(`Groq API ${res.status}: ${error.error?.message || 'Unknown error'}`);
        }

        return res.json();
      },
      {
        maxAttempts: configManager.get('llm.retryAttempts'),
        baseDelay: configManager.get('llm.retryBaseDelay'),
        module: 'GroqOptimizer',
      }
    );

    return response;
  }

  /**
   * Chiamata con streaming (per real-time responses)
   */
  async _callStream(messages, model, maxTokens, temperature, apiKey, onChunk) {
    let fullResponse = '';
    let tokensUsed = 0;

    try {
      const res = await fetch(`${GROQ_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
          stream: true,
        }),
      });

      if (!res.ok) {
        throw new Error(`Groq API ${res.status}: Stream failed`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const json = JSON.parse(data);
              const content = json.choices?.[0]?.delta?.content || '';
              if (content) {
                fullResponse += content;
                onChunk?.(content);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

      return {
        choices: [{ message: { content: fullResponse } }],
        usage: { total_tokens: tokensUsed },
      };
    } catch (error) {
      logger.error('GroqOptimizer', 'Stream error', error);
      throw error;
    }
  }

  /**
   * Genera cache key da messages
   */
  _generateCacheKey(messages, model) {
    const content = JSON.stringify(messages);
    return `${model}:${content.substring(0, 100)}`;
  }

  /**
   * Ottieni da cache
   */
  _getFromCache(key) {
    const cached = this.requestCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.cacheMaxAge) {
      this.requestCache.delete(key);
      return null;
    }
    return cached.data;
  }

  /**
   * Salva in cache
   */
  _setCache(key, data) {
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Aggiorna metriche
   */
  _updateMetrics(success, latency) {
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    this.metrics.totalLatency += latency;
    this.metrics.averageLatency = this.metrics.totalLatency / this.metrics.totalRequests;
  }

  /**
   * Ottieni metriche
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: ((this.metrics.successfulRequests / this.metrics.totalRequests) * 100).toFixed(2) + '%',
    };
  }

  /**
   * Reset metriche
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatency: 0,
      averageLatency: 0,
    };
  }

  /**
   * Pulisci cache
   */
  clearCache() {
    this.requestCache.clear();
  }
}

export const groqOptimizer = new GroqOptimizer();
export default GroqOptimizer;
