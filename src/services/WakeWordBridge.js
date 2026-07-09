/**
 * WakeWordBridge.js
 * React Native bridge wrapper for offline Vosk wake word detection
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { EchoWakeWord } = NativeModules;
const emitter = EchoWakeWord ? new NativeEventEmitter(EchoWakeWord) : null;

class WakeWordBridgeService {
  constructor() {
    this.isAvailable = Platform.OS === 'android' && !!EchoWakeWord;
    this.isInitialized = false;
    this.isListening = false;
    this.wakeWord = 'hey jarvis';
    this.onDetectedCallback = null;
    this._subscription = null;
  }

  /**
   * Initialize Vosk model
   */
  async init(modelPath) {
    if (!this.isAvailable) {
      console.warn('WakeWordBridge: Not available on this platform');
      return false;
    }

    try {
      const path = modelPath || 'vosk-model-small-it-0.22';
      await EchoWakeWord.initialize(path);
      this.isInitialized = true;
      console.log('WakeWordBridge: Initialized with model:', path);
      return true;
    } catch (error) {
      console.error('WakeWordBridge: Init failed', error);
      return false;
    }
  }

  /**
   * Set custom wake word
   */
  async setWakeWord(word) {
    if (!this.isAvailable) return false;
    this.wakeWord = word;
    return EchoWakeWord.setWakeWord(word);
  }

  /**
   * Start listening for wake word
   */
  async startListening(onDetected) {
    if (!this.isAvailable || !this.isInitialized) return false;

    this.onDetectedCallback = onDetected;

    if (emitter) {
      this._subscription = emitter.addListener('WakeWordDetected', (event) => {
        console.log('WakeWordBridge: Detected!', event);
        if (this.onDetectedCallback) {
          this.onDetectedCallback(event);
        }
      });
    }

    try {
      await EchoWakeWord.startListening();
      this.isListening = true;
      return true;
    } catch (error) {
      console.error('WakeWordBridge: Start failed', error);
      return false;
    }
  }

  /**
   * Stop listening
   */
  async stopListening() {
    if (!this.isAvailable) return;

    this.isListening = false;
    if (this._subscription) {
      this._subscription.remove();
      this._subscription = null;
    }

    try {
      await EchoWakeWord.stopListening();
    } catch (error) {
      console.error('WakeWordBridge: Stop failed', error);
    }
  }

  /**
   * Process audio buffer manually
   */
  async processAudio(audioData) {
    if (!this.isAvailable || !this.isInitialized) return { detected: false };

    try {
      return await EchoWakeWord.processAudio(audioData);
    } catch (error) {
      return { detected: false, error: error.message };
    }
  }

  /**
   * Get current status
   */
  async getStatus() {
    if (!this.isAvailable) return { initialized: false, listening: false };

    try {
      return await EchoWakeWord.getStatus();
    } catch (error) {
      return { initialized: false, listening: false, error: error.message };
    }
  }

  /**
   * Set detection threshold
   */
  async setThreshold(value) {
    if (!this.isAvailable) return false;
    return EchoWakeWord.setThreshold(value);
  }

  destroy() {
    this.stopListening();
    this.isInitialized = false;
  }
}

export const wakeWordBridge = new WakeWordBridgeService();
export default WakeWordBridgeService;
