/**
 * BargeInHandler.js - Gestione Interruzione Vocale
 * Permette all'utente di interrompere JARVIS mentre parla
 */

import { Platform } from 'react-native';
import { logger } from '../utils/Logger';
import { stopSpeech } from './TTS';
import { VoiceInput } from './VoiceInput';

class BargeInHandlerClass {
  constructor() {
    this.isEnabled = true;
    this.isMonitoring = false;
    this.audioLevelThreshold = 0.15; // Soglia per rilevare voce
    this.consecutiveFrames = 3; // Frame consecutivi per confermare
    this.monitoringInterval = null;
    this.audioLevels = [];
    this.onBargeIn = null;
    this.onAudioLevel = null;
    this.lastBargeInTime = 0;
    this.bargeInCooldown = 1000; // 1 secondo di cooldown
  }

  /**
   * Inizializza il gestore barge-in
   */
  init(options = {}) {
    this.isEnabled = options.isEnabled !== false;
    this.audioLevelThreshold = options.threshold || 0.15;
    this.consecutiveFrames = options.consecutiveFrames || 3;
    this.onBargeIn = options.onBargeIn || null;
    this.onAudioLevel = options.onAudioLevel || null;

    logger.info('BargeInHandler', 'Initialized', {
      enabled: this.isEnabled,
      threshold: this.audioLevelThreshold,
      consecutiveFrames: this.consecutiveFrames
    });

    return true;
  }

  /**
   * Avvia monitoraggio audio per barge-in
   */
  async startMonitoring() {
    if (!this.isEnabled) {
      logger.warn('BargeInHandler', 'Barge-in is disabled');
      return false;
    }

    if (this.isMonitoring) {
      logger.warn('BargeInHandler', 'Already monitoring');
      return true;
    }

    try {
      // Richiedi permesso microfono
      const permission = await VoiceInput.requestPermissions();
      if (!permission || permission.granted === false) {
        logger.warn('BargeInHandler', 'Microphone permission not granted');
        return false;
      }

      this.isMonitoring = true;
      this.audioLevels = [];

      // Avvia monitoraggio audio
      this._startAudioMonitoring();

      logger.info('BargeInHandler', 'Started monitoring audio');
      return true;
    } catch (error) {
      logger.error('BargeInHandler', 'Failed to start monitoring', error);
      return false;
    }
  }

  /**
   * Ferma monitoraggio
   */
  async stopMonitoring() {
    if (!this.isMonitoring) {
      return true;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.audioLevels = [];
    logger.info('BargeInHandler', 'Stopped monitoring');
    return true;
  }

  /**
   * Monitoraggio audio interno
   * In produzione, questo utilizzerebbe AudioContext o modulo nativo
   */
  _startAudioMonitoring() {
    // Simulazione monitoraggio audio
    // In produzione, questo sarebbe un listener microfono reale
    const monitor = () => {
      if (!this.isMonitoring) return;

      // Simula livello audio (in produzione: da microfono reale)
      const simulatedLevel = Math.random() * 0.3;
      
      // Notifica livello audio
      if (this.onAudioLevel) {
        this.onAudioLevel(simulatedLevel);
      }

      // Aggiungi ai livelli recenti
      this.audioLevels.push({
        level: simulatedLevel,
        timestamp: Date.now()
      });

      // Mantieni solo ultimi 10 frame
      if (this.audioLevels.length > 10) {
        this.audioLevels.shift();
      }

      // Controlla se c'è barge-in
      this._checkBargeIn();

      // Continua monitoraggio
      if (this.isMonitoring) {
        this.monitoringInterval = setTimeout(monitor, 100);
      }
    };

    monitor();
  }

  /**
   * Controlla se c'è stato barge-in
   */
  _checkBargeIn() {
    if (!this.isEnabled) return;

    const now = Date.now();
    
    // Cooldown
    if (now - this.lastBargeInTime < this.bargeInCooldown) {
      return;
    }

    // Controlla frame recenti
    const recentLevels = this.audioLevels.slice(-this.consecutiveFrames);
    
    if (recentLevels.length < this.consecutiveFrames) {
      return;
    }

    // Tutti i frame devono superare la soglia
    const allAboveThreshold = recentLevels.every(
      frame => frame.level > this.audioLevelThreshold
    );

    if (allAboveThreshold) {
      this.lastBargeInTime = now;
      
      logger.info('BargeInHandler', 'Barge-in detected!', {
        levels: recentLevels.map(f => f.level)
      });

      // Callback
      if (this.onBargeIn) {
        this.onBargeIn({
          timestamp: now,
          audioLevels: recentLevels.map(f => f.level)
        });
      }

      // Reset livelli
      this.audioLevels = [];
    }
  }

  /**
   * Processa barge-in
   */
  async handleBargeIn() {
    logger.info('BargeInHandler', 'Processing barge-in');

    try {
      // 1. Ferma TTS
      await stopSpeech();
      logger.info('BargeInHandler', 'TTS stopped');

      // 2. Ferma ascolto corrente
      await VoiceInput.stop();
      logger.info('BargeInHandler', 'Voice input stopped');

      // 3. Ferma monitoraggio
      await this.stopMonitoring();
      logger.info('BargeInHandler', 'Monitoring stopped');

      return true;
    } catch (error) {
      logger.error('BargeInHandler', 'Failed to handle barge-in', error);
      return false;
    }
  }

  /**
   * Abilita/disabilita barge-in
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    logger.info('BargeInHandler', `Barge-in ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Imposta soglia audio
   */
  setThreshold(value) {
    this.audioLevelThreshold = Math.max(0, Math.min(1, value));
    logger.info('BargeInHandler', `Threshold set to ${this.audioLevelThreshold}`);
  }

  /**
   * Imposta frame consecutivi
   */
  setConsecutiveFrames(count) {
    this.consecutiveFrames = Math.max(1, Math.min(10, count));
    logger.info('BargeInHandler', `Consecutive frames set to ${this.consecutiveFrames}`);
  }

  /**
   * Imposta cooldown
   */
  setCooldown(ms) {
    this.bargeInCooldown = Math.max(500, ms);
    logger.info('BargeInHandler', `Cooldown set to ${this.bargeInCooldown}ms`);
  }

  /**
   * Ottieni stato
   */
  getState() {
    return {
      isEnabled: this.isEnabled,
      isMonitoring: this.isMonitoring,
      audioLevelThreshold: this.audioLevelThreshold,
      consecutiveFrames: this.consecutiveFrames,
      bargeInCooldown: this.bargeInCooldown,
      currentAudioLevels: this.audioLevels.slice(-5)
    };
  }

  /**
   * Cleanup
   */
  async cleanup() {
    await this.stopMonitoring();
    this.onBargeIn = null;
    this.onAudioLevel = null;
    logger.info('BargeInHandler', 'Cleanup completed');
  }
}

export const bargeInHandler = new BargeInHandlerClass();
export default BargeInHandlerClass;
