// Simple LLM client wrapper to centralize provider calls.
// This module uses existing llm-resilience helpers when available.
import { fetchWithTimeout, requestWithRetry, sanitizeModelText } from '../../llm-resilience';

export async function callProvider(cfg, messages = [], opts = {}) {
  const { isCall = false, maxTokens = isCall ? 40 : 200 } = opts;

  const cleanHist = messages.slice(-12).filter(m => m.role !== 'system');

  const providerRequests = {
    openai: async () => {
      const r = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
        body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'system', content: cfg.systemPrompt || '' }, ...cleanHist], max_tokens: maxTokens, temperature: 1.0 }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error('OpenAI ' + r.status + ': ' + (e?.error?.message || 'request failed'));
      }
      return (await r.json()).choices?.[0]?.message?.content || '';
    },
    anthropic: async () => {
      const r = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', max_tokens: maxTokens, system: cfg.systemPrompt || '', messages: cleanHist.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })) }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error('Anthropic ' + r.status + ': ' + (e?.error?.message || e?.message || 'request failed'));
      }
      return (await r.json()).content?.[0]?.text || '';
    },
    groq: async () => {
      const r = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
        body: JSON.stringify({ model: cfg.model || 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: cfg.systemPrompt || '' }, ...cleanHist], max_tokens: maxTokens, temperature: 1.0 }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error('Groq ' + r.status + ': ' + (e?.error?.message || JSON.stringify(e)));
      }
      return (await r.json()).choices?.[0]?.message?.content || '';
    },
  };

  const runRequest = providerRequests[cfg.provider] || providerRequests.groq;
  const rawReply = await requestWithRetry(runRequest, { attempts: 2, baseDelayMs: 500 });
  const cleaned = sanitizeModelText(rawReply);
  if (!cleaned) throw new Error('Empty reply from provider');
  return cleaned;
}
