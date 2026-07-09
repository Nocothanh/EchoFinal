/**
 * ClipboardService.js
 * Copy/paste, clipboard history, and smart clipboard operations
 */

import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

class ClipboardService {
  constructor() {
    this.isInitialized = false;
    this.history = [];
    this.maxHistory = 50;
  }

  async init() {
    this.isInitialized = true;
    await this.loadHistory();
    return true;
  }

  async copy(text, label) {
    await Clipboard.setStringAsync(text);
    this.addToHistory(text, label || 'copy');
    return { success: true };
  }

  async paste() {
    const text = await Clipboard.getStringAsync();
    if (text) {
      this.addToHistory(text, 'paste');
      return { success: true, text };
    }
    return { success: false, error: 'Clipboard is empty' };
  }

  async hasContent() {
    const text = await Clipboard.getStringAsync();
    return text.length > 0;
  }

  async getContent() {
    const text = await Clipboard.getStringAsync();
    return { success: true, text };
  }

  async copyPhoneNumber(number) {
    await Clipboard.setStringAsync(number);
    this.addToHistory(number, 'phone');
    return { success: true };
  }

  async copyAddress(address) {
    await Clipboard.setStringAsync(address);
    this.addToHistory(address, 'address');
    return { success: true };
  }

  async copyEmail(email) {
    await Clipboard.setStringAsync(email);
    this.addToHistory(email, 'email');
    return { success: true };
  }

  async copyCode(code) {
    await Clipboard.setStringAsync(code);
    this.addToHistory(code, 'code');
    return { success: true };
  }

  async pasteAndClear() {
    const text = await Clipboard.getStringAsync();
    if (text) {
      await Clipboard.setStringAsync('');
      return { success: true, text };
    }
    return { success: false, error: 'Clipboard is empty' };
  }

  addToHistory(text, type) {
    const entry = {
      id: `clip_${Date.now()}`,
      text,
      type,
      timestamp: Date.now(),
      preview: text.length > 100 ? text.substring(0, 100) + '...' : text
    };

    this.history = this.history.filter(h => h.text !== text);
    this.history.unshift(entry);

    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory);
    }

    this.saveHistory();
  }

  getHistory(limit = 20) {
    return this.history.slice(0, limit);
  }

  searchHistory(query) {
    const lower = query.toLowerCase();
    return this.history.filter(h => h.text.toLowerCase().includes(lower));
  }

  clearHistory() {
    this.history = [];
    this.saveHistory();
    return { success: true };
  }

  async saveHistory() {
    try {
      await AsyncStorage.setItem('echo_clipboard_history', JSON.stringify(this.history));
    } catch (e) {}
  }

  async loadHistory() {
    try {
      const data = await AsyncStorage.getItem('echo_clipboard_history');
      if (data) this.history = JSON.parse(data);
    } catch (e) {}
  }

  async detectContentType() {
    const text = await Clipboard.getStringAsync();
    if (!text) return { type: 'empty' };

    const patterns = {
      phone: /^\+?[\d\s\-\(\)]{7,15}$/,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      url: /^https?:\/\//i,
      code: /^[\d]{4,6}$/,
      address: /\d{5}\s+\w/i,
      json: /^\{[\s\S]*\}$/i
    };

    for (const [type, regex] of Object.entries(patterns)) {
      if (regex.test(text.trim())) return { type, text };
    }

    return { type: 'text', text };
  }

  async readOTP() {
    const text = await Clipboard.getStringAsync();
    const otpMatch = text.match(/\b(\d{4,6})\b/);
    if (otpMatch) {
      return { success: true, code: otpMatch[1], fullText: text };
    }
    return { success: false, error: 'No OTP code found in clipboard' };
  }

  cleanup() {}
}

export const clipboardService = new ClipboardService();
export default ClipboardService;
