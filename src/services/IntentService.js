/**
 * IntentService.js - Bridge tra comandi voice e azioni di sistema Android
 * Gestisce: Intent resolution, action routing, background execution
 */

import { logger } from '../utils/Logger';
import { NativeModules, Platform } from 'react-native';

const { JarvisIntentModule } = NativeModules;

class IntentService {
  constructor() {
    this.isAndroid = Platform.OS === 'android';
    this.nativeModule = this.isAndroid ? JarvisIntentModule : null;
    this.intentHandlers = new Map();
    this.commandQueue = [];
  }

  /**
   * Inizializza il servizio Intent
   */
  async init() {
    if (!this.isAndroid) {
      logger.warn('IntentService', 'Intent service only available on Android');
      return;
    }

    try {
      await this._registerIntentHandlers();
      logger.info('IntentService', 'Initialized on Android');
    } catch (error) {
      logger.error('IntentService', 'Initialization failed', error);
    }
  }

  /**
   * Registra handler per intenti
   */
  async _registerIntentHandlers() {
    // Effettuare chiamate
    this.registerHandler('CALL', this._handleCall.bind(this));
    // Inviare SMS
    this.registerHandler('SMS', this._handleSMS.bind(this));
    // Aprire app
    this.registerHandler('LAUNCH_APP', this._handleLaunchApp.bind(this));
    // Controllo media
    this.registerHandler('MEDIA_CONTROL', this._handleMediaControl.bind(this));
    // Aprire URL
    this.registerHandler('OPEN_URL', this._handleOpenUrl.bind(this));
  }

  /**
   * Registra handler personalizzato
   */
  registerHandler(action, handler) {
    this.intentHandlers.set(action, handler);
    logger.debug('IntentService', `Handler registered for ${action}`);
  }

  /**
   * Esegui azione da comando voice
   */
  async executeCommand(command, params = {}) {
    try {
      const handler = this.intentHandlers.get(command);
      if (!handler) {
        logger.warn('IntentService', `No handler for command: ${command}`);
        return { success: false, error: `Unknown command: ${command}` };
      }

      logger.info('IntentService', `Executing command: ${command}`, params);
      return await handler(params);
    } catch (error) {
      logger.error('IntentService', `Command execution failed: ${command}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handler: Effettuare chiamata
   */
  async _handleCall(params) {
    const { phoneNumber, name } = params;
    if (!phoneNumber) {
      return { success: false, error: 'Phone number required' };
    }

    try {
      if (this.nativeModule) {
        const result = await this.nativeModule.makeCall(phoneNumber);
        logger.info('IntentService', `Call initiated to ${name || phoneNumber}`);
        return { success: true, data: result };
      }
      return { success: false, error: 'Native module not available' };
    } catch (error) {
      logger.error('IntentService', 'Call failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handler: Inviare SMS
   */
  async _handleSMS(params) {
    const { phoneNumber, message, name } = params;
    if (!phoneNumber || !message) {
      return { success: false, error: 'Phone number and message required' };
    }

    try {
      if (this.nativeModule) {
        const result = await this.nativeModule.sendSMS(phoneNumber, message);
        logger.info('IntentService', `SMS sent to ${name || phoneNumber}`);
        return { success: true, data: result };
      }
      return { success: false, error: 'Native module not available' };
    } catch (error) {
      logger.error('IntentService', 'SMS failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handler: Aprire app
   */
  async _handleLaunchApp(params) {
    const { packageName, appName } = params;
    if (!packageName) {
      return { success: false, error: 'Package name required' };
    }

    try {
      if (this.nativeModule) {
        const result = await this.nativeModule.launchApp(packageName);
        logger.info('IntentService', `Launched app: ${appName || packageName}`);
        return { success: true, data: result };
      }
      return { success: false, error: 'Native module not available' };
    } catch (error) {
      logger.error('IntentService', 'App launch failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handler: Controllo media
   */
  async _handleMediaControl(params) {
    const { action } = params; // 'play', 'pause', 'next', 'prev', 'volume'

    try {
      if (this.nativeModule) {
        const result = await this.nativeModule.controlMedia(action, params);
        logger.info('IntentService', `Media control: ${action}`);
        return { success: true, data: result };
      }
      return { success: false, error: 'Native module not available' };
    } catch (error) {
      logger.error('IntentService', 'Media control failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handler: Aprire URL
   */
  async _handleOpenUrl(params) {
    const { url } = params;
    if (!url) {
      return { success: false, error: 'URL required' };
    }

    try {
      if (this.nativeModule) {
        const result = await this.nativeModule.openUrl(url);
        logger.info('IntentService', `Opened URL: ${url}`);
        return { success: true, data: result };
      }
      return { success: false, error: 'Native module not available' };
    } catch (error) {
      logger.error('IntentService', 'Open URL failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Coda comandi per esecuzione sequenziale
   */
  async queueCommand(command, params, delay = 0) {
    return new Promise((resolve) => {
      this.commandQueue.push({ command, params, resolve });
      if (this.commandQueue.length === 1) {
        this._processQueue(delay);
      }
    });
  }

  /**
   * Processa coda di comandi
   */
  async _processQueue(delay = 0) {
    while (this.commandQueue.length > 0) {
      const { command, params, resolve } = this.commandQueue.shift();
      if (delay > 0) {
        await new Promise(r => setTimeout(r, delay));
      }
      const result = await this.executeCommand(command, params);
      resolve(result);
    }
  }
}

export const intentService = new IntentService();
export default IntentService;
