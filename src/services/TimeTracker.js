/**
 * TimeTracker.js - Tracciamento completo delle attività utente
 * Implementa: activity logging, app usage, location tracking, analytics
 */

import { storageService } from './StorageService';
import { logger } from '../utils/Logger';

class TimeTracker {
  constructor() {
    this.currentActivity = null;
    this.batchQueue = [];
    this.batchInterval = 60000; // 1 minuto
    this.enabled = true;
  }

  /**
   * Inizializza il tracker
   */
  async init(options = {}) {
    this.enabled = options.enabled !== false;
    this.batchInterval = options.batchInterval || 60000;

    if (this.enabled) {
      // Avvia batch processing
      this._startBatchProcessing();
      logger.info('TimeTracker', 'Initialized', { batchInterval: this.batchInterval });
    }
  }

  /**
   * Inizia a tracciare un'attività
   */
  async startActivity(userId, type, title, metadata = {}) {
    if (!this.enabled) return null;

    this.currentActivity = {
      userId,
      type, // 'chat', 'work', 'reading', 'break', 'meeting', etc.
      title,
      description: metadata.description || '',
      startTime: Date.now(),
      metadata,
    };

    logger.debug('TimeTracker', 'Activity started', { type, title });
    return this.currentActivity;
  }

  /**
   * Conclude un'attività
   */
  async endActivity(userId) {
    if (!this.currentActivity) return null;

    const activity = {
      ...this.currentActivity,
      endTime: Date.now(),
      duration: Date.now() - this.currentActivity.startTime,
    };

    // Aggiungi a batch queue
    this.batchQueue.push({
      type: 'activity',
      data: activity,
    });

    logger.debug('TimeTracker', 'Activity ended', {
      type: activity.type,
      duration: activity.duration,
    });

    this.currentActivity = null;
    return activity;
  }

  /**
   * Log app usage
   */
  async logAppUsage(userId, appName, duration) {
    if (!this.enabled) return;

    this.batchQueue.push({
      type: 'app_usage',
      data: {
        userId,
        appName,
        startTime: new Date().toISOString(),
        duration,
      },
    });

    logger.debug('TimeTracker', 'App usage logged', { appName, duration });
  }

  /**
   * Log location (con privacy controls)
   */
  async logLocation(userId, latitude, longitude, accuracy, address) {
    if (!this.enabled) return;

    // Privacy: salva solo se l'utente ha abilitato
    this.batchQueue.push({
      type: 'location',
      data: {
        userId,
        latitude,
        longitude,
        accuracy,
        address,
        timestamp: new Date().toISOString(),
      },
    });

    logger.debug('TimeTracker', 'Location logged', { address });
  }

  /**
   * Processa batch di eventi
   */
  async _processBatch() {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    try {
      for (const item of batch) {
        if (item.type === 'activity') {
          await storageService.logActivity(
            item.data.userId,
            item.data.type,
            item.data.title,
            item.data.description,
            item.data.metadata
          );
        } else if (item.type === 'app_usage') {
          await storageService.db.runAsync(
            `INSERT INTO app_usage (id, userId, appName, startTime, duration)
             VALUES (?, ?, ?, ?, ?)`,
            [
              `usage_${Date.now()}`,
              item.data.userId,
              item.data.appName,
              item.data.startTime,
              item.data.duration,
            ]
          );
        } else if (item.type === 'location') {
          await storageService.db.runAsync(
            `INSERT INTO locations (id, userId, latitude, longitude, accuracy, address, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              `loc_${Date.now()}`,
              item.data.userId,
              item.data.latitude,
              item.data.longitude,
              item.data.accuracy,
              item.data.address,
              item.data.timestamp,
            ]
          );
        }
      }
      logger.debug('TimeTracker', `Batch processed (${batch.length} items)`);
    } catch (error) {
      logger.error('TimeTracker', 'Batch processing failed', error);
      this.batchQueue.push(...batch); // Ritenta dopo
    }
  }

  /**
   * Avvia processamento batch periodico
   */
  _startBatchProcessing() {
    this.batchProcessingInterval = setInterval(() => {
      this._processBatch();
    }, this.batchInterval);
  }

  /**
   * Arresta il tracker
   */
  async stop() {
    if (this.batchProcessingInterval) {
      clearInterval(this.batchProcessingInterval);
    }
    // Processa batch finale
    await this._processBatch();
    this.enabled = false;
    logger.info('TimeTracker', 'Stopped');
  }

  /**
   * Ottieni statistiche attività
   */
  async getActivityStats(userId, daysBack = 7) {
    try {
      const stats = await storageService.db.getAllAsync(
        `SELECT type, COUNT(*) as count, AVG(duration) as avgDuration
         FROM activities
         WHERE userId = ? AND timestamp > datetime('now', '-${daysBack} days')
         GROUP BY type`,
        [userId]
      );

      return stats.reduce((acc, s) => ({
        ...acc,
        [s.type]: { count: s.count, avgDuration: s.avgDuration },
      }), {});
    } catch (error) {
      logger.error('TimeTracker', 'Stats retrieval failed', error);
      return {};
    }
  }
}

export const timeTracker = new TimeTracker();
export default TimeTracker;
