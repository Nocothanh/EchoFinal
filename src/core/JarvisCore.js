/**
 * JarvisCore.js - Core centrale di Jarvis AI
 * Orchestrazione di tutti i servizi e pipeline completa
 */

import { configManager } from '../config/JarvisConfig';
import { logger } from '../utils/Logger';
import { envLoader } from './EnvLoader';
import { groqOptimizer } from './GroqOptimizer';
import { storageService } from './StorageService';
import { userProfile } from './UserProfile';
import { ragEngine } from './RAGEngine';
import { timeTracker } from './TimeTracker';
import { schedulerService } from './SchedulerService';
import { dailyBriefing } from './DailyBriefing';
import { proactiveMonitor } from './ProactiveMonitor';
import { wakeWordDetector } from './WakeWordDetector';
import { speechRecognitionService } from './SpeechRecognitionService';
import { contactService } from './ContactService';
import { calendarService } from './CalendarService';
import { mediaControlService } from './MediaControlService';
import { intentService } from './IntentService';
import { deviceControlService } from './DeviceControlService';

class JarvisCore {
  constructor() {
    this.initialized = false;
    this.userId = null;
    this.conversationId = null;
    this.isListening = false;
  }

  /**
   * Inizializza tutto il sistema Jarvis
   */
  async initialize(userId) {
    try {
      logger.info('JarvisCore', 'Initializing Jarvis AI...');

      // 1. Carica variabili di ambiente
      await envLoader.init();
      logger.info('JarvisCore', 'Environment loaded');

      // 2. Carica configurazione
      await configManager.init();
      logger.info('JarvisCore', 'Configuration loaded');

      // 3. Inizializza database
      await storageService.init();
      logger.info('JarvisCore', 'Database initialized');

      // 4. Carica profilo utente
      await userProfile.init(userId);
      this.userId = userId;
      logger.info('JarvisCore', `User profile loaded for ${userProfile.profile.name}`);

      // 5. Crea conversazione
      this.conversationId = await storageService.createConversation(userId, 'Jarvis Conversation');
      logger.info('JarvisCore', `Conversation created: ${this.conversationId}`);

      // 6. Inizializza servizi di tracciamento
      await timeTracker.init({ enabled: true, batchInterval: 60000 });
      await timeTracker.startActivity(userId, 'chat', 'Jarvis Session Started');
      logger.info('JarvisCore', 'Time tracking started');

      // 7. Inizializza pianificazione
      await schedulerService.init();
      await dailyBriefing.init({ briefingTime: configManager.get('scheduler.briefingTime') });
      logger.info('JarvisCore', 'Scheduling services initialized');

      // 8. Inizializza monitoraggio proattivo
      await proactiveMonitor.init({ enabled: true });
      logger.info('JarvisCore', 'Proactive monitoring enabled');

      // 9. Inizializza controlli dispositivo
      await speechRecognitionService.init();
      await contactService.loadContacts();
      await calendarService.init();
      await mediaControlService.init();
      await intentService.init();
      await deviceControlService.init();
      logger.info('JarvisCore', 'Device controls initialized');

      // 10. Configura wake-word listener
      wakeWordDetector.startListening(() => {
        logger.info('JarvisCore', 'Wake word detected - starting interaction');
        this._onWakeWordDetected();
      });

      this.initialized = true;
      logger.info('JarvisCore', '✅ Jarvis AI initialized successfully!');
      return true;
    } catch (error) {
      logger.critical('JarvisCore', 'Initialization failed', error);
      throw error;
    }
  }

  /**
   * Callback quando wake-word viene rilevato
   */
  async _onWakeWordDetected() {
    this.isListening = true;
    await timeTracker.startActivity(this.userId, 'listening', 'Voice interaction started');
  }

