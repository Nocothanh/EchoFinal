const THINK_TAG_BLOCK = /<think>[\s\S]*?<\/think>/gi;
const GENERIC_XML_TAGS = /<\/?(analysis|reasoning|thought|internal)[^>]*>/gi;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function sanitizeModelText(input = '') {
  let text = String(input || '');
  text = text.replace(THINK_TAG_BLOCK, ' ');
  text = text.replace(GENERIC_XML_TAGS, ' ');
  text = text.replace(/^(assistant|echo)\s*:\s*/i, '');
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

export async function requestWithRetry(requestFactory, config = {}) {
  const attempts = Math.max(1, config.attempts ?? 2);
  const baseDelayMs = Math.max(150, config.baseDelayMs ?? 450);

  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await requestFactory();
    } catch (error) {
      lastError = error;
      const retryableByError = isRetryableError(error);
      const retryableByStatus =
        typeof error?.status === 'number' && isRetryableHttpStatus(error.status);
      const shouldRetry = i < attempts - 1 && (retryableByError || retryableByStatus);
      if (!shouldRetry) throw error;
      await sleep(baseDelayMs * (i + 1));
    }
  }
  throw lastError || new Error('Request failed');
}
