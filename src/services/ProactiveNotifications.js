/**
 * ProactiveNotifications.js - Notifiche Push Proattive JARVIS
 * Manda notifiche intelligenti basate su contesto e abitudini
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { contextEngine } from './ContextEngine';
import { logger } from '../utils/Logger';

const STORAGE_KEY = 'echo_notifications_config';

// Tipi di notifica
const NOTIFICATION_TYPES = {
  GREETING: 'greeting',
  REMINDER: 'reminder',
  SUGGESTION: 'suggestion',
  BREAK: 'break',
  WEATHER: 'weather',
  CALENDAR: 'calendar',
  HABIT: 'habit',
  CUSTOM: 'custom'
};

// Template notifiche
const NOTIFICATION_TEMPLATES = {
  [NOTIFICATION_TYPES.GREETING]: {
    title: ['Buongiorno!', 'Ciao!', 'Eccomi!', 'Pronto!'],
    body: [
      'Sono Echo, il tuo assistente personale. Come posso aiutarti?',
      'Pronto a iniziare la giornata?',
      'Oggi ho energie infinite, tu?',
      'Buongiorno! Ho preparato un caffè virtuale per te!'
    ]
  },
  [NOTIFICATION_TYPES.BREAK]: {
    title: ['Pausa!', 'Riposo!', 'Relax!'],
    body: [
      'Hai lavorato un po\', fai una pausa!',
      'Un caffè? Hai lavorato abbastanza!',
      'Stacca la spina per 5 minuti!',
      'Il corpo ti ringrazierà!'
    ]
  },
  [NOTIFICATION_TYPES.SUGGESTION]: {
    title: ['Suggerimento', 'Idea', 'Consiglio'],
    body: [
      'Ho notato che sei più attivo la mattina. Vuoi che ti aiuti a pianificare?',
      'Oggi è ${day}! Hai qualcosa di piano?',
      'Ho trovato un articolo interessante, vuoi che te lo mostri?',
      'Vuoi che ti ricordi di bere acqua?'
    ]
  },
  [NOTIFICATION_TYPES.REMINDER]: {
    title: ['Promemoria', 'Ricorda!', 'Attenzione!'],
    body: [
      'Hai un impegno tra poco!',
      'Non dimenticare ${task}!',
      'È ora di ${action}!',
      'Tempo rimasto: ${time}'
    ]
  },
  [NOTIFICATION_TYPES.HABIT]: {
    title: ['Habitudine', 'Routine', 'Consuetudine'],
    body: [
      'Ore ${hour}: è il momento di ${habit}!',
      'Come al solito, ora è ora di ${habit}!',
      'Ho notato che a quest\'ora fai ${habit}. Vuoi che ti aiuti?',
      'Routine delle ${hour}: ${habit}'
    ]
  }
};

class ProactiveNotificationsService {
  constructor() {
    this.config = {
      enabled: true,
      quietHoursStart: 22,
      quietHoursEnd: 7,
      maxNotificationsPerDay: 10,
      types: {
        [NOTIFICATION_TYPES.GREETING]: true,
        [NOTIFICATION_TYPES.BREAK]: true,
        [NOTIFICATION_TYPES.SUGGESTION]: true,
        [NOTIFICATION_TYPES.REMINDER]: true,
        [NOTIFICATION_TYPES.HABIT]: true
      }
    };
    this.notificationCount = 0;
    this.lastNotificationDate = null;
    this.scheduledNotifications = [];
  }

  /**
   * Inizializza il servizio notifiche
   */
  async init() {
    try {
      await this.loadConfig();
      await this.requestPermissions();
      this.setupNotificationHandler();
      
      logger.info('ProactiveNotifications', 'Initialized successfully');
      return true;
    } catch (error) {
      logger.error('ProactiveNotifications', 'Failed to initialize', error);
      return false;
    }
  }

  /**
   * Carica configurazione
   */
  async loadConfig() {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.config = { ...this.config, ...JSON.parse(saved) };
      }
    } catch (error) {
      logger.warn('ProactiveNotifications', 'Failed to load config', error);
    }
  }

  /**
   * Salva configurazione
   */
  async saveConfig() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      logger.warn('ProactiveNotifications', 'Failed to save config', error);
    }
  }

  /**
   * Richiedi permessi notifiche
   */
  async requestPermissions() {
    if (!Device.isDevice) {
      logger.warn('ProactiveNotifications', 'Notifications work best on physical devices');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      logger.warn('ProactiveNotifications', 'Notification permissions not granted');
      return false;
    }

    // Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('echo-default', {
        name: 'Echo Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3B82F6'
      });
    }

    return true;
  }

  /**
   * Configura handler notifiche
   */
  setupNotificationHandler() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false
      })
    });
  }

  /**
   * Verifica se è un buon momento per notificare
   */
  canNotify() {
    if (!this.config.enabled) {
      return { allowed: false, reason: 'Notifiche disabilitate' };
    }

    const now = new Date();
    const hour = now.getHours();

    // Controlla ore silenziose
    if (hour >= this.config.quietHoursStart || hour < this.config.quietHoursEnd) {
      return { allowed: false, reason: 'Ore silenziose' };
    }

    // Controlla limite giornaliero
    const today = now.toDateString();
    if (this.lastNotificationDate === today && 
        this.notificationCount >= this.config.maxNotificationsPerDay) {
      return { allowed: false, reason: 'Limite giornaliero raggiunto' };
    }

    // Reset contatore se nuovo giorno
    if (this.lastNotificationDate !== today) {
      this.notificationCount = 0;
      this.lastNotificationDate = today;
    }

    // Controlla contesto
    const contextCheck = contextEngine.shouldNotify();
    if (!contextCheck.should) {
      return { allowed: false, reason: contextCheck.reason };
    }

    return { allowed: true };
  }

  /**
   * Genera notifica casuale da template
   */
  generateNotification(type, customData = {}) {
    const template = NOTIFICATION_TEMPLATES[type];
    if (!template) return null;

    const title = template.title[Math.floor(Math.random() * template.title.length)];
    let body = template.body[Math.floor(Math.random() * template.body.length)];

    // Sostituisci variabili
    const now = new Date();
    const substitutions = {
      '${day}': ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'][now.getDay()],
      '${hour}': `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
      '${task}': customData.task || 'qualcosa',
      '${action}': customData.action || 'azione',
      '${time}': customData.time || 'poco',
      '${habit}': customData.habit || 'abitudine'
    };

    for (const [key, value] of Object.entries(substitutions)) {
      body = body.replace(key, value);
    }

    return { title, body, type };
  }

  /**
   * Invia notifica
   */
  async sendNotification(title, body, data = {}) {
    const check = this.canNotify();
    if (!check.allowed) {
      logger.info('ProactiveNotifications', `Notification skipped: ${check.reason}`);
      return false;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            ...data,
            timestamp: new Date().toISOString()
          },
          sound: true,
          ...(Platform.OS === 'android' && { channelId: 'echo-default' })
        },
        trigger: null // Invia subito
      });

      this.notificationCount++;
      this.lastNotificationDate = new Date().toDateString();
      
      logger.info('ProactiveNotifications', 'Notification sent', { title, body });
      return true;
    } catch (error) {
      logger.error('ProactiveNotifications', 'Failed to send notification', error);
      return false;
    }
  }

  /**
   * Invia notifica di saluto
   */
  async sendGreetingNotification(userName = null) {
    const context = contextEngine.getFullContext();
    const notification = this.generateNotification(NOTIFICATION_TYPES.GREETING);
    
    if (!notification) return false;

    let body = notification.body;
    if (userName) {
      body = `${userName}, ${body.toLowerCase()}`;
    }

    return this.sendNotification(notification.title, body, {
      type: NOTIFICATION_TYPES.GREETING,
      context: context.timeOfDay
    });
  }

  /**
   * Invia notifica pausa
   */
  async sendBreakNotification() {
    const notification = this.generateNotification(NOTIFICATION_TYPES.BREAK);
    if (!notification) return false;

    return this.sendNotification(notification.title, notification.body, {
      type: NOTIFICATION_TYPES.BREAK
    });
  }

  /**
   * Invia suggerimento proattivo
   */
  async sendSuggestionNotification() {
    const suggestion = contextEngine.getProactiveSuggestion();
    if (!suggestion) return false;

    return this.sendNotification('💡 Suggerimento', suggestion, {
      type: NOTIFICATION_TYPES.SUGGESTION
    });
  }

  /**
   * Invia notifica abitudine
   */
  async sendHabitNotification(habitName) {
    const notification = this.generateNotification(NOTIFICATION_TYPES.HABIT, { habit: habitName });
    if (!notification) return false;

    return this.sendNotification(notification.title, notification.body, {
      type: NOTIFICATION_TYPES.HABIT,
      habit: habitName
    });
  }

  /**
   * Pianifica notifica futura
   */
  async scheduleNotification(title, body, trigger, data = {}) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          ...(Platform.OS === 'android' && { channelId: 'echo-default' })
        },
        trigger
      });

      this.scheduledNotifications.push({ id, title, body, trigger, data });
      logger.info('ProactiveNotifications', 'Notification scheduled', { id, title });
      
      return id;
    } catch (error) {
      logger.error('ProactiveNotifications', 'Failed to schedule notification', error);
      return null;
    }
  }

  /**
   * Cancella notifica pianificata
   */
  async cancelScheduledNotification(id) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
      this.scheduledNotifications = this.scheduledNotifications.filter(n => n.id !== id);
      return true;
    } catch (error) {
      logger.error('ProactiveNotifications', 'Failed to cancel notification', error);
      return false;
    }
  }

  /**
   * Abilita/disabilita notifiche
   */
  async setEnabled(enabled) {
    this.config.enabled = enabled;
    await this.saveConfig();
  }

  /**
   * Imposta ore silenziose
   */
  async setQuietHours(start, end) {
    this.config.quietHoursStart = start;
    this.config.quietHoursEnd = end;
    await this.saveConfig();
  }

  /**
   * Ottieni configurazione corrente
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Ottieni statistiche
   */
  getStats() {
    return {
      notificationCount: this.notificationCount,
      lastNotificationDate: this.lastNotificationDate,
      scheduledCount: this.scheduledNotifications.length,
      enabled: this.config.enabled
    };
  }
}

export const proactiveNotifications = new ProactiveNotificationsService();
export { NOTIFICATION_TYPES };
export default ProactiveNotificationsService;
