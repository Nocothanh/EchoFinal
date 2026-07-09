/**
 * DeviceControlService.js - Controllo Dispositivo Reale
 * WiFi, Bluetooth, Torcia, Volume, luminosità
 */

import { Platform, Linking, Alert } from 'react-native';
import * as Brightness from 'expo-brightness';
import * as Haptics from 'expo-haptics';
import * as IntentLauncher from 'expo-intent-launcher';
import { logger } from '../utils/Logger';

class DeviceControlServiceClass {
  constructor() {
    this.isInitialized = false;
    this.supportedFeatures = [];
  }

  /**
   * Inizializza il servizio
   */
  async init() {
    try {
      // Rileva features supportate
      this.supportedFeatures = await this._detectSupportedFeatures();
      
      this.isInitialized = true;
      logger.info('DeviceControlService', 'Initialized', {
        supportedFeatures: this.supportedFeatures
      });

      return true;
    } catch (error) {
      logger.error('DeviceControlService', 'Failed to initialize', error);
      return false;
    }
  }

  /**
   * Rileva features supportate dalla piattaforma
   */
  async _detectSupportedFeatures() {
    const features = [];

    try {
      // Brightness
      const brightnessStatus = await Brightness.getPermissionsAsync();
      if (brightnessStatus.granted) {
        features.push('brightness');
      }
    } catch (e) {
      // Ignora
    }

    try {
      // Haptics
      features.push('haptics');
    } catch (e) {
      // Ignora
    }

    // WiFi/Bluetooth via Intent (Android)
    if (Platform.OS === 'android') {
      features.push('wifi_settings');
      features.push('bluetooth_settings');
      features.push('airplane_mode');
      features.push('nfc_settings');
      features.push('location_settings');
    }

    // System settings
    features.push('system_settings');
    features.push('app_settings');

    // Volume (via Linking)
    features.push('volume_ui');

    return features;
  }

