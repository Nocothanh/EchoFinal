/**
 * WebSearchService.js - Free web search via DuckDuckGo + URL browsing
 * No API key required
 */

import { Linking } from 'react-native';
import { logger } from '../utils/Logger';

const DDG_URL = 'https://api.duckduckgo.com/';
const DDG_HTML_URL = 'https://html.duckduckgo.com/html/';
const JINA_READER_URL = 'https://r.jina.ai/';

class WebSearchServiceClass {
  constructor() {
    this.isInitialized = false;
    this.searchHistory = [];
  }

  async init() {
    this.isInitialized = true;
    logger.info('WebSearchService', 'Initialized (DuckDuckGo, no API key)');
    return true;
  }

  /**
   * Search via DuckDuckGo Instant Answer API
   */
  async search(query, limit = 5) {
    if (!query) return { success: false, error: 'Query vuota' };

    try {
      const instantResult = await this.searchInstant(query);
      if (instantResult && instantResult.results.length > 0) {
        return instantResult;
      }

      const htmlResult = await this.searchHTML(query, limit);
      return htmlResult;
    } catch (error) {
      logger.error('WebSearchService', 'Search failed', error);
      return { success: false, error: error.message };
    }
  }

  async searchInstant(query) {
    try {
      const url = `${DDG_URL}?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const response = await fetch(url);
      const data = await response.json();

      const results = [];

      if (data.AbstractText) {
        results.push({
          title: data.Heading || query,
          snippet: data.AbstractText,
          url: data.AbstractURL || '',
          source: data.AbstractSource || 'DuckDuckGo'
        });
      }

      if (data.Answer) {
        results.unshift({
          title: 'Risposta diretta',
          snippet: data.Answer,
          url: '',
          source: 'DuckDuckGo'
        });
      }

      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics
          .filter(t => t.Text && t.FirstURL)
          .slice(0, 5)
          .forEach(t => {
            results.push({
              title: t.Text.substring(0, 80),
              snippet: t.Text,
              url: t.FirstURL,
              source: data.AbstractSource || 'DuckDuckGo'
            });
          });
      }

      return {
        success: true,
        query,
        results: results.slice(0, limit),
        answer: data.Answer || data.AbstractText || null
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async searchHTML(query, limit = 5) {
    try {
      const url = DDG_HTML_URL;
      const body = `q=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      });

      const html = await response.text();
      const results = [];

      const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      let match;

      while ((match = resultRegex.exec(html)) !== null && results.length < limit) {
        let href = match[1];
        try {
          const u = new URL(href, 'https://duckduckgo.com');
          href = u.searchParams.get('uddg') || href;
        } catch (_) {}

        results.push({
          title: match[2].replace(/<[^>]*>/g, '').trim(),
          snippet: match[3].replace(/<[^>]*>/g, '').trim(),
          url: href,
          source: 'Web'
        });
      }

      if (results.length === 0) {
        const simpleRegex = /<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/g;
        while ((match = simpleRegex.exec(html)) !== null && results.length < limit) {
          results.push({
            title: match[1].replace(/<[^>]*>/g, '').trim(),
            snippet: '',
            url: '',
            source: 'Web'
          });
        }
      }

      return {
        success: true,
        query,
        results
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Browse a URL and extract text content via Jina Reader (free)
   */
  async browse(url) {
    if (!url) return { success: false, error: 'URL vuoto' };

    try {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      const response = await fetch(`${JINA_READER_URL}${fullUrl}`, {
        headers: {
          'Accept': 'text/plain',
          'X-Return-Format': 'text'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      const preview = text.substring(0, 2000);

      return {
        success: true,
        url: fullUrl,
        content: preview,
        fullLength: text.length,
        truncated: text.length > 2000
      };
    } catch (error) {
      logger.error('WebSearchService', 'Browse failed', error);
      return { success: false, error: error.message };
    }
  }

  formatSearchResults(searchResult) {
    if (!searchResult.success || !searchResult.results.length) {
      return `Nessun risultato trovato per "${searchResult.query || ''}"`;
    }

    let text = `🔍 Risultati per "${searchResult.query}":\n\n`;

    searchResult.results.forEach((r, i) => {
      text += `${i + 1}. **${r.title}**\n`;
      if (r.snippet) text += `   ${r.snippet.substring(0, 120)}\n`;
      if (r.url) text += `   🔗 ${r.url}\n`;
      text += '\n';
    });

    return text;
  }

  addToHistory(query) {
    this.searchHistory.unshift({ query, timestamp: Date.now() });
    if (this.searchHistory.length > 50) this.searchHistory.pop();
  }
}

export const webSearchService = new WebSearchServiceClass();
export default WebSearchServiceClass;
