// Cross-provider LLM client with resilient fallback + optional streaming.
// Provider-specific request/response shaping is unchanged; we only add the
// shared retry+failover loop around each provider, plus an SSE streaming path
// salvaged from GroqOptimizer._callStream.

import {
  fetchWithTimeout,
  isRetryable,
  requestWithRetry,
  sanitizeModelText,
} from '../../llm-resilience';
import { envLoader } from './EnvLoader';

const DEFAULT_ATTEMPTS = 2;
const DEFAULT_BASE_DELAY_MS = 500;

// ---- Provider request builders --------------------------------------------
// Each builder returns { url, init } for a plain (non-stream) request, or a
// stream=true variant that flips the SSE flag in the body.

function buildOpenAiRequest(cfg, cleanHist, maxTokens, stream) {
  return {
    url: 'https://api.openai.com/v1/chat/completions',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
      body: JSON.stringify({
        model: cfg.model || 'gpt-4o',
        messages: [{ role: 'system', content: cfg.systemPrompt || '' }, ...cleanHist],
        max_tokens: maxTokens,
        temperature: 1.0,
        ...(stream ? { stream: true } : {}),
      }),
    },
    provider: 'openai',
  };
}

function buildAnthropicRequest(cfg, cleanHist, maxTokens, stream) {
  return {
    url: 'https://api.anthropic.com/v1/messages',
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: cfg.model || 'claude-3-5-sonnet-20241022',
        max_tokens: maxTokens,
        system: cfg.systemPrompt || '',
        messages: cleanHist.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
        ...(stream ? { stream: true } : {}),
      }),
    },
    provider: 'anthropic',
  };
}

function buildGroqRequest(cfg, cleanHist, maxTokens, stream) {
  return {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
      body: JSON.stringify({
        model: cfg.model || 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: cfg.systemPrompt || '' }, ...cleanHist],
        max_tokens: maxTokens,
        temperature: 1.0,
        ...(stream ? { stream: true } : {}),
      }),
    },
    provider: 'groq',
  };
}

const PROVIDER_BUILDERS = {
  openai: buildOpenAiRequest,
  anthropic: buildAnthropicRequest,
  groq: buildGroqRequest,
};

// ---- Provider chain resolution --------------------------------------------

function envKeyFor(provider) {
  try {
    if (provider === 'groq') return envLoader.get('groq.apiKey');
    if (provider === 'openai') return envLoader.get('openai.apiKey');
    if (provider === 'anthropic') return envLoader.get('anthropic.apiKey');
  } catch (_) {
    // envLoader may not be initialized yet; caller-supplied cfg.apiKey still wins.
  }
  return '';
}

function resolveProviderChain(cfg) {
  // Caller can pass an explicit ordered list via cfg.providers.
  if (Array.isArray(cfg.providers) && cfg.providers.length > 0) {
    return cfg.providers
      .map((p) =>
        typeof p === 'string'
          ? { provider: p, apiKey: p === cfg.provider ? cfg.apiKey : envKeyFor(p), model: cfg.model }
          : { provider: p.provider, apiKey: p.apiKey || envKeyFor(p.provider), model: p.model },
      )
      .filter((p) => p.provider && PROVIDER_BUILDERS[p.provider] && p.apiKey);
  }

  const primary = cfg.provider || 'groq';
  const orderRaw = [primary, 'groq', 'openai', 'anthropic'];
  const seen = new Set();
  const chain = [];
  for (const provider of orderRaw) {
    if (!provider || seen.has(provider) || !PROVIDER_BUILDERS[provider]) continue;
    seen.add(provider);
    const apiKey = provider === primary && cfg.apiKey ? cfg.apiKey : envKeyFor(provider);
    if (!apiKey) continue;
    chain.push({
      provider,
      apiKey,
      model: provider === primary ? cfg.model : undefined,
    });
  }
  return chain;
}

// ---- Non-stream provider invocation ---------------------------------------

async function runProviderOnce(providerCfg, cfg, cleanHist, maxTokens) {
  const builder = PROVIDER_BUILDERS[providerCfg.provider];
  const merged = { ...cfg, apiKey: providerCfg.apiKey, model: providerCfg.model || cfg.model };
  const { url, init } = builder(merged, cleanHist, maxTokens, false);
  const r = await fetchWithTimeout(url, init);
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    const err = new Error(
      `${providerCfg.provider} ${r.status}: ${e?.error?.message || e?.message || 'request failed'}`,
    );
    err.status = r.status;
    throw err;
  }
  const data = await r.json();
  if (providerCfg.provider === 'anthropic') {
    return data.content?.[0]?.text || '';
  }
  return data.choices?.[0]?.message?.content || '';
}

// ---- Streaming (SSE) provider invocation ----------------------------------
// Parsing logic salvaged from the dormant GroqOptimizer._callStream.

