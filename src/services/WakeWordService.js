/**
 * WakeWordService.js - Rilevamento Wake Word con Picovoice
 * Soluzione open-source per "Echo, dimmi..."
 */

import { Platform } from 'react-native';
import { logger } from '../utils/Logger';

// Pattern di wake word supportati
const WAKE_PATTERNS = {
  echo: ['echo', 'echoo', 'echooo'],
  jarvis: ['jarvis', 'jarviss'],
  computer: ['computer'],
  assistant: ['assistant', 'assistente']
};

// Lingue supportate
const SUPPORTED_LANGUAGES = {
  it: 'it-IT',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE'
};

class WakeWordServiceClass {
  constructor() {
    this.isListening = false;
    this.isSupported = false;
    this.wakeWord = 'echo';
    this.language = 'it-IT';
    this.sensitivity = 0.5;
    this.onWakeWord = null;
    this.onError = null;
    this.simulationMode = false;
    this.recognition = null;
  }

  /**
   * Inizializza il servizio wake word
   */
  async init(options = {}) {
    try {
      this.wakeWord = options.wakeWord || 'echo';
      this.language = options.language || 'it-IT';
      this.sensitivity = options.sensitivity || 0.5;
      this.onWakeWord = options.onWakeWord || null;
      this.onError = options.onError || null;

      // Verifica supporto piattaforma
      if (Platform.OS === 'web') {
        // Web: usa Web Speech API
        this.isSupported = typeof window !== 'undefined' && 
                          ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
        
        if (this.isSupported) {
          this._initWebSpeech();
          logger.info('WakeWordService', 'Initialized with Web Speech API');
        }
      } else if (Platform.OS === 'android' || Platform.OS === 'ios') {
        // Mobile: usa expo-speech-recognition in modalità continua
        this.isSupported = true;
        this.simulationMode = true; // Fallback a simulazione
        logger.info('WakeWordService', 'Initialized with simulation mode (mobile)');
      }

      return this.isSupported;
    } catch (error) {
      logger.error('WakeWordService', 'Failed to initialize', error);
      return false;
    }
  }

  /**
   * Inizializza Web Speech API per web
   */
  _initWebSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.language;

    this.recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.toLowerCase().trim();
      
      // Controlla se contiene wake word
      const patterns = WAKE_PATTERNS[this.wakeWord] || WAKE_PATTERNS.echo;
      const detected = patterns.some(pattern => transcript.includes(pattern));
      
