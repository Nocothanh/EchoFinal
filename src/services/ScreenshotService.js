/**
 * ScreenshotService.js
 * Capture and analyze screen content using view-shot
 */

import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

class ScreenshotService {
  constructor() {
    this.isInitialized = false;
    this.lastScreenshot = null;
    this.screenshots = [];
  }

  async init() {
    this.isInitialized = true;
    return true;
  }

  async captureScreen() {
    try {
      const permission = await ScreenCapture.requestPermissionsAsync();
      if (!permission.granted) {
        return { success: false, error: 'Screenshot permission denied' };
      }

      const uri = await ScreenCapture.captureAsync({ result: 'tmpfile' });
      if (uri) {
        const screenshot = {
          id: `screenshot_${Date.now()}`,
          uri,
          timestamp: Date.now(),
          size: await this.getFileSize(uri)
        };
        this.lastScreenshot = screenshot;
        this.screenshots.unshift(screenshot);
        if (this.screenshots.length > 20) this.screenshots = this.screenshots.slice(0, 20);
        return { success: true, uri, screenshot };
      }
      return { success: false, error: 'Failed to capture screen' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async shareScreenshot(uri) {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) return { success: false, error: 'Sharing not available' };

      await Sharing.shareAsync(uri || this.lastScreenshot?.uri);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteScreenshot(id) {
    const screenshot = this.screenshots.find(s => s.id === id);
    if (screenshot) {
      try {
        await FileSystem.deleteAsync(screenshot.uri, { idempotent: true });
      } catch (e) {}
      this.screenshots = this.screenshots.filter(s => s.id !== id);
    }
    return { success: true };
  }

  async getFileSize(uri) {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return info.size || 0;
    } catch (e) {
      return 0;
    }
  }

  getScreenshots() {
    return this.screenshots;
  }

  getLastScreenshot() {
    return this.lastScreenshot;
  }

  async takeScreenshotAndAnalyze() {
    const result = await this.captureScreen();
    if (result.success) {
      return {
        success: true,
        uri: result.uri,
        message: 'Screenshot captured. Use camera vision to analyze it.'
      };
    }
    return result;
  }

  cleanup() {
    this.screenshots.forEach(s => {
      FileSystem.deleteAsync(s.uri, { idempotent: true }).catch(() => {});
    });
    this.screenshots = [];
    this.lastScreenshot = null;
  }
}

export const screenshotService = new ScreenshotService();
export default ScreenshotService;
