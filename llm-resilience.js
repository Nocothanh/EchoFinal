const THINK_TAG_BLOCK = /<think>[\s\S]*?<\/think>/gi;
const GENERIC_XML_TAGS = /<\/?(analysis|reasoning|thought|internal)[^>]*>/gi;

// Markdown constructs that pollute TTS output.
const MD_CODE_FENCE = /```[\s\S]*?```/g;
const MD_INLINE_CODE = /`([^`]*)`/g;
const MD_IMAGE = /!\[([^\]]*)\]\([^)]*\)/g;
const MD_LINK = /\[([^\]]+)\]\([^)]+\)/g;
const MD_HEADING = /^\s{0,3}#{1,6}\s+/gm;
const MD_LIST_BULLET = /^\s*(?:[-*+]|\d+[.)])\s+/gm;
const MD_BLOCKQUOTE = /^\s{0,3}>\s?/gm;
const MD_BOLD_ITALIC = /(\*{1,3}|_{1,3})(\S[\s\S]*?\S|\S)\1/g;
const MD_STRIKETHROUGH = /~~([\s\S]*?)~~/g;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function sanitizeModelText(input = '') {
  let text = String(input || '');
  // Strip reasoning/thinking blocks & tags first.
  text = text.replace(THINK_TAG_BLOCK, ' ');
  text = text.replace(GENERIC_XML_TAGS, ' ');
  text = text.replace(/^(assistant|echo)\s*:\s*/i, '');

  // Markdown → speech-safe plain text.
  text = text.replace(MD_CODE_FENCE, ' ');
  text = text.replace(MD_INLINE_CODE, '$1');
  text = text.replace(MD_IMAGE, '$1');
  text = text.replace(MD_LINK, '$1');
  text = text.replace(MD_HEADING, '');
  text = text.replace(MD_LIST_BULLET, '');
  text = text.replace(MD_BLOCKQUOTE, '');
  text = text.replace(MD_STRIKETHROUGH, '$1');
  text = text.replace(MD_BOLD_ITALIC, '$2');

  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timerId);
  }
}

function isRetryableError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('abort')
  );
}

function isRetryableHttpStatus(status) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

export function isRetryable(error) {
  if (!error) return false;
  if (typeof error.status === 'number' && isRetryableHttpStatus(error.status)) return true;
  return isRetryableError(error);
}

/**
 * Retry a request with exponential backoff.
 *   delay(i) = baseDelayMs * 2^i   (i = 0..attempts-2)
 * Simple, no jitter, as specified.
 */
export async function requestWithRetry(requestFactory, config = {}) {
  const attempts = Math.max(1, config.attempts ?? 3);
  const baseDelayMs = Math.max(50, config.baseDelayMs ?? 400);

  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await requestFactory();
    } catch (error) {
      lastError = error;
      const shouldRetry = i < attempts - 1 && isRetryable(error);
      if (!shouldRetry) throw error;
      const delay = baseDelayMs * Math.pow(2, i);
      await sleep(delay);
    }
  }
  throw lastError || new Error('Request failed');
}
