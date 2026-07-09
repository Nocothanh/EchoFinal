/**
 * AccessibilityBridge.js
 * React Native bridge wrapper for Android AccessibilityService
 * Enables screen reading, app control, and UI interaction
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { EchoAccessibility } = NativeModules;
const emitter = EchoAccessibility ? new NativeEventEmitter(EchoAccessibility) : null;

class AccessibilityBridgeService {
  constructor() {
    this.isAvailable = Platform.OS === 'android' && !!EchoAccessibility;
    this.screenContent = '';
    this.listeners = [];
  }

  async isEnabled() {
    if (!this.isAvailable) return false;
    return EchoAccessibility.isEnabled();
  }

  openSettings() {
    if (!this.isAvailable) return;
    EchoAccessibility.openSettings();
  }

  /**
   * Read current screen content
   */
  async readScreen() {
    if (!this.isAvailable) return { success: false, error: 'Not available on this platform' };
    try {
      const content = await EchoAccessibility.getScreenContent();
      this.screenContent = content;
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Find element by text on screen
   */
  async findElement(text) {
    if (!this.isAvailable) return { success: false, error: 'Not available' };
    try {
      const elements = await EchoAccessibility.findElement(text);
      return { success: true, elements };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Tap at screen coordinates
   */
  async tap(x, y) {
    if (!this.isAvailable) return { success: false, error: 'Not available' };
    try {
      const result = await EchoAccessibility.tap(x, y);
      return { success: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Tap on element by text (find + tap)
   */
  async tapByText(text) {
    const found = await this.findElement(text);
    if (found.success && found.elements && found.elements.length > 0) {
      const el = found.elements[0];
      return this.tap(el.x + el.width / 2, el.y + el.height / 2);
    }
    return { success: false, error: `Element "${text}" not found` };
  }

  /**
   * Type text into focused element
   */
  async typeText(text) {
    if (!this.isAvailable) return { success: false, error: 'Not available' };
    try {
      const result = await EchoAccessibility.typeText(text);
      return { success: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Scroll down
   */
  async scrollDown() {
    if (!this.isAvailable) return { success: false, error: 'Not available' };
    try {
      const result = await EchoAccessibility.scrollDown();
      return { success: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Go back
   */
  async goBack() {
    if (!this.isAvailable) return { success: false, error: 'Not available' };
    try {
      const result = await EchoAccessibility.goBack();
      return { success: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Go home
   */
  async goHome() {
    if (!this.isAvailable) return { success: false, error: 'Not available' };
    try {
      const result = await EchoAccessibility.goHome();
      return { success: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get list of running apps
   */
  async getRunningApps() {
    if (!this.isAvailable) return { success: false, error: 'Not available' };
    try {
      const apps = await EchoAccessibility.getRunningApps();
      return { success: true, apps };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Listen for accessibility events
   */
  onEvent(callback) {
    if (!emitter) return () => {};
    const sub = emitter.addListener('EchoAccessibilityEvent', callback);
    this.listeners.push(sub);
    return () => sub.remove();
  }

  /**
   * High-level: "Open WhatsApp and send message"
   */
  async controlApp(appName, actions) {
    const steps = [];

    for (const action of actions) {
      switch (action.type) {
        case 'find':
          const found = await this.findElement(action.text);
          if (found.success && found.elements?.length > 0) {
            const el = found.elements[0];
            await this.tap(el.x + el.width / 2, el.y + el.height / 2);
            steps.push({ action: 'tap', text: action.text, success: true });
          } else {
            steps.push({ action: 'find', text: action.text, success: false });
          }
          break;

        case 'type':
          const typed = await this.typeText(action.text);
          steps.push({ action: 'type', text: action.text, success: typed.success });
          break;

        case 'scroll':
          await this.scrollDown();
          steps.push({ action: 'scroll', success: true });
          break;

        case 'back':
          await this.goBack();
          steps.push({ action: 'back', success: true });
          break;

        case 'wait':
          await new Promise(r => setTimeout(r, action.ms || 1000));
          steps.push({ action: 'wait', success: true });
          break;
      }
    }

    return { success: true, steps };
  }
}

export const accessibilityBridge = new AccessibilityBridgeService();
export default AccessibilityBridgeService;
