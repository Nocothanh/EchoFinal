/**
 * LocalLLMBridge.js
 * React Native bridge wrapper for on-device LLM via llama.cpp
 * Supports Qwen2.5 1.5B, Phi-3 mini, Gemma 2B
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { EchoLocalLLM } = NativeModules;
const emitter = EchoLocalLLM ? new NativeEventEmitter(EchoLocalLLM) : null;

class LocalLLMBridgeService {
  constructor() {
    this.isAvailable = Platform.OS === 'android' && !!EchoLocalLLM;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.modelPath = null;
    this._tokenSubscription = null;
    this._errorSubscription = null;
  }

  /**
   * Load a GGUF model
   * Recommended models (all free):
   * - Qwen2.5 1.5B Instruct (~940MB) - best Italian support
   * - Phi-3 Mini 3.8B (~2.3GB) - good reasoning
   * - Gemma 2B (~1.5GB) - balanced
   * - TinyLlama 1.1B (~600MB) - lightweight
   */
  async loadModel(modelPath, options = {}) {
    if (!this.isAvailable) {
      console.warn('LocalLLMBridge: Not available on this platform');
      return false;
    }

    try {
      const defaultOptions = {
        contextSize: 2048,
        threads: 4,
        ...options
      };

      await EchoLocalLLM.loadModel(modelPath, defaultOptions);
      this.isModelLoaded = true;
      this.modelPath = modelPath;

      // Setup streaming listeners
      if (emitter) {
        this._tokenSubscription = emitter.addListener('LLMToken', (event) => {
          if (this._onToken) this._onToken(event);
        });
        this._errorSubscription = emitter.addListener('LLMError', (event) => {
          if (this._onError) this._onError(event);
        });
      }

      console.log('LocalLLMBridge: Model loaded:', modelPath);
      return true;
    } catch (error) {
      console.error('LocalLLMBridge: Load failed', error);
      return false;
    }
  }

  /**
   * Generate text from prompt (non-streaming)
   */
  async generate(prompt, options = {}) {
    if (!this.isModelLoaded) {
      return { success: false, error: 'No model loaded' };
    }

    try {
      const defaultOptions = {
        maxTokens: 512,
        temperature: 0.7,
        topP: 0.9,
        ...options
      };

      const result = await EchoLocalLLM.generate(prompt, defaultOptions);
      return { success: true, text: result.text };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate with streaming (events)
   */
  async generateStream(prompt, onToken, onError, options = {}) {
    if (!this.isModelLoaded) {
      if (onError) onError({ error: 'No model loaded' });
      return;
    }

    this._onToken = onToken;
    this._onError = onError;
    this.isGenerating = true;

    const defaultOptions = {
      maxTokens: 512,
      temperature: 0.7,
      topP: 0.9,
      ...options
    };

    try {
      await EchoLocalLLM.generateStream(prompt, defaultOptions);
    } catch (error) {
      if (onError) onError({ error: error.message });
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Cancel ongoing generation
   */
  cancel() {
    if (this.isGenerating) {
      EchoLocalLLM.cancel();
      this.isGenerating = false;
    }
  }

  /**
   * Unload model
   */
  async unloadModel() {
    if (!this.isAvailable) return;

    this.isModelLoaded = false;
    this.modelPath = null;

    if (this._tokenSubscription) {
      this._tokenSubscription.remove();
      this._tokenSubscription = null;
    }
    if (this._errorSubscription) {
      this._errorSubscription.remove();
      this._errorSubscription = null;
    }

    try {
      await EchoLocalLLM.unloadModel();
    } catch (error) {
      console.error('LocalLLMBridge: Unload failed', error);
    }
  }

  /**
   * Get model info
   */
  async getModelInfo() {
    if (!this.isAvailable || !this.isModelLoaded) return null;
    try {
      return await EchoLocalLLM.getModelInfo();
    } catch (error) {
      return null;
    }
  }

  /**
   * Count tokens in text
   */
  async countTokens(text) {
    if (!this.isAvailable || !this.isModelLoaded) return 0;
    try {
      return await EchoLocalLLM.countTokens(text);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get current status
   */
  async getStatus() {
    if (!this.isAvailable) return { available: false };
    try {
      const status = await EchoLocalLLM.getStatus();
      return { available: true, ...status };
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  /**
   * Get recommended free models
   */
  getRecommendedModels() {
    return [
      {
        id: 'qwen2.5-1.5b-instruct',
        name: 'Qwen2.5 1.5B Instruct',
        size: '~940MB',
        description: 'Migliore per italiano, bilanciato',
        download: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf'
      },
      {
        id: 'phi-3-mini-4k',
        name: 'Phi-3 Mini 3.8B',
        size: '~2.3GB',
        description: 'Ottimo ragionamento, più grande',
        download: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf'
      },
      {
        id: 'gemma-2b-it',
        name: 'Gemma 2B Instruct',
        size: '~1.5GB',
        description: 'Google, buon equilibrio',
        download: 'https://huggingface.co/google/gemma-2b-it/resolve/main/gemma-2b-it-q4.gguf'
      },
      {
        id: 'tinyllama-1.1b',
        name: 'TinyLlama 1.1B',
        size: '~600MB',
        description: 'Leggero, veloce, meno preciso',
        download: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf'
      }
    ];
  }

  destroy() {
    this.cancel();
    this.unloadModel();
  }
}

export const localLLMBridge = new LocalLLMBridgeService();
export default LocalLLMBridgeService;
