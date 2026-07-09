/**
 * TranslationService.js
 * Multi-language translation using free APIs (MyMemory, LibreTranslate)
 */

class TranslationService {
  constructor() {
    this.isInitialized = false;
    this.cache = new Map();
    this.defaultTarget = 'it';
    this.defaultSource = 'auto';
    this.providers = ['mymemory', 'libretranslate'];
    this.activeProvider = 'mymemory';
  }

  init() {
    this.isInitialized = true;
    return true;
  }

  async translate(text, targetLang, sourceLang = 'auto') {
    const cacheKey = `${sourceLang}:${targetLang}:${text}`;
    if (this.cache.has(cacheKey)) return { success: true, translation: this.cache.get(cacheKey), fromCache: true };

    let result;
    try {
      result = await this.translateMyMemory(text, targetLang, sourceLang);
    } catch (e) {
      try {
        result = await this.translateLibreTranslate(text, targetLang, sourceLang);
      } catch (e2) {
        return { success: false, error: 'Translation service unavailable' };
      }
    }

    if (result.success) {
      this.cache.set(cacheKey, result.translation);
      if (this.cache.size > 500) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    }
    return result;
  }

  async translateMyMemory(text, targetLang, sourceLang) {
    const langPair = sourceLang === 'auto' ? `|${targetLang}` : `${sourceLang}|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translation = data.responseData.translatedText;
      if (translation.toLowerCase() !== text.toLowerCase()) {
        return { success: true, translation, provider: 'mymemory' };
      }
    }
    return { success: false, error: 'Translation failed' };
  }

  async translateLibreTranslate(text, targetLang, sourceLang) {
    const url = 'https://libretranslate.com/translate';
    const body = {
      q: text,
      source: sourceLang === 'auto' ? 'auto' : sourceLang,
      target: targetLang
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (data.translatedText) {
      return { success: true, translation: data.translatedText, provider: 'libretranslate' };
    }
    return { success: false, error: data.error || 'Translation failed' };
  }

  async detectLanguage(text) {
    const result = await this.translate(text, 'en', 'auto');
    if (result.success && result.translation.toLowerCase() !== text.toLowerCase()) {
      return { success: true, detected: true };
    }
    return { success: true, detected: false, language: 'unknown' };
  }

  async translateBatch(texts, targetLang, sourceLang = 'auto') {
    const results = [];
    for (const text of texts) {
      const result = await this.translate(text, targetLang, sourceLang);
      results.push({ original: text, ...result });
    }
    return results;
  }

  getSupportedLanguages() {
    return {
      it: 'Italiano',
      en: 'English',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch',
      pt: 'Português',
      zh: '中文',
      ja: '日本語',
      ko: '한국어',
      ar: 'العربية',
      ru: 'Русский',
      nl: 'Nederlands',
      pl: 'Polski',
      tr: 'Türkçe',
      vi: 'Tiếng Việt',
      th: 'ไทย',
      sv: 'Svenska'
    };
  }

  parseTranslationCommand(text) {
    const lower = text.toLowerCase();
    const patterns = [
      /(?:traduci|translate|traduire|übersetze)\s+(.+?)\s+(?:in|to|en|auf)\s+(\S+)/i,
      /(?:come si dice|how do you say)\s+(.+?)\s+(?:in|to)\s+(\S+)/i,
      /(.+?)\s+(?:in|to)\s+(\S+)/i
    ];

    for (const pattern of patterns) {
      const match = lower.match(pattern);
      if (match) {
        const langMap = {
          'italiano': 'it', 'italian': 'it', 'it': 'it',
          'inglese': 'en', 'english': 'en', 'en': 'en',
          'spagnolo': 'es', 'spanish': 'es', 'es': 'es',
          'francese': 'fr', 'french': 'fr', 'fr': 'fr',
          'tedesco': 'de', 'german': 'de', 'de': 'de',
          'portoghese': 'pt', 'portuguese': 'pt', 'pt': 'pt',
          'cinese': 'zh', 'chinese': 'zh', 'zh': 'zh',
          'giapponese': 'ja', 'japanese': 'ja', 'ja': 'ja',
          'coreano': 'ko', 'korean': 'ko', 'ko': 'ko',
          'arabo': 'ar', 'arabic': 'ar', 'ar': 'ar',
          'russo': 'ru', 'russian': 'ru', 'ru': 'ru'
        };
        return {
          text: match[1].trim(),
          targetLang: langMap[match[2].toLowerCase()] || match[2]
        };
      }
    }
    return null;
  }

  cleanup() {
    this.cache.clear();
  }
}

export const translationService = new TranslationService();
export default TranslationService;