  /**
   * Processa messaggio utente (testo o voice)
   */
  async processMessage(userMessage, context = {}) {
    try {
      if (!this.initialized) {
        throw new Error('Jarvis not initialized');
      }

      logger.info('JarvisCore', 'Processing message', { length: userMessage.length });

      // 1. Log attività
      await storageService.logActivity(
        this.userId,
        'chat_input',
        'User message',
        userMessage
      );

      // 2. Aggiungi al contesto utente
      userProfile.addToContextWindow({ role: 'user', content: userMessage });

      // 3. Construisci contesto RAG
      const ragContext = await ragEngine.buildAugmentedContext(this.userId, userMessage);

      // 4. Costruisci prompt personalizzato
      const personalizedPrompt = userProfile.getPersonalizedPrompt();

      // 5. Prepara messaggi per LLM
      const messages = [
        { role: 'system', content: personalizedPrompt },
        { role: 'system', content: ragContext },
        { role: 'user', content: userMessage },
      ];

      // 6. Chiama Groq
      const response = await groqOptimizer.call(messages, {
        stream: false,
        useCache: true,
      });

      const assistantMessage = response.choices[0].message.content;

      // 7. Salva messaggio
      await storageService.saveMessage(this.conversationId, 'user', userMessage);
      await storageService.saveMessage(this.conversationId, 'assistant', assistantMessage);

      // 8. Aggiungi al contesto
      userProfile.addToContextWindow({ role: 'assistant', content: assistantMessage });

      logger.info('JarvisCore', 'Message processed', { responseLength: assistantMessage.length });

      return {
        success: true,
        message: assistantMessage,
        suggestions: await this._extractSuggestions(assistantMessage),
      };
    } catch (error) {
      logger.error('JarvisCore', 'Message processing failed', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Estrai azioni/comandi dal messaggio di Jarvis
   */
  async _extractSuggestions(message) {
    // Placeholder per estrazione di azioni
    // In produzione: parsing di intenti, riconoscimento di azioni, ecc.
    return [];
  }

  /**
   * Esegui comando voce
   */
  async executeVoiceCommand(command) {
    try {
      logger.info('JarvisCore', 'Executing voice command', { command });

      // Parser semplice di comandi
      const lowerCmd = command.toLowerCase();

      // Esempi di comandi
      if (lowerCmd.includes('chiama')) {
        return await this._handleCallCommand(command);
      } else if (lowerCmd.includes('messaggio') || lowerCmd.includes('sms')) {
        return await this._handleSMSCommand(command);
      } else if (lowerCmd.includes('calendario') || lowerCmd.includes('evento')) {
        return await this._handleCalendarCommand(command);
      } else if (lowerCmd.includes('musica') || lowerCmd.includes('riproduci')) {
        return await this._handleMediaCommand(command);
      } else {
        // Default: tratta come messaggio conversazione
        return await this.processMessage(command);
      }
    } catch (error) {
      logger.error('JarvisCore', 'Voice command execution failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle comando di chiamata
   */
  async _handleCallCommand(command) {
    // Es: "Chiama Mario"
    const namePart = command.replace(/chiama\s+/i, '').trim();
    const contact = await contactService.resolveContact(namePart);

    if (!contact) {
      return { success: false, error: `Contact "${namePart}" not found` };
    }

    const phone = contactService.getPrimaryPhone(contact);
    return await intentService.executeCommand('CALL', {
      phoneNumber: phone,
      name: contact.name,
    });
  }

  /**
   * Handle comando SMS
   */
  async _handleSMSCommand(command) {
    // Es: "Scrivi un messaggio a Mario dicendo ciao"
    logger.warn('JarvisCore', 'SMS command parsing requires advanced NLP');
    return { success: false, error: 'SMS command parsing not yet implemented' };
  }

  /**
   * Handle comando calendario
   */
  async _handleCalendarCommand(command) {
    // Es: "Mostra gli eventi di oggi"
    if (command.toLowerCase().includes('oggi')) {
      const events = await calendarService.getTodayEvents();
      return { success: true, data: events };
    }

    const events = await calendarService.getUpcomingEvents();
    return { success: true, data: events };
  }

  /**
   * Handle comando media
   */
  async _handleMediaCommand(command) {
    // Es: "Riproduci musica", "Play", "Pause"
    const lowerCmd = command.toLowerCase();

    if (lowerCmd.includes('play') || lowerCmd.includes('riproduci')) {
      return { success: true, message: 'Playing' }; // Richiede URI
    } else if (lowerCmd.includes('pause') || lowerCmd.includes('pausa')) {
      await mediaControlService.pause();
      return { success: true, message: 'Paused' };
    } else if (lowerCmd.includes('stop')) {
      await mediaControlService.stop();
      return { success: true, message: 'Stopped' };
    } else if (lowerCmd.includes('next') || lowerCmd.includes('prossimo')) {
      await mediaControlService.next();
      return { success: true, message: 'Next track' };
    } else if (lowerCmd.includes('prev') || lowerCmd.includes('precedente')) {
      await mediaControlService.previous();
      return { success: true, message: 'Previous track' };
    }

    return { success: false, error: 'Unknown media command' };
  }

  /**
   * Ottieni statistiche sessione
   */
  async getSessionStats() {
    try {
      const stats = await storageService.getUserStats(this.userId, 1);
      return stats;
    } catch (error) {
      logger.error('JarvisCore', 'Failed to get stats', error);
      return null;
    }
  }

  /**
   * Arresta Jarvis
   */
  async shutdown() {
    try {
      logger.info('JarvisCore', 'Shutting down Jarvis...');

      await timeTracker.endActivity(this.userId);
      await timeTracker.stop();
      wakeWordDetector.stop();
      proactiveMonitor.stop();
      dailyBriefing.stop();

      this.initialized = false;
      logger.info('JarvisCore', 'Jarvis shutdown complete');
    } catch (error) {
      logger.error('JarvisCore', 'Shutdown error', error);
    }
  }
}

export const jarvisCore = new JarvisCore();
export default JarvisCore;
