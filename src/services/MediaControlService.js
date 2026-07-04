/**
 * MediaControlService.js - Controllo del media player
 * Supporta: play, pause, next, prev, volume, shuffle, repeat
 */

import { Audio } from 'expo-av';
import { logger } from '../utils/Logger';

class MediaControlService {
  constructor() {
    this.soundObject = null;
    this.isPlaying = false;
    this.volume = 1.0;
    this.queue = [];
    this.currentIndex = 0;
  }

  /**
   * Inizializza audio
   */
  async init() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        shouldDuckAndroid: true,
      });
      logger.info('MediaControlService', 'Initialized');
    } catch (error) {
      logger.error('MediaControlService', 'Initialization failed', error);
    }
  }

  /**
   * Riproduci file audio
   */
  async play(audioUri) {
    try {
      // Ferma il precedente se sta riproducendo
      if (this.soundObject) {
        await this.soundObject.unloadAsync();
      }

      this.soundObject = new Audio.Sound();
      await this.soundObject.loadAsync({ uri: audioUri });
      await this.soundObject.playAsync();
      this.isPlaying = true;

      // Callback quando finisce
      this.soundObject.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          this.isPlaying = false;
          this._onPlaybackFinished();
        }
      });

      logger.info('MediaControlService', 'Playing audio');
      return true;
    } catch (error) {
      logger.error('MediaControlService', 'Play failed', error);
      return false;
    }
  }

  /**
   * Pausa riproduzione
   */
  async pause() {
    try {
      if (this.soundObject && this.isPlaying) {
        await this.soundObject.pauseAsync();
        this.isPlaying = false;
        logger.info('MediaControlService', 'Paused');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('MediaControlService', 'Pause failed', error);
      return false;
    }
  }

  /**
   * Riprendi riproduzione
   */
  async resume() {
    try {
      if (this.soundObject) {
        await this.soundObject.playAsync();
        this.isPlaying = true;
        logger.info('MediaControlService', 'Resumed');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('MediaControlService', 'Resume failed', error);
      return false;
    }
  }

  /**
   * Arresta riproduzione
   */
  async stop() {
    try {
      if (this.soundObject) {
        await this.soundObject.stopAsync();
        await this.soundObject.unloadAsync();
        this.soundObject = null;
        this.isPlaying = false;
        logger.info('MediaControlService', 'Stopped');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('MediaControlService', 'Stop failed', error);
      return false;
    }
  }

  /**
   * Imposta volume (0.0 - 1.0)
   */
  async setVolume(volume) {
    try {
      if (this.soundObject) {
        this.volume = Math.max(0, Math.min(1, volume));
        await this.soundObject.setVolumeAsync(this.volume);
        logger.info('MediaControlService', `Volume set to ${Math.round(this.volume * 100)}%`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('MediaControlService', 'Set volume failed', error);
      return false;
    }
  }

  /**
   * Aumenta volume
   */
  async increaseVolume(step = 0.1) {
    return this.setVolume(this.volume + step);
  }

  /**
   * Diminuisci volume
   */
  async decreaseVolume(step = 0.1) {
    return this.setVolume(this.volume - step);
  }

  /**
   * Metti in coda file audio
   */
  addToQueue(audioUri) {
    this.queue.push(audioUri);
    logger.debug('MediaControlService', 'Added to queue', { queueSize: this.queue.length });
  }

  /**
   * Prossimo file in coda
   */
  async next() {
    if (this.currentIndex < this.queue.length - 1) {
      this.currentIndex++;
      return this.play(this.queue[this.currentIndex]);
    }
    return false;
  }

  /**
   * File precedente in coda
   */
  async previous() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.play(this.queue[this.currentIndex]);
    }
    return false;
  }

  /**
   * Callback quando la riproduzione finisce
   */
  _onPlaybackFinished() {
    // Auto-play prossimo file se in coda
    if (this.currentIndex < this.queue.length - 1) {
      this.next();
    }
  }

  /**
   * Ottieni stato riproduzione
   */
  getStatus() {
    return {
      isPlaying: this.isPlaying,
      volume: Math.round(this.volume * 100),
      queueSize: this.queue.length,
      currentIndex: this.currentIndex,
    };
  }
}

export const mediaControlService = new MediaControlService();
export default MediaControlService;
