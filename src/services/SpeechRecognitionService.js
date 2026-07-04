/**
 * SpeechRecognitionService.js - Servizio di riconoscimento vocale end-to-end
 * Pipeline: Voce → Testo → LLM → Testo → Audio
 */

import { logger } from '../utils/Logger';
import { errorHandler } from '../middleware/ErrorHandler';
import { configManager } from '../config/JarvisConfig';
import { wakeWordDetector } from './WakeWordDetector';

class SpeechRecognitionService {
  constructor() {
    this.isRecording = false;
    this.transcript = '';
    this.recognition = null;
  }

  /**
   * Inizializza il servizio
   */
  async init() {
    try {
      // Verifica supporto Web Speech API
      if (typeof window !== 'undefined') {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
          this.recognition = new SpeechRecognition();
          logger.info('SpeechRecognitionService', 'Web Speech API initialized');
        } else {
          logger.warn('SpeechRecognitionService', 'Web Speech API not supported');
        }
      }
    } catch (error) {
      logger.error('SpeechRecognitionService', 'Initialization failed', error);
    }
  }

  /**
   * Avvia il riconoscimento vocale (one-shot)
   */
  async startRecording(options = {}) {
    const {
      onPartialResult = null,
      onFinal = null,
      timeoutMs = 30000,
      language = 'it-IT',
    } = options;

    if (this.isRecording) {
      logger.warn('SpeechRecognitionService', 'Already recording');
      return;
    }

    this.isRecording = true;
    this.transcript = '';

    return errorHandler.handleWithRetry(
      async () => {
        return new Promise((resolve, reject) => {
          if (!this.recognition) {
            reject(new Error('Speech Recognition not initialized'));
            return;
          }

          this.recognition.language = language;
          this.recognition.continuous = false;
          this.recognition.interimResults = true;

          this.recognition.onstart = () => {
            logger.info('SpeechRecognitionService', 'Recording started');
          };

          this.recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const transcript = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                this.transcript += transcript + ' ';
              } else {
                interim += transcript;
              }
            }

            if (onPartialResult) {
              onPartialResult((this.transcript + interim).trim());
            }
          };

          this.recognition.onerror = (event) => {
            logger.error('SpeechRecognitionService', 'Recognition error', { error: event.error });
            this.isRecording = false;
            reject(new Error(`Recognition error: ${event.error}`));
          };

          this.recognition.onend = () => {
            this.isRecording = false;
            logger.info('SpeechRecognitionService', 'Recording finished', {
              transcript: this.transcript.trim(),
            });
            if (onFinal) {
              onFinal(this.transcript.trim());
            }
            resolve(this.transcript.trim());
          };

          // Timeout
          const timeoutId = setTimeout(() => {
            if (this.recognition && this.isRecording) {
              this.recognition.stop();
            }
          }, timeoutMs);

          try {
            this.recognition.start();
          } catch (error) {
            clearTimeout(timeoutId);
            this.isRecording = false;
            reject(error);
          }
        });
      },
      {
        maxAttempts: 2,
        module: 'SpeechRecognitionService',
      }
    );
  }

  /**
   * Arresta il riconoscimento
   */
  stopRecording() {
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
      this.isRecording = false;
      logger.info('SpeechRecognitionService', 'Recording stopped');
    }
  }

  /**
   * Verifica se il riconoscimento è supportato
   */
  isSupported() {
    return !!this.recognition;
  }

  /**
   * Ottieni la trascrizione attuale
   */
  getTranscript() {
    return this.transcript.trim();
  }
}

export const speechRecognitionService = new SpeechRecognitionService();
export default SpeechRecognitionService;
