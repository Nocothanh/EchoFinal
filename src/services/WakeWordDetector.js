/**
 * WakeWordDetector.js - Riconoscimento wake-word "Echo"
 * Ascolta continuamente per la parola di attivazione
 */

import * as Speech from 'expo-speech';
import { logger } from '../utils/Logger';
import { envLoader } from './EnvLoader';

class WakeWordDetector {
  constructor() {
    this.isListening = false;
    this.onWakeWordDetected = null;
    this.wakeWord = envLoader.get('jarvis.wakeWord') || 'Echo';
    this.recognitionSupported = !!Speech.isSpeakingAsync;
    this.interimTranscript = '';
    this.finalTranscript = '';
  }

  /**
   * Inizia ad ascoltare per il wake-word
   */
  startListening(callback) {
    if (this.isListening) {
      logger.warn('WakeWordDetector', 'Already listening');
      return;
    }

    this.onWakeWordDetected = callback;
    this.isListening = true;
    this.finalTranscript = '';

    logger.info('WakeWordDetector', `Listening for wake word: "${this.wakeWord}"`);

    // Implementazione con Web Speech API (se disponibile)
    this._startWebSpeechRecognition();
  }

  /**
   * Arresta l'ascolto per il wake-word
   */
  stopListening() {
    this.isListening = false;
    this.finalTranscript = '';
    this.interimTranscript = '';
    logger.info('WakeWordDetector', 'Stopped listening for wake word');
  }

  /**
   * Inizia riconoscimento vocale tramite Web Speech API
   */
  _startWebSpeechRecognition() {
    // Nota: Expo non supporta nativamente Web Speech API su mobile
    // Questa è un'implementazione per web e fallback su mobile

    if (typeof window === 'undefined') {
      logger.warn('WakeWordDetector', 'Web Speech API not available on this platform');
      this._startFallbackListening();
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        logger.warn('WakeWordDetector', 'Web Speech API not supported');
        this._startFallbackListening();
        return;
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'it-IT';

      this.recognition.onstart = () => {
        logger.info('WakeWordDetector', 'Recognition started');
        this.interimTranscript = '';
      };

      this.recognition.onresult = (event) => {
        this.interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            this.finalTranscript += transcript + ' ';
          } else {
            this.interimTranscript += transcript;
          }
        }

        // Controlla se il wake-word è stato pronunciato
        const allText = (this.finalTranscript + this.interimTranscript).toLowerCase();
        if (allText.includes(this.wakeWord.toLowerCase())) {
          logger.info('WakeWordDetector', `Wake word "${this.wakeWord}" detected!`);
          this.finalTranscript = '';
          if (this.onWakeWordDetected) {
            this.onWakeWordDetected();
          }
        }
      };

      this.recognition.onerror = (event) => {
        logger.error('WakeWordDetector', 'Recognition error', { error: event.error });
      };

      this.recognition.onend = () => {
        // Riavvia il riconoscimento se ancora in ascolto
        if (this.isListening) {
          logger.debug('WakeWordDetector', 'Restarting recognition');
          setTimeout(() => this._startWebSpeechRecognition(), 500);
        }
      };

      this.recognition.start();
    } catch (error) {
      logger.error('WakeWordDetector', 'Web Speech setup failed', error);
      this._startFallbackListening();
    }
  }

  /**
   * Fallback per ambienti che non supportano Web Speech API
   */
  _startFallbackListening() {
    logger.warn('WakeWordDetector', 'Using fallback listening mode');
    // TODO: Implementare con Picovoice o altra soluzione on-device
    // Per ora, semplice loop che simula l'ascolto
    this._simulateListening();
  }

  /**
   * Simula l'ascolto (per testing)
   */
  async _simulateListening() {
    // Questo è un placeholder per testing
    // In produzione, implementare con native modules o Web Speech API
    logger.debug('WakeWordDetector', 'Simulating listening (placeholder)');
  }

  /**
   * Arresta il riconoscimento
   */
  stop() {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    this.stopListening();
  }

  /**
   * Verifica se il riconoscimento vocale è supportato
   */
  isSupported() {
    if (typeof window === 'undefined') return false;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    return !!SpeechRecognition;
  }

  /**
   * Ottieni la trascrizione corrente
   */
  getCurrentTranscript() {
    return (this.finalTranscript + this.interimTranscript).trim();
  }
}

export const wakeWordDetector = new WakeWordDetector();
export default WakeWordDetector;
