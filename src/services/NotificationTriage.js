/**
 * NotificationTriage.js - Smart notification reading & triage
 * Reads incoming notifications, triages urgent vs noise, extracts 2FA codes
 * Uses Android NotificationListenerService (via expo-notifications events)
 */

import { Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { storageService } from './StorageService';
import { logger } from '../utils/Logger';

const STORAGE_KEY = 'echo_notification_triage';

const URGENT_APPS = [
  'com.whatsapp', 'com.whatsapp.w4b',
  'com.google.android.gm', 'com.microsoft.office.outlook',
  'com.samsung.android.messaging', 'com.android.mms',
  'com.google.android.apps.messaging',
  'com.android.phone', 'com.android.dialer',
  'org.telegram.messenger'
];

const NOISE_APPS = [
  'com.spotify.music', 'com.instagram.android',
  'com.facebook.katana', 'com.twitter.android',
  'com.google.android.youtube', 'com.zhiliaoapp.musically'
];

const TWO_FA_PATTERNS = [
  /(\d{4,6})\s*(?:è|è il|is|code|codice|verification|verifica)/i,
  /(?:code|codice|verification|verifica)[:\s]*(\d{4,6})/i,
  /(\d{3})[\s-](\d{3})/,
  /(\d{6})/
];

class NotificationTriageService {
  constructor() {
    this.isInitialized = false;
    this.recentNotifications = [];
    this.digest = { urgent: [], normal: [], noise: [] };
    this.twoFACodes = [];
    this.maxHistory = 100;
    this.listeners = [];
  }

  async init() {
    try {
      await this.loadHistory();
      this.setupNotificationObserver();
      this.isInitialized = true;
      logger.info('NotificationTriage', 'Initialized');
      return true;
    } catch (error) {
      logger.error('NotificationTriage', 'Failed to initialize', error);
      return false;
    }
  }

  setupNotificationObserver() {
    this._subscription = Notifications.addNotificationReceivedListener(
      (notification) => this.handleIncomingNotification(notification)
    );
  }

  handleIncomingNotification(notification) {
    const { request, date } = notification;
    const { content, identifier } = request;

    const entry = {
      id: identifier,
      app: content.data?.android || content.data?.source || 'unknown',
      title: content.title || '',
      body: content.body || '',
      timestamp: date || Date.now(),
      read: false,
      category: this.categorizeNotification(content)
    };

    this.recentNotifications.unshift(entry);
    if (this.recentNotifications.length > this.maxHistory) {
      this.recentNotifications.pop();
    }

    const code = this.extract2FACode(entry.body);
    if (code) {
      this.twoFACodes.unshift({ code, from: entry.app, timestamp: entry.timestamp });
      if (this.twoFACodes.length > 20) this.twoFACodes.pop();
    }

    this.digest[entry.category].unshift(entry);
    Object.keys(this.digest).forEach(k => {
      if (this.digest[k].length > 50) this.digest[k].pop();
    });

    this.notifyListeners(entry);
    this.saveHistory();
  }

  categorizeNotification(content) {
    const pkg = content.data?.android || content.data?.source || '';
    if (URGENT_APPS.some(a => pkg.includes(a))) return 'urgent';
    if (NOISE_APPS.some(a => pkg.includes(a))) return 'noise';
    return 'normal';
  }

  extract2FACode(text) {
    if (!text) return null;
    for (const pattern of TWO_FA_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const code = match[1] || match[0];
        if (/^\d{4,6}$/.test(code)) return code;
      }
    }
    return null;
  }

  getUnreadCount() {
    return this.recentNotifications.filter(n => !n.read).length;
  }

  getUrgentNotifications(limit = 10) {
    return this.digest.urgent.slice(0, limit);
  }

  getDigest(hours = 24) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return {
      urgent: this.digest.urgent.filter(n => n.timestamp > cutoff),
      normal: this.digest.normal.filter(n => n.timestamp > cutoff),
      noise: this.digest.noise.filter(n => n.timestamp > cutoff),
      twoFACodes: this.twoFACodes.filter(c => c.timestamp > cutoff)
    };
  }

  generateDigestSummary(hours = 24) {
    const digest = this.getDigest(hours);
    let summary = `📋 **Notifiche ultime ${hours}h:**\n\n`;

    if (digest.urgent.length > 0) {
      summary += `🔴 **Urgenti (${digest.urgent.length}):**\n`;
      digest.urgent.slice(0, 5).forEach(n => {
        summary += `  • ${n.title}: ${n.body.substring(0, 80)}\n`;
      });
      summary += '\n';
    }

    if (digest.normal.length > 0) {
      summary += `🟡 **Normali (${digest.normal.length}):**\n`;
      digest.normal.slice(0, 3).forEach(n => {
        summary += `  • ${n.title}: ${n.body.substring(0, 60)}\n`;
      });
      summary += '\n';
    }

    if (digest.noise.length > 0) {
      summary += `⚪ **Noise (${digest.noise.length}):** ${digest.noise.map(n => n.app.split('.').pop()).join(', ')}\n\n`;
    }

    if (digest.twoFACodes.length > 0) {
      summary += `🔐 **Codici 2FA recenti:**\n`;
      digest.twoFACodes.slice(0, 3).forEach(c => {
        summary += `  • ${c.code} (${c.from})\n`;
      });
      summary += '\n';
    }

    if (digest.urgent.length === 0 && digest.normal.length === 0) {
      summary += 'Nessuna notifica rilevante. Tutto quiet! 🎉\n';
    }

    return summary;
  }

  getLatest2FACode() {
    return this.twoFACodes.length > 0 ? this.twoFACodes[0] : null;
  }

  markAllRead() {
    this.recentNotifications.forEach(n => { n.read = true; });
    this.saveHistory();
  }

  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners(entry) {
    this.listeners.forEach(cb => {
      try { cb(entry); } catch (e) {}
    });
  }

  async saveHistory() {
    try {
      const data = {
        recent: this.recentNotifications.slice(0, 50),
        twoFACodes: this.twoFACodes.slice(0, 10),
        lastSaved: Date.now()
      };
      await storageService.set(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      logger.warn('NotificationTriage', 'Failed to save history', error);
    }
  }

  async loadHistory() {
    try {
      const raw = await storageService.get(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.recentNotifications = data.recent || [];
        this.twoFACodes = data.twoFACodes || [];
        this.recentNotifications.forEach(n => {
          const cat = this.categorizeNotification({ data: { source: n.app } });
          this.digest[cat].push(n);
        });
      }
    } catch (error) {
      logger.warn('NotificationTriage', 'Failed to load history', error);
    }
  }

  destroy() {
    if (this._subscription) {
      this._subscription.remove();
    }
  }
}

export const notificationTriage = new NotificationTriageService();
export default NotificationTriageService;
