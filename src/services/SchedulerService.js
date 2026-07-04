/**
 * SchedulerService.js - Pianificazione e task scheduling
 * Implementa: task scheduling, reminders, daily briefing, proactive notifications
 */

import { storageService } from './StorageService';
import { logger } from '../utils/Logger';

class SchedulerService {
  constructor() {
    this.tasks = new Map();
    this.timers = new Map();
    this.enabled = true;
  }

  /**
   * Inizializza lo scheduler
   */
  async init(options = {}) {
    this.enabled = options.enabled !== false;
    logger.info('SchedulerService', 'Initialized');
  }

  /**
   * Crea task programmato
   */
  async createTask(userId, title, description, scheduledTime, priority = 'medium', metadata = {}) {
    try {
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const task = {
        id: taskId,
        userId,
        title,
        description,
        scheduledTime: new Date(scheduledTime),
        priority, // 'low', 'medium', 'high', 'urgent'
        completed: false,
        metadata,
        createdAt: new Date(),
      };

      this.tasks.set(taskId, task);
      this._scheduleTask(task);

      logger.info('SchedulerService', 'Task created', { taskId, title });
      return task;
    } catch (error) {
      logger.error('SchedulerService', 'Failed to create task', error);
      throw error;
    }
  }

  /**
   * Pianifica esecuzione task
   */
  _scheduleTask(task) {
    const delay = task.scheduledTime.getTime() - Date.now();
    if (delay <= 0) {
      this._executeTask(task);
      return;
    }

    const timerId = setTimeout(() => {
      this._executeTask(task);
      this.tasks.delete(task.id);
    }, delay);

    this.timers.set(task.id, timerId);
  }

  /**
   * Esegui task
   */
  async _executeTask(task) {
    logger.info('SchedulerService', 'Executing task', { taskId: task.id, title: task.title });
    // Trigger notifica/callback
    if (task.metadata.callback) {
      await task.metadata.callback(task);
    }
  }

  /**
   * Crea reminder
   */
  async createReminder(userId, title, scheduledTime, recurring = null) {
    try {
      const reminderId = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const reminder = {
        id: reminderId,
        userId,
        title,
        scheduledTime: new Date(scheduledTime),
        recurring, // null, 'daily', 'weekly', 'monthly'
        createdAt: new Date(),
      };

      if (recurring) {
        this._scheduleRecurringReminder(reminder);
      } else {
        this._scheduleTask({ ...reminder, metadata: {} });
      }

      logger.info('SchedulerService', 'Reminder created', { reminderId, title });
      return reminder;
    } catch (error) {
      logger.error('SchedulerService', 'Failed to create reminder', error);
    }
  }

  /**
   * Pianifica reminder ricorrente
   */
  _scheduleRecurringReminder(reminder) {
    const next = this._getNextOccurrence(reminder.scheduledTime, reminder.recurring);
    const delay = next.getTime() - Date.now();

    const timerId = setTimeout(async () => {
      logger.info('SchedulerService', 'Recurring reminder triggered', { title: reminder.title });
      // Re-schedule
      this._scheduleRecurringReminder(reminder);
    }, delay);

    this.timers.set(reminder.id, timerId);
  }

  /**
   * Calcola prossima occorrenza
   */
  _getNextOccurrence(date, recurring) {
    const next = new Date(date);
    const intervals = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };
    next.setTime(next.getTime() + (intervals[recurring] || 0));
    return next;
  }

  /**
   * Ottieni task in sospeso
   */
  getPendingTasks(userId) {
    return Array.from(this.tasks.values())
      .filter(t => t.userId === userId && !t.completed)
      .sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  /**
   * Segna task come completato
   */
  completeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.completed = true;
      if (this.timers.has(taskId)) {
        clearTimeout(this.timers.get(taskId));
        this.timers.delete(taskId);
      }
      logger.info('SchedulerService', 'Task completed', { taskId });
    }
  }
}

export const schedulerService = new SchedulerService();
export default SchedulerService;
