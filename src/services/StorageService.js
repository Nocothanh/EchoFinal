/**
 * StorageService.js - Persistenza dati con SQLite
 * Gestisce: conversazioni, user profile, activity logs, preferences
 */

import * as SQLite from 'expo-sqlite';
import { logger } from '../utils/Logger';
import { errorHandler } from '../middleware/ErrorHandler';

class StorageService {
  constructor() {
    this.db = null;
    this.dbName = 'jarvis.db';
    this.initialized = false;
  }

  /**
   * Inizializza database SQLite
   */
  async init() {
    try {
      this.db = await SQLite.openDatabaseAsync(this.dbName);
      await this._createTables();
      this.initialized = true;
      logger.info('StorageService', 'Database initialized successfully');
    } catch (error) {
      logger.error('StorageService', 'Database initialization failed', error);
      throw error;
    }
  }

  /**
   * Crea tabelle principali
   */
  async _createTables() {
    const tables = [
      // Conversazioni
      `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        title TEXT,
        messageCount INTEGER DEFAULT 0,
        lastMessage TEXT,
        sentiment TEXT,
        topics TEXT
      )`,

      // Messaggi
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversationId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        duration INTEGER,
        sentiment TEXT,
        metadata TEXT,
        FOREIGN KEY(conversationId) REFERENCES conversations(id)
      )`,

      // Profilo utente
      `CREATE TABLE IF NOT EXISTS user_profile (
        userId TEXT PRIMARY KEY,
        name TEXT,
        timezone TEXT,
        language TEXT,
        preferences TEXT,
        metadata TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Activity tracking
      `CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT,
        description TEXT,
        startTime DATETIME NOT NULL,
        endTime DATETIME,
        duration INTEGER,
        tags TEXT,
        metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Location history
      `CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        accuracy REAL,
        address TEXT,
        timestamp DATETIME NOT NULL
      )`,

      // App usage
      `CREATE TABLE IF NOT EXISTS app_usage (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        appName TEXT,
        startTime DATETIME NOT NULL,
        endTime DATETIME,
        duration INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Preferences & settings
      `CREATE TABLE IF NOT EXISTS preferences (
        userId TEXT PRIMARY KEY,
        communicationStyle TEXT DEFAULT 'professional',
        responseLength TEXT DEFAULT 'medium',
        proactivityLevel TEXT DEFAULT 'high',
        notificationFrequency TEXT DEFAULT 'smart',
        privacyLevel TEXT DEFAULT 'high',
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Daily briefings
      `CREATE TABLE IF NOT EXISTS briefings (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        date DATE NOT NULL,
        briefingText TEXT,
        meetingsCount INTEGER,
        tasksCount INTEGER,
        eventsCount INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    ];

    for (const table of tables) {
      try {
        await this.db.execAsync(table);
      } catch (error) {
        logger.warn('StorageService', `Table creation skipped (may already exist)`, { error: error.message });
      }
    }
  }

  /**
   * Salva messaggio conversazione
   */
  async saveMessage(conversationId, role, content, metadata = {}) {
    try {
      const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.db.runAsync(
        `INSERT INTO messages (id, conversationId, role, content, timestamp, metadata)
         VALUES (?, ?, ?, ?, datetime('now'), ?)`,
        [id, conversationId, role, content, JSON.stringify(metadata)]
      );
      logger.debug('StorageService', 'Message saved', { id, conversationId });
      return id;
    } catch (error) {
      logger.error('StorageService', 'Failed to save message', error);
      throw error;
    }
  }

  /**
   * Ottieni conversazione con messaggi
   */
  async getConversation(conversationId) {
    try {
      const conversation = await this.db.getFirstAsync(
        'SELECT * FROM conversations WHERE id = ?',
        [conversationId]
      );

      const messages = await this.db.getAllAsync(
        'SELECT * FROM messages WHERE conversationId = ? ORDER BY timestamp ASC',
        [conversationId]
      );

      return {
        ...conversation,
        messages: messages.map(m => ({
          ...m,
          metadata: m.metadata ? JSON.parse(m.metadata) : {},
        })),
      };
    } catch (error) {
      logger.error('StorageService', 'Failed to get conversation', error);
      return null;
    }
  }

  /**
   * Crea nuova conversazione
   */
  async createConversation(userId, title = 'New Conversation') {
    try {
      const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.db.runAsync(
        `INSERT INTO conversations (id, userId, title) VALUES (?, ?, ?)`,
        [id, userId, title]
      );
      logger.info('StorageService', 'Conversation created', { id });
      return id;
    } catch (error) {
      logger.error('StorageService', 'Failed to create conversation', error);
      throw error;
    }
  }

  /**
   * Salva attività utente
   */
  async logActivity(userId, type, title, description = '', metadata = {}) {
    try {
      const id = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.db.runAsync(
        `INSERT INTO activities (id, userId, type, title, description, startTime, metadata)
         VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`,
        [id, userId, type, title, description, JSON.stringify(metadata)]
      );
      logger.debug('StorageService', 'Activity logged', { id, type });
      return id;
    } catch (error) {
      logger.error('StorageService', 'Failed to log activity', error);
    }
  }

  /**
   * Aggiorna profilo utente
   */
  async updateUserProfile(userId, profileData) {
    try {
      const existing = await this.db.getFirstAsync(
        'SELECT * FROM user_profile WHERE userId = ?',
        [userId]
      );

      if (existing) {
        await this.db.runAsync(
          `UPDATE user_profile SET name = ?, timezone = ?, language = ?, metadata = ?, updatedAt = datetime('now')
           WHERE userId = ?`,
          [profileData.name, profileData.timezone, profileData.language, JSON.stringify(profileData), userId]
        );
      } else {
        await this.db.runAsync(
          `INSERT INTO user_profile (userId, name, timezone, language, preferences, metadata)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [userId, profileData.name, profileData.timezone, profileData.language, '{}', JSON.stringify(profileData)]
        );
      }
      logger.info('StorageService', 'User profile updated', { userId });
    } catch (error) {
      logger.error('StorageService', 'Failed to update user profile', error);
    }
  }

  /**
   * Ottieni statistiche utente
   */
  async getUserStats(userId, daysBack = 7) {
    try {
      const stats = await this.db.getFirstAsync(
        `SELECT
           COUNT(DISTINCT conversationId) as totalConversations,
           COUNT(*) as totalMessages,
           AVG(CAST(duration AS FLOAT)) as avgMessageDuration
         FROM messages m
         JOIN conversations c ON m.conversationId = c.id
         WHERE c.userId = ? AND m.timestamp > datetime('now', '-${daysBack} days')`,
        [userId]
      );

      const activities = await this.db.getAllAsync(
        `SELECT type, COUNT(*) as count FROM activities
         WHERE userId = ? AND timestamp > datetime('now', '-${daysBack} days')
         GROUP BY type`,
        [userId]
      );

      return {
        conversations: stats?.totalConversations || 0,
        messages: stats?.totalMessages || 0,
        avgDuration: stats?.avgMessageDuration || 0,
        activities: activities.reduce((acc, a) => ({ ...acc, [a.type]: a.count }), {}),
      };
    } catch (error) {
      logger.error('StorageService', 'Failed to get user stats', error);
      return null;
    }
  }

  /**
   * Cerca conversazioni per keywords
   */
  async searchConversations(userId, query) {
    try {
      return await this.db.getAllAsync(
        `SELECT c.* FROM conversations c
         JOIN messages m ON c.id = m.conversationId
         WHERE c.userId = ? AND (c.title LIKE ? OR m.content LIKE ?)
         GROUP BY c.id
         ORDER BY c.timestamp DESC`,
        [userId, `%${query}%`, `%${query}%`]
      );
    } catch (error) {
      logger.error('StorageService', 'Search failed', error);
      return [];
    }
  }

  /**
   * Pulisci dati vecchi
   */
  async cleanupOldData(daysToKeep = 90) {
    try {
      await this.db.runAsync(
        `DELETE FROM messages WHERE timestamp < datetime('now', '-${daysToKeep} days')`
      );
      await this.db.runAsync(
        `DELETE FROM activities WHERE timestamp < datetime('now', '-${daysToKeep} days')`
      );
      logger.info('StorageService', `Cleanup completed (keeping last ${daysToKeep} days)`);
    } catch (error) {
      logger.error('StorageService', 'Cleanup failed', error);
    }
  }
}

export const storageService = new StorageService();
export default StorageService;
