/**
 * UserProfile.js - Gestione profilo utente e memoria personale
 * Implementa: personalizzazione, preferenze, contesto utente
 */

import { storageService } from './StorageService';
import { logger } from '../utils/Logger';

class UserProfile {
  constructor() {
    this.userId = null;
    this.profile = null;
    this.preferences = null;
    this.contextWindow = []; // Ultimi messaggi per contesto
    this.maxContextSize = 10;
  }

  /**
   * Carica o crea profilo utente
   */
  async init(userId) {
    try {
      this.userId = userId;
      
      // Carica profilo da storage
      const profileData = await storageService.db.getFirstAsync(
        'SELECT * FROM user_profile WHERE userId = ?',
        [userId]
      );

      if (profileData) {
        this.profile = JSON.parse(profileData.metadata || '{}');
      } else {
        // Crea profilo di default
        this.profile = {
          userId,
          name: 'User',
          timezone: 'Europe/Rome',
          language: 'it-IT',
          createdAt: new Date().toISOString(),
        };
        await storageService.updateUserProfile(userId, this.profile);
      }

      // Carica preferenze
      const prefs = await storageService.db.getFirstAsync(
        'SELECT * FROM preferences WHERE userId = ?',
        [userId]
      );

      this.preferences = prefs || {
        userId,
        communicationStyle: 'professional',
        responseLength: 'medium',
        proactivityLevel: 'high',
        notificationFrequency: 'smart',
      };

      logger.info('UserProfile', 'Profile loaded', { userId, name: this.profile.name });
    } catch (error) {
      logger.error('UserProfile', 'Failed to initialize profile', error);
      throw error;
    }
  }

  /**
   * Aggiorna profilo utente
   */
  async updateProfile(updates) {
    try {
      this.profile = { ...this.profile, ...updates };
      await storageService.updateUserProfile(this.userId, this.profile);
      logger.info('UserProfile', 'Profile updated', { userId: this.userId });
    } catch (error) {
      logger.error('UserProfile', 'Failed to update profile', error);
    }
  }

  /**
   * Aggiorna preferenze di comunicazione
   */
  async updatePreferences(preferences) {
    try {
      this.preferences = { ...this.preferences, ...preferences };
      await storageService.db.runAsync(
        `INSERT OR REPLACE INTO preferences 
         (userId, communicationStyle, responseLength, proactivityLevel, notificationFrequency, privacyLevel)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          this.userId,
          this.preferences.communicationStyle,
          this.preferences.responseLength,
          this.preferences.proactivityLevel,
          this.preferences.notificationFrequency,
          this.preferences.privacyLevel || 'high',
        ]
      );
      logger.info('UserProfile', 'Preferences updated', { userId: this.userId });
    } catch (error) {
      logger.error('UserProfile', 'Failed to update preferences', error);
    }
  }

  /**
   * Aggiungi messaggio al context window
   */
  addToContextWindow(message) {
    this.contextWindow.push(message);
    if (this.contextWindow.length > this.maxContextSize) {
      this.contextWindow.shift();
    }
  }

  /**
   * Ottieni contesto per prompt Jarvis
   */
  getContextPrompt() {
    const recentMessages = this.contextWindow
      .slice(-5)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    return `Contesto utente:
- Nome: ${this.profile.name}
- Stile: ${this.preferences.communicationStyle}
- Lunghezza risposta: ${this.preferences.responseLength}
- Ultimi messaggi:\n${recentMessages}`;
  }

  /**
   * Ottieni persona personalizzata per Jarvis
   */
  getPersonalizedPrompt() {
    const basePrompt = `You are Jarvis, a personal AI assistant for ${this.profile.name}.`;
    const stylePrompt = this._getStylePrompt();
    const contextPrompt = this.getContextPrompt();

    return `${basePrompt}\n${stylePrompt}\n\n${contextPrompt}`;
  }

  /**
   * Genera prompt basato sullo stile di comunicazione
   */
  _getStylePrompt() {
    const styles = {
      formal: 'Maintain a formal, professional tone. Use complete sentences and proper grammar.',
      casual: 'Be conversational and friendly. Use natural language and casual expressions.',
      professional: 'Be helpful and professional. Balance friendliness with clarity and efficiency.',
    };

    const lengths = {
      brief: 'Keep responses concise, typically 1-2 sentences.',
      medium: 'Provide balanced responses with relevant details.',
      detailed: 'Provide thorough, comprehensive responses with examples when helpful.',
    };

    return `Communication style: ${styles[this.preferences.communicationStyle] || styles.professional}\nResponse length: ${lengths[this.preferences.responseLength] || lengths.medium}`;
  }

  /**
   * Ottieni profilo pubblico (senza informazioni sensibili)
   */
  getPublicProfile() {
    return {
      name: this.profile.name,
      timezone: this.profile.timezone,
      language: this.profile.language,
      preferences: this.preferences,
    };
  }
}

export const userProfile = new UserProfile();
export default UserProfile;
