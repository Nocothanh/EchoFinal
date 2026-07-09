/**
 * SMSService.js
 * Send and read SMS using expo-sms and expo-intent-launcher
 */

import { Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

class SMSService {
  constructor() {
    this.isInitialized = false;
    this.conversations = [];
  }

  init() {
    this.isInitialized = true;
    return true;
  }

  async sendSMS(phoneNumber, message) {
    try {
      if (Platform.OS === 'android') {
        const c = encodeURIComponent;
        const uri = `smsto:${c(phoneNumber)}?body=${c(message)}`;
        const supported = await Linking.canOpenURL(uri);
        if (supported) {
          await Linking.openURL(uri);
          return { success: true, method: 'intent' };
        }
        const intentUri = `content://sms/compose`;
        try {
          await IntentLauncher.startActivityAsync('android.intent.action.SENDTO', {
            data: `smsto:${phoneNumber}`,
            extra: { 'sms_body': message }
          });
          return { success: true, method: 'intent-launcher' };
        } catch (e) {
          await Linking.openURL(`sms:${phoneNumber}`);
          return { success: true, method: 'fallback' };
        }
      } else {
        const url = `sms:${phoneNumber}&body=${encodeURIComponent(message)}`;
        await Linking.openURL(url);
        return { success: true, method: 'linking' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendBulkSMS(contacts, message) {
    const results = [];
    for (const contact of contacts) {
      const result = await this.sendSMS(contact.phone, message);
      results.push({ contact: contact.name || contact.phone, ...result });
    }
    return results;
  }

  async openSMSApp() {
    try {
      if (Platform.OS === 'android') {
        await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
          category: 'android.intent.category.APP_MMS',
          packageName: 'com.google.android.apps.messaging'
        }).catch(async () => {
          await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
            category: 'android.intent.category.APP_MMS'
          });
        });
      } else {
        await Linking.openURL('sms:');
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async openConversation(phoneNumber) {
    try {
      if (Platform.OS === 'android') {
        await Linking.openURL(`smsto:${phoneNumber}`);
      } else {
        await Linking.openURL(`sms:${phoneNumber}`);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  formatPhoneNumber(number) {
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.startsWith('39')) return `+${cleaned}`;
    if (cleaned.startsWith('3') && cleaned.length === 10) return `+39${cleaned}`;
    if (cleaned.startsWith('+')) return cleaned;
    return `+39${cleaned}`;
  }

  parseNaturalSMS(text) {
    const lower = text.toLowerCase();
    const result = { phone: null, message: null };

    const phonePatterns = [
      /(?:send|invia)\s+(?:an?\s+)?(?:sms|mex|message)\s+(?:a|to)\s+(.+?)(?:\s+(?:saying|dicendo|message|messaggio)\s+(.+))?$/i,
      /(?:sms|message|mex)\s+(?:a|to)\s+(.+?)(?:\s+(?:saying|dicendo|message|messaggio)\s+(.+))?$/i,
      /(?:text|scrivi)\s+(.+?)(?:\s+(?:saying|dicendo|message|messaggio)\s+(.+))?$/i
    ];

    for (const pattern of phonePatterns) {
      const match = lower.match(pattern);
      if (match) {
        result.phone = match[1].trim();
        result.message = match[2]?.trim() || null;
        break;
      }
    }

    return result;
  }

  cleanup() {}
}

export const smsService = new SMSService();
export default SMSService;
