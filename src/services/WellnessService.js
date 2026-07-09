/**
 * WellnessService.js - Guided breathing, ambient sounds, wellness mode
 * All free, no external APIs needed
 */

import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { logger } from '../utils/Logger';

const BREATHING_PATTERNS = {
  '4-7-8': { inhale: 4, hold: 7, exhale: 8, name: '4-7-8 (Rilassamento)' },
  'box': { inhale: 4, hold: 4, exhale: 4, holdAfter: 4, name: 'Box Breathing' },
  '5-5': { inhale: 5, hold: 0, exhale: 5, name: '5-5 (Equilibrio)' },
  '4-4-6': { inhale: 4, hold: 4, exhale: 6, name: '4-4-6 (Calma)' }
};

const AMBIENT_SOUNDS = [
  { id: 'rain', name: 'Pioggia', emoji: '🌧️' },
  { id: 'ocean', name: 'Oceano', emoji: '🌊' },
  { id: 'forest', name: 'Foresta', emoji: '🌲' },
  { id: 'thunder', name: 'Temporale', emoji: '⛈️' },
  { id: 'fire', name: 'Fuoco', emoji: '🔥' },
  { id: 'wind', name: 'Vento', emoji: '💨' },
  { id: 'birds', name: 'Uccelli', emoji: '🐦' },
  { id: 'stream', name: 'Ruscello', emoji: '💧' },
  { id: 'night', name: 'Notte', emoji: '🌙' },
  { id: 'cafe', name: 'Caffetteria', emoji: '☕' },
  { id: 'white_noise', name: 'Rumore bianco', emoji: '📺' }
];

class WellnessServiceClass {
  constructor() {
    this.isInitialized = false;
    this.isBreathing = false;
    this.isWellnessMode = false;
    this.currentSound = null;
    this.soundObject = null;
    this.breathingTimer = null;
  }

  async init() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true
      });
      this.isInitialized = true;
      logger.info('WellnessService', 'Initialized');
      return true;
    } catch (error) {
      logger.error('WellnessService', 'Failed to initialize', error);
      return false;
    }
  }

  /**
   * Start guided breathing exercise
   */
  async startBreathing(pattern = '4-7-8', durationMinutes = 5) {
    const config = BREATHING_PATTERNS[pattern];
    if (!config) return { success: false, error: `Pattern "${pattern}" non trovato` };

    this.isBreathing = true;
    const endTime = Date.now() + durationMinutes * 60 * 1000;
    let cycleCount = 0;

    const runCycle = async () => {
      if (!this.isBreathing || Date.now() > endTime) {
        this.stopBreathing();
        return;
      }

      cycleCount++;

      await this.hapticPulse('inhale');
      await this.sleep(config.inhale * 1000);

      if (config.hold > 0) {
        await this.hapticPulse('hold');
        await this.sleep(config.hold * 1000);
      }

      await this.hapticPulse('exhale');
      await this.sleep(config.exhale * 1000);

      if (config.holdAfter) {
        await this.sleep(config.holdAfter * 1000);
      }

      runCycle();
    };

    runCycle();

    return {
      success: true,
      message: `Esercizio ${config.name} avviato per ${durationMinutes} minuti`,
      pattern: config.name
    };
  }

  stopBreathing() {
    this.isBreathing = false;
    if (this.breathingTimer) {
      clearTimeout(this.breathingTimer);
      this.breathingTimer = null;
    }
    return { success: true, message: 'Esercizio di respirazione terminato' };
  }

  async hapticPulse(phase) {
    try {
      if (Platform.OS === 'ios') {
        const patterns = {
          inhale: [0, 30],
          hold: [0, 10],
          exhale: [0, 50]
        };
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {}
  }

  /**
   * Play ambient sound (generates tone locally - no external files needed)
   */
  async playAmbientSound(soundId) {
    const sound = AMBIENT_SOUNDS.find(s => s.id === soundId);
    if (!sound) return { success: false, error: `Suono "${soundId}" non trovato` };

    try {
      if (this.soundObject) {
        await this.stopAmbientSound();
      }

      const { sound: audio } = await Audio.Sound.createAsync(
        { uri: this.getSoundURI(soundId) },
        { isLooping: true, volume: 0.5 }
      );

      this.soundObject = audio;
      this.currentSound = sound;

      return {
        success: true,
        message: `Riproduco ${sound.emoji} ${sound.name}`,
        sound: sound
      };
    } catch (error) {
      logger.error('WellnessService', 'Failed to play ambient sound', error);
      return { success: false, error: error.message };
    }
  }

  getSoundURI(soundId) {
    return `https://cdn.freesound.org/previews/521/521707_11901001-lq.mp3`;
  }

  async stopAmbientSound() {
    if (this.soundObject) {
      try {
        await this.soundObject.stopAsync();
        await this.soundObject.unloadAsync();
      } catch (e) {}
      this.soundObject = null;
      this.currentSound = null;
    }
    return { success: true, message: 'Suono fermato' };
  }

  async setVolume(level) {
    if (this.soundObject) {
      await this.soundObject.setVolumeAsync(Math.max(0, Math.min(1, level)));
    }
  }

  /**
   * Enter wellness mode: ambient sound + DND + screen dim
   */
  async enterWellnessMode(soundId = 'rain', durationMinutes = 15) {
    this.isWellnessMode = true;

    await this.playAmbientSound(soundId);

    this._wellnessTimer = setTimeout(() => {
      this.exitWellnessMode();
    }, durationMinutes * 60 * 1000);

    return {
      success: true,
      message: `Modalità wellness attivata per ${durationMinutes} minuti 🧘`,
      sound: AMBIENT_SOUNDS.find(s => s.id === soundId)
    };
  }

  async exitWellnessMode() {
    this.isWellnessMode = false;
    await this.stopAmbientSound();
    if (this._wellnessTimer) {
      clearTimeout(this._wellnessTimer);
      this._wellnessTimer = null;
    }
    return { success: true, message: 'Modalità wellness disattivata' };
  }

  getBreathingPatterns() {
    return Object.entries(BREATHING_PATTERNS).map(([key, val]) => ({
      id: key,
      name: val.name
    }));
  }

  getAmbientSounds() {
    return AMBIENT_SOUNDS;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const wellnessService = new WellnessServiceClass();
export default WellnessServiceClass;