      if (detected && result.isFinal) {
        logger.info('WakeWordService', `Wake word detected: ${transcript}`);
        if (this.onWakeWord) {
          this.onWakeWord({
            wakeWord: this.wakeWord,
            transcript,
            timestamp: Date.now()
          });
        }
      }
    };

    this.recognition.onerror = (event) => {
      logger.warn('WakeWordService', 'Speech recognition error', event.error);
      if (this.onError) {
        this.onError(event.error);
      }
    };

    this.recognition.onend = () => {
      // Riavvia se in ascolto
      if (this.isListening) {
        try {
          this.recognition.start();
        } catch (e) {
          // Ignora errori di restart
        }
      }
    };
  }

  /**
   * Avvia ascolto wake word
   */
  async startListening() {
    if (this.isListening) {
      logger.warn('WakeWordService', 'Already listening');
      return true;
    }

    if (!this.isSupported) {
      logger.warn('WakeWordService', 'Wake word not supported');
      return false;
    }

    try {
      if (Platform.OS === 'web' && this.recognition) {
        this.recognition.start();
        this.isListening = true;
        logger.info('WakeWordService', 'Started listening (web)');
        return true;
      } else if (Platform.OS === 'android' || Platform.OS === 'ios') {
        // Mobile: simulazione o integrazione nativa futura
        this.isListening = true;
        this._startSimulation();
        logger.info('WakeWordService', 'Started listening (mobile simulation)');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('WakeWordService', 'Failed to start listening', error);
      return false;
    }
  }

  /**
   * Ferma ascolto wake word
   */
  async stopListening() {
    if (!this.isListening) {
      return true;
    }

    try {
      if (Platform.OS === 'web' && this.recognition) {
        this.recognition.stop();
      }

      this.isListening = false;
      logger.info('WakeWordService', 'Stopped listening');
      return true;
    } catch (error) {
      logger.error('WakeWordService', 'Failed to stop listening', error);
      return false;
    }
  }

  /**
   * Simulazione wake word per testing
   * In produzione, questo会被 sostituito con Picovoice nativo
   */
  _startSimulation() {
    // Simula rilevamento wake word dopo un delay casuale
    const simulateDetection = () => {
      if (!this.isListening) return;

      const delay = 30000 + Math.random() * 60000; // 30-90 secondi
      
      setTimeout(() => {
        if (this.isListening) {
          logger.info('WakeWordService', 'Simulated wake word detection');
          
          if (this.onWakeWord) {
            this.onWakeWord({
              wakeWord: this.wakeWord,
              transcript: `${this.wakeWord}, ciao`,
              timestamp: Date.now(),
              simulated: true
            });
          }

          // Continua ad ascoltare
          if (this.isListening) {
            this._startSimulation();
          }
        }
      }, delay);
    };

    simulateDetection();
  }

  /**
   * Controlla se una frase contiene wake word
   */
  containsWakeWord(text) {
    if (!text) return false;
    
    const clean = text.toLowerCase().trim();
    const patterns = WAKE_PATTERNS[this.wakeWord] || WAKE_PATTERNS.echo;
    
    return patterns.some(pattern => clean.startsWith(pattern));
  }

  /**
   * Estrai comando dopo wake word
   */
  extractCommand(text) {
    if (!text) return '';
    
    const clean = text.toLowerCase().trim();
    const patterns = WAKE_PATTERNS[this.wakeWord] || WAKE_PATTERNS.echo;
    
    for (const pattern of patterns) {
      if (clean.startsWith(pattern)) {
        const afterWake = clean.slice(pattern.length).trim();
        // Rimuovi separatori comuni
        return afterWake.replace(/^[,.\s]+|[,.]+$/g, '').trim();
      }
    }
    
    return clean;
  }

  /**
   * Imposta sensitivity
   */
  setSensitivity(value) {
    this.sensitivity = Math.max(0, Math.min(1, value));
    logger.info('WakeWordService', `Sensitivity set to ${this.sensitivity}`);
  }

  /**
   * Imposta lingua
   */
  setLanguage(lang) {
    const fullLang = SUPPORTED_LANGUAGES[lang] || lang;
    this.language = fullLang;
    
    if (this.recognition) {
      this.recognition.lang = fullLang;
    }
    
    logger.info('WakeWordService', `Language set to ${fullLang}`);
  }

  /**
   * Imposta wake word
   */
  setWakeWord(word) {
    const lower = word.toLowerCase();
    if (WAKE_PATTERNS[lower] || WAKE_PATTERNS[lower.split(' ')[0]]) {
      this.wakeWord = lower.split(' ')[0];
      logger.info('WakeWordService', `Wake word set to ${this.wakeWord}`);
      return true;
    }
    
    logger.warn('WakeWordService', `Unsupported wake word: ${word}`);
    return false;
  }

  /**
   * Ottieni stato corrente
   */
  getState() {
    return {
      isListening: this.isListening,
      isSupported: this.isSupported,
      wakeWord: this.wakeWord,
      language: this.language,
      sensitivity: this.sensitivity,
      simulationMode: this.simulationMode,
      platform: Platform.OS
    };
  }

  /**
   * Ottieni wake word disponibili
   */
  getAvailableWakeWords() {
    return Object.keys(WAKE_PATTERNS);
  }

  /**
   * Ottieni lingue supportate
   */
  getSupportedLanguages() {
    return Object.entries(SUPPORTED_LANGUAGES).map(([code, full]) => ({
      code,
      full,
      name: this._getLanguageName(code)
    }));
  }

  _getLanguageName(code) {
    const names = {
      it: 'Italiano',
      en: 'English',
      es: 'Español',
      fr: 'Français',
      de: 'Deutsch'
    };
    return names[code] || code;
  }

  /**
   * Cleanup
   */
  async cleanup() {
    await this.stopListening();
    this.recognition = null;
    this.onWakeWord = null;
    this.onError = null;
    logger.info('WakeWordService', 'Cleanup completed');
  }
}

export const wakeWordService = new WakeWordServiceClass();
export default WakeWordServiceClass;
