/**
 * AlarmService.js
 * Set alarms, recurring schedules, and timed reminders
 */

import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';

class AlarmService {
  constructor() {
    this.isInitialized = false;
    this.alarms = new Map();
    this.alarmIdCounter = 0;
    this.scheduledNotifications = new Map();
  }

  async init() {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }
    this.isInitialized = true;
    await this.loadAlarms();
    return true;
  }

  async setAlarm(name, hour, minute, options = {}) {
    const id = `alarm_${++this.alarmIdCounter}`;
    const alarm = {
      id,
      name: name || `Alarm ${this.alarmIdCounter}`,
      hour: Math.max(0, Math.min(23, hour)),
      minute: Math.max(0, Math.min(59, minute)),
      enabled: true,
      recurring: options.recurring || false,
      days: options.days || [],
      sound: options.sound !== false,
      vibrate: options.vibrate !== false,
      label: options.label || '',
      snoozeEnabled: options.snoozeEnabled !== false,
      snoozeMinutes: options.snoozeMinutes || 9,
      createdAt: Date.now()
    };

    this.alarms.set(id, alarm);
    await this.scheduleAlarmNotification(alarm);
    await this.saveAlarms();
    return { success: true, alarm };
  }

  async setAlarmIn(name, minutes, options = {}) {
    const now = new Date();
    const target = new Date(now.getTime() + minutes * 60000);
    return this.setAlarm(name, target.getHours(), target.getMinutes(), options);
  }

  async setAlarmAt(name, timeString, options = {}) {
    const match = timeString.match(/(\d{1,2}):(\d{2})/);
    if (!match) {
      const hourMatch = timeString.match(/(\d{1,2})\s*(am|pm|di mattina|di sera|pomeriggio|stamattina)/i);
      if (hourMatch) {
        let hour = parseInt(hourMatch[1]);
        const suffix = hourMatch[2].toLowerCase();
        if (suffix === 'pm' || suffix === 'di sera' || suffix === 'pomeriggio') {
          if (hour < 12) hour += 12;
        } else if (suffix === 'am' || suffix === 'stamattina' || suffix === 'di mattina') {
          if (hour === 12) hour = 0;
        }
        return this.setAlarm(name, hour, 0, options);
      }
      return { success: false, error: 'Invalid time format. Use HH:MM or "7 am" or "8 di sera"' };
    }

    let hour = parseInt(match[1]);
    const minute = parseInt(match[2]);
    const isPM = /pm|di sera|pomeriggio/i.test(timeString);
    const isAM = /am|di mattina|stamattina/i.test(timeString);

    if (isPM && hour < 12) hour += 12;
    if (isAM && hour === 12) hour = 0;

    return this.setAlarm(name, hour, minute, options);
  }

  async scheduleAlarmNotification(alarm) {
    const now = new Date();
    let nextAlarm = new Date();
    nextAlarm.setHours(alarm.hour, alarm.minute, 0, 0);

    if (nextAlarm <= now) {
      nextAlarm.setDate(nextAlarm.getDate() + 1);
    }

    if (alarm.recurring && alarm.days.length > 0) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayNumbers = alarm.days.map(d => dayNames.indexOf(d.toLowerCase())).filter(d => d >= 0);

      let found = false;
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() + i);
        checkDate.setHours(alarm.hour, alarm.minute, 0, 0);

        if (dayNumbers.includes(checkDate.getDay()) && checkDate > now) {
          nextAlarm = checkDate;
          found = true;
          break;
        }
      }

      if (!found) {
        const nextDay = dayNumbers.sort((a, b) => {
          const diffA = (a - now.getDay() + 7) % 7;
          const diffB = (b - now.getDay() + 7) % 7;
          return diffA - diffB;
        })[0];
        nextAlarm.setDate(nextAlarm.getDate() + ((nextDay - now.getDay() + 7) % 7 || 7));
      }
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ ${alarm.name}`,
        body: alarm.label || `Sono le ${alarm.hour}:${String(alarm.minute).padStart(2, '0')}`,
        sound: alarm.sound ? 'alarm.wav' : undefined,
        vibrate: alarm.vibrate ? [0, 250, 250, 250] : undefined,
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { alarmId: alarm.id }
      },
      trigger: {
        type: 'date',
        date: nextAlarm,
        channelId: 'alarms'
      }
    });

    this.scheduledNotifications.set(alarm.id, notificationId);
  }

  async snoozeAlarm(alarmId) {
    const alarm = this.alarms.get(alarmId);
    if (!alarm) return { success: false, error: 'Alarm not found' };
    return this.setAlarmIn(`${alarm.name} (snooze)`, alarm.snoozeMinutes, { ...alarm, recurring: false });
  }

  async toggleAlarm(alarmId) {
    const alarm = this.alarms.get(alarmId);
    if (!alarm) return { success: false, error: 'Alarm not found' };

    alarm.enabled = !alarm.enabled;

    if (alarm.enabled) {
      await this.scheduleAlarmNotification(alarm);
    } else {
      const notificationId = this.scheduledNotifications.get(alarmId);
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        this.scheduledNotifications.delete(alarmId);
      }
    }

    await this.saveAlarms();
    return { success: true, alarm };
  }

  async deleteAlarm(alarmId) {
    const notificationId = this.scheduledNotifications.get(alarmId);
    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      this.scheduledNotifications.delete(alarmId);
    }
    this.alarms.delete(alarmId);
    await this.saveAlarms();
    return { success: true };
  }

  getActiveAlarms() {
    return Array.from(this.alarms.values()).filter(a => a.enabled);
  }

  getAllAlarms() {
    return Array.from(this.alarms.values());
  }

  getNextAlarm() {
    const now = new Date();
    const active = this.getActiveAlarms();
    if (active.length === 0) return null;

    let next = null;
    let nextTime = Infinity;

    for (const alarm of active) {
      let alarmTime = new Date();
      alarmTime.setHours(alarm.hour, alarm.minute, 0, 0);
      if (alarmTime <= now) alarmTime.setDate(alarmTime.getDate() + 1);
      if (alarmTime.getTime() < nextTime) {
        nextTime = alarmTime.getTime();
        next = alarm;
      }
    }

    return next ? { ...next, nextTrigger: new Date(nextTime) } : null;
  }

  async saveAlarms() {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const alarmsArray = Array.from(this.alarms.values());
      await AsyncStorage.setItem('echo_alarms', JSON.stringify(alarmsArray));
    } catch (e) {}
  }

  async loadAlarms() {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const data = await AsyncStorage.getItem('echo_alarms');
      if (data) {
        const alarms = JSON.parse(data);
        alarms.forEach(a => this.alarms.set(a.id, a));
        this.alarmIdCounter = Math.max(...alarms.map(a => parseInt(a.id.split('_')[1]) || 0), 0);
      }
    } catch (e) {}
  }

  parseNaturalAlarm(text) {
    const lower = text.toLowerCase();
    const patterns = [
      { regex: /alarm.*?(\d{1,2}):(\d{2})/, handler: (m) => ({ hour: parseInt(m[1]), minute: parseInt(m[2]) }) },
      { regex: /alarm.*?(\d{1,2})\s*(am|pm)/i, handler: (m) => {
        let h = parseInt(m[1]);
        if (m[2].toLowerCase() === 'pm' && h < 12) h += 12;
        if (m[2].toLowerCase() === 'am' && h === 12) h = 0;
        return { hour: h, minute: 0 };
      }},
      { regex: /alarm.*?(\d+)\s*(min|minute|minuti)/i, handler: (m) => {
        const mins = parseInt(m[1]);
        const d = new Date(Date.now() + mins * 60000);
        return { hour: d.getHours(), minute: d.getMinutes() };
      }},
      { regex: /domani.*?(\d{1,2}):(\d{2})/, handler: (m) => ({ hour: parseInt(m[1]), minute: parseInt(m[2]), tomorrow: true }) },
    ];

    for (const pattern of patterns) {
      const match = lower.match(pattern.regex);
      if (match) return pattern.handler(match);
    }
    return null;
  }

  cleanup() {
    this.scheduledNotifications.forEach(id => {
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    });
    this.scheduledNotifications.clear();
  }
}

export const alarmService = new AlarmService();
export default AlarmService;