  /**
   * Controllo luminosità
   */
  async setBrightness(level) {
    try {
      const { status } = await Brightness.requestPermissionsAsync();
      if (status !== 'granted') {
        return { success: false, error: 'Permesso luminosità non concesso' };
      }

      const normalizedLevel = Math.max(0, Math.min(1, level));
      await Brightness.setBrightnessAsync(normalizedLevel);

      logger.info('DeviceControlService', `Brightness set to ${normalizedLevel}`);
      return { success: true, level: normalizedLevel };
    } catch (error) {
      logger.error('DeviceControlService', 'Failed to set brightness', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Aumenta luminosità
   */
  async increaseBrightness(amount = 0.1) {
    try {
      const current = await Brightness.getBrightnessAsync();
      const newLevel = Math.min(1, current + amount);
      return this.setBrightness(newLevel);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Diminuisci luminosità
   */
  async decreaseBrightness(amount = 0.1) {
    try {
      const current = await Brightness.getBrightnessAsync();
      const newLevel = Math.max(0, current - amount);
      return this.setBrightness(newLevel);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Ottieni luminosità corrente
   */
  async getBrightness() {
    try {
      const level = await Brightness.getBrightnessAsync();
      return { success: true, level };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Vibrazione (haptics)
   */
  async vibrate(pattern = 'medium') {
    try {
      switch (pattern) {
        case 'light':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackStyle.Warning);
          break;
        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        default:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      logger.info('DeviceControlService', `Vibrated with pattern: ${pattern}`);
      return { success: true, pattern };
    } catch (error) {
      logger.error('DeviceControlService', 'Failed to vibrate', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Apri impostazioni WiFi
   */
  async openWiFiSettings() {
    try {
      if (Platform.OS === 'android') {
        await IntentLauncher.startActivityAsync('android.settings.WIFI_SETTINGS');
        return { success: true, action: 'WiFi settings opened' };
      } else {
        // iOS: apri impostazioni app
        await Linking.openURL('app-settings:');
        return { success: true, action: 'Settings opened' };
      }
    } catch (error) {
      logger.error('DeviceControlService', 'Failed to open WiFi settings', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Apri impostazioni Bluetooth
   */
  async openBluetoothSettings() {
    try {
      if (Platform.OS === 'android') {
        await IntentLauncher.startActivityAsync('android.settings.BLUETOOTH_SETTINGS');
        return { success: true, action: 'Bluetooth settings opened' };
      } else {
        await Linking.openURL('App-Prefs:Bluetooth');
        return { success: true, action: 'Bluetooth settings opened' };
      }
    } catch (error) {
      logger.error('DeviceControlService', 'Failed to open Bluetooth settings', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Apri modalità aereo
   */
  async openAirplaneMode() {
    try {
      if (Platform.OS === 'android') {
        await IntentLauncher.startActivityAsync('android.settings.AIRPLANE_MODE_SETTINGS');
        return { success: true, action: 'Airplane mode settings opened' };
      } else {
        await Linking.openURL('App-Prefs:');
        return { success: true, action: 'Settings opened' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Apri impostazioni NFC
   */
  async openNFCSettings() {
    try {
      if (Platform.OS === 'android') {
        await IntentLauncher.startActivityAsync('android.settings.NFC_SETTINGS');
        return { success: true, action: 'NFC settings opened' };
      } else {
        return { success: false, error: 'NFC settings not available on iOS' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Apri impostazioni posizione
   */
  async openLocationSettings() {
    try {
      if (Platform.OS === 'android') {
        await IntentLauncher.startActivityAsync('android.settings.LOCATION_SOURCE_SETTINGS');
        return { success: true, action: 'Location settings opened' };
      } else {
        await Linking.openURL('App-Prefs:Privacy&path=LOCATION');
        return { success: true, action: 'Location settings opened' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Apri impostazioni sistema
   */
  async openSystemSettings() {
    try {
      if (Platform.OS === 'android') {
        await IntentLauncher.startActivityAsync('android.settings.SETTINGS');
      } else {
        await Linking.openURL('app-settings:');
      }
      return { success: true, action: 'System settings opened' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Apri impostazioni app
   */
  async openAppSettings() {
    try {
      if (Platform.OS === 'android') {
        const cnePackage = 'com.nocothanh.echofinal';
        await IntentLauncher.startActivityAsync('android.settings.APPLICATION_DETAILS_SETTINGS', {
          data: `package:${cnePackage}`
        });
      } else {
        await Linking.openURL('app-settings:');
      }
      return { success: true, action: 'App settings opened' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Apri volume UI
   */
  async openVolumeUI() {
    try {
      // Su Android, apri panello volume
      if (Platform.OS === 'android') {
        // Non c'è un intent diretto, ma possiamo aprire le impostazioni audio
        await IntentLauncher.startActivityAsync('android.settings.SOUND_SETTINGS');
        return { success: true, action: 'Sound settings opened' };
      }
      return { success: false, error: 'Volume UI not available on iOS' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Controllo generico dispositvo
   */
  async controlDevice(action, params = {}) {
    const actionMap = {
      // Luminosità
      'brightness_up': () => this.increaseBrightness(params.amount || 0.1),
      'brightness_down': () => this.decreaseBrightness(params.amount || 0.1),
      'brightness_set': () => this.setBrightness(params.level || 0.5),
      'brightness_get': () => this.getBrightness(),

      // Vibrazione
      'vibrate': () => this.vibrate(params.pattern || 'medium'),

      // Impostazioni
      'wifi': () => this.openWiFiSettings(),
      'bluetooth': () => this.openBluetoothSettings(),
      'airplane': () => this.openAirplaneMode(),
      'nfc': () => this.openNFCSettings(),
      'location': () => this.openLocationSettings(),
      'settings': () => this.openSystemSettings(),
      'app_settings': () => this.openAppSettings(),
      'volume': () => this.openVolumeUI(),

      // Info
      'features': () => Promise.resolve({ 
        success: true, 
        features: this.supportedFeatures 
      })
    };

    const handler = actionMap[action];
    if (handler) {
      return handler();
    }

    return { success: false, error: `Unknown action: ${action}` };
  }

  /**
   * Ottieni stato dispositivo
   */
  async getDeviceStatus() {
    const status = {
      platform: Platform.OS,
      supportedFeatures: this.supportedFeatures,
      brightness: null
    };

    try {
      const brightnessResult = await this.getBrightness();
      if (brightnessResult.success) {
        status.brightness = brightnessResult.level;
      }
    } catch (e) {
      // Ignora
    }

    return status;
  }

  /**
   * Verifica feature supportata
   */
  isFeatureSupported(feature) {
    return this.supportedFeatures.includes(feature);
  }

  /**
   * Ottieni lista features
   */
  getSupportedFeatures() {
    return this.supportedFeatures;
  }

  /**
   * Ottieni stato
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      supportedFeatures: this.supportedFeatures,
      platform: Platform.OS
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.supportedFeatures = [];
    logger.info('DeviceControlService', 'Cleanup completed');
  }
}

export const deviceControlService = new DeviceControlServiceClass();
export default DeviceControlServiceClass;