function extractStreamDelta(providerName, json) {
  if (providerName === 'anthropic') {
    // { type: 'content_block_delta', delta: { type: 'text_delta', text: '...' } }
    if (json?.type === 'content_block_delta') {
      return json.delta?.text || '';
    }
    return '';
  }
  // openai / groq compatible
  return json?.choices?.[0]?.delta?.content || '';
}

async function runProviderStream(providerCfg, cfg, cleanHist, maxTokens, onChunk) {
  const builder = PROVIDER_BUILDERS[providerCfg.provider];
  const merged = { ...cfg, apiKey: providerCfg.apiKey, model: providerCfg.model || cfg.model };
  const { url, init } = builder(merged, cleanHist, maxTokens, true);

  const res = await fetchWithTimeout(url, init, 60000);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    const err = new Error(
      `${providerCfg.provider} ${res.status}: ${e?.error?.message || 'stream failed'}`,
    );
    err.status = res.status;
    throw err;
  }
  if (!res.body || typeof res.body.getReader !== 'function') {
    // Runtime without ReadableStream support — signal fallback path.
    const err = new Error(`${providerCfg.provider}: streaming not supported by runtime`);
    err.noStream = true;
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullRaw = '';
  let cleanEmitted = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') continue;

        let json;
        try { json = JSON.parse(data); } catch { continue; }

        const delta = extractStreamDelta(providerCfg.provider, json);
        if (!delta) continue;

        fullRaw += delta;
        // Incremental sanitize: sanitize the running text, emit only the new tail.
        const cleanedSoFar = sanitizeModelText(fullRaw);
        if (cleanedSoFar.length > cleanEmitted.length) {
          const tail = cleanedSoFar.slice(cleanEmitted.length);
          cleanEmitted = cleanedSoFar;
          if (tail) onChunk?.(tail);
        }
      }
    }
  } catch (error) {
    // Mark as retryable so the outer loop can decide (mid-stream failure).
    if (!error.status) error.midStream = true;
    throw error;
  }

  return sanitizeModelText(fullRaw);
}

// ---- Public entry points --------------------------------------------------

/**
 * callProvider(cfg, messages, opts)
 *
 * cfg: {
 *   provider, apiKey, model, systemPrompt,
 *   providers?: [string | {provider, apiKey, model}]  // optional explicit chain
 * }
 * opts: {
 *   isCall?: boolean,
 *   maxTokens?: number,
 *   attempts?: number,
 *   baseDelayMs?: number,
 *   stream?: boolean,
 *   onChunk?: (text) => void,
 * }
 */
export async function callProvider(cfg, messages = [], opts = {}) {
  const {
    isCall = false,
    maxTokens = isCall ? 40 : 200,
    attempts = DEFAULT_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    stream = false,
    onChunk,
  } = opts;

  const cleanHist = messages.slice(-12).filter((m) => m.role !== 'system');
  const chain = resolveProviderChain(cfg);

  if (chain.length === 0) {
    throw new Error('No LLM provider available (missing API keys)');
  }

  const errors = [];
  for (let idx = 0; idx < chain.length; idx += 1) {
    const providerCfg = chain[idx];
    try {
      if (stream && typeof onChunk === 'function') {
        // Stream with retry; on mid-stream failure, drop to next provider
        // (or a non-stream retry for the same provider first).
        try {
          const raw = await requestWithRetry(
            () => runProviderStream(providerCfg, cfg, cleanHist, maxTokens, onChunk),
            { attempts, baseDelayMs },
          );
          const cleaned = sanitizeModelText(raw);
          if (!cleaned) throw new Error('Empty reply from provider');
          return cleaned;
        } catch (streamErr) {
          // Try a single non-streamed attempt on the same provider before
          // moving on — often enough to recover from a mid-stream drop.
          try {
            const raw = await requestWithRetry(
              () => runProviderOnce(providerCfg, cfg, cleanHist, maxTokens),
              { attempts: 1, baseDelayMs },
            );
            const cleaned = sanitizeModelText(raw);
            if (cleaned) {
              onChunk?.(cleaned);
              return cleaned;
            }
          } catch (fallbackErr) {
            errors.push(fallbackErr);
          }
          throw streamErr;
        }
      } else {
        const raw = await requestWithRetry(
          () => runProviderOnce(providerCfg, cfg, cleanHist, maxTokens),
          { attempts, baseDelayMs },
        );
        const cleaned = sanitizeModelText(raw);
        if (!cleaned) throw new Error('Empty reply from provider');
        return cleaned;
      }
    } catch (error) {
      errors.push(error);
      // If this was retryable, we already burned the retry budget — either
      // way, advance to next provider unless we're out.
      if (idx === chain.length - 1) {
        const summary = errors.map((e) => e?.message || String(e)).join(' | ');
        throw new Error(`All providers failed: ${summary}`);
      }
      // Non-retryable and no more providers → surface last. Otherwise: continue.
      if (!isRetryable(error) && !error.midStream) {
        // e.g. 401/403 → still try next provider (they may have valid keys).
        continue;
      }
    }
  }

  throw errors[errors.length - 1] || new Error('LLM request failed');
}
