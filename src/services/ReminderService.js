/**
 * ReminderService.js
 * Timed reminders with natural language parsing
 */

import * as Notifications from 'expo-notifications';

class ReminderService {
  constructor() {
    this.isInitialized = false;
    this.reminders = new Map();
    this.reminderIdCounter = 0;
  }

  async init() {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') await Notifications.requestPermissionsAsync();
    this.isInitialized = true;
    await this.loadReminders();
    return true;
  }

  async setReminder(title, triggerDate, options = {}) {
    const id = `reminder_${++this.reminderIdCounter}`;
    const reminder = {
      id,
      title,
      message: options.message || title,
      date: triggerDate instanceof Date ? triggerDate.toISOString() : triggerDate,
      recurring: options.recurring || false,
      repeatInterval: options.repeatInterval || null,
      createdAt: Date.now()
    };

    const trigger = new Date(reminder.date);
    if (trigger <= new Date()) return { success: false, error: 'Reminder date is in the past' };

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔔 Promemoria`,
        body: title,
        data: { reminderId: id },
        sound: true
      },
      trigger: {
        type: 'date',
        date: trigger
      }
    });

    reminder.notificationId = notificationId;
    this.reminders.set(id, reminder);
    await this.saveReminders();
    return { success: true, reminder };
  }

  async setReminderIn(title, minutes, options = {}) {
    const date = new Date(Date.now() + minutes * 60000);
    return this.setReminder(title, date, options);
  }

  async setDailyReminder(title, hour, minute, options = {}) {
    const now = new Date();
    let next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return this.setReminder(title, next, { ...options, recurring: true, repeatInterval: 'daily' });
  }

  async cancelReminder(id) {
    const reminder = this.reminders.get(id);
    if (!reminder) return { success: false, error: 'Reminder not found' };

    if (reminder.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
    }
    this.reminders.delete(id);
    await this.saveReminders();
    return { success: true };
  }

  async cancelAllReminders() {
    for (const [, reminder] of this.reminders) {
      if (reminder.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
      }
    }
    this.reminders.clear();
    await this.saveReminders();
    return { success: true };
  }

  getActiveReminders() {
    const now = new Date();
    return Array.from(this.reminders.values())
      .filter(r => new Date(r.date) > now)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  parseNaturalReminder(text) {
    const lower = text.toLowerCase();
    let totalMinutes = 0;
    let title = text;

    const patterns = [
      { regex: /(?:ricordami|remind me|remember)\s+(?:to\s+)?(.+?)(?:\s+(?:in|tra|after|fra)\s+(.+))?$/i, group: 1, timeGroup: 2 },
      { regex: /(.+?)(?:\s+(?:in|tra|after|fra)\s+(.+))$/i, group: 1, timeGroup: 2 }
    ];

    let match = null;
    for (const p of patterns) {
      match = text.match(p.regex);
      if (match) {
        title = match[p.group].trim();
        const timeStr = match[p.timeGroup]?.trim() || '';
        const timeMatch = timeStr.match(/(\d+)\s*(min|minuto|minuti|hour|ora|ore|sec|secondo|secondi|day|giorno|giorni|week|settimana)/i);
        if (timeMatch) {
          const val = parseInt(timeMatch[1]);
          const unit = timeMatch[2].toLowerCase();
          if (unit.startsWith('hour') || unit.startsWith('ora')) totalMinutes += val * 60;
          else if (unit.startsWith('day') || unit.startsWith('giorn')) totalMinutes += val * 1440;
          else if (unit.startsWith('week') || unit.startsWith('settiman')) totalMinutes += val * 10080;
          else totalMinutes += val;
        }
        break;
      }
    }

    if (totalMinutes === 0) {
      totalMinutes = 30;
    }

    return { title, minutes: totalMinutes };
  }

  async saveReminders() {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('echo_reminders', JSON.stringify(Array.from(this.reminders.values())));
    } catch (e) {}
  }

  async loadReminders() {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const data = await AsyncStorage.getItem('echo_reminders');
      if (data) {
        const reminders = JSON.parse(data);
        reminders.forEach(r => this.reminders.set(r.id, r));
        this.reminderIdCounter = Math.max(...reminders.map(r => parseInt(r.id.split('_')[1]) || 0), 0);
      }
    } catch (e) {}
  }

  cleanup() {
    this.reminders.clear();
  }
}

export const reminderService = new ReminderService();
export default ReminderService;
