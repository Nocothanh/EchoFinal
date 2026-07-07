/**
 * DeviceControlService.js - Controllo del dispositivo.
 * expo-notifications caricato dinamicamente per essere Expo-Go-safe.
 */

import { logger } from '../utils/Logger';
import { requestNotificationsPermission } from '../utils/permissions';

let Notifications = null;
let loadAttempted = false;

async function loadNotifications() {
  if (loadAttempted) return Notifications;
  loadAttempted = true;
  try {
    Notifications = await import('expo-notifications');
  } catch (error) {
    logger.warn('DeviceControlService', 'expo-notifications non disponibile', { error: error?.message });
    Notifications = null;
  }
  return Notifications;
}

class DeviceControlService {
  constructor() {
    this.canControl = false;
    this.notificationsGranted = false;
    this.supportedActions = [];
  }

  async init() {
    try {
      await this._checkCapabilities();
      await this._initializeNotifications();
      this.canControl = true;
      logger.info('DeviceControlService', 'Initialized', {
        supportedActions: this.supportedActions,
        notificationsGranted: this.notificationsGranted,
      });
    } catch (error) {
      logger.warn('DeviceControlService', 'Limited device control available', error);
    }
  }

  async _checkCapabilities() {
    this.supportedActions = [
      'send_notification',
      'open_url',
      'read_contacts',
      'read_calendar',
    ];
  }

  async _initializeNotifications() {
    const mod = await loadNotifications();
    if (!mod) return;
    const permission = await requestNotificationsPermission();
    this.notificationsGranted = !!permission.granted;
    if (this.notificationsGranted) {
      logger.info('DeviceControlService', 'Notification permissions granted');
    } else {
      logger.warn('DeviceControlService', 'Notification permissions not granted');
    }
  }

  async sendNotification(title, body, data = {}) {
    if (!this.notificationsGranted) {
      logger.warn('DeviceControlService', 'Skipping notification — no permission');
      return false;
    }
    const mod = await loadNotifications();
    if (!mod) return false;
    try {
      await mod.scheduleNotificationAsync({
        content: { title, body, data, sound: true, badge: 1 },
        trigger: { seconds: 1 },
      });
      return true;
    } catch (error) {
      logger.error('DeviceControlService', 'Failed to send notification', error);
      return false;
    }
  }

  async openUrl(url) {
    try {
      if (typeof window !== 'undefined' && window.open) {
        window.open(url, '_blank');
        return true;
      }
      const Linking = (await import('react-native')).Linking;
      await Linking.openURL(url);
      return true;
    } catch (error) {
      logger.error('DeviceControlService', 'Failed to open URL', error);
      return false;
    }
  }

  getAvailableActions() { return this.supportedActions; }
  isActionSupported(action) { return this.supportedActions.includes(action); }
}

export const deviceControlService = new DeviceControlService();
export default DeviceControlService;
