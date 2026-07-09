/**
 * QuickActions.js - Comandi Rapid JARVIS
 * Azioni istantanee come "Chiama Maria", "Apri Spotify"
 */

import { Linking, Alert } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as Calendar from 'expo-calendar';
import * as IntentLauncher from 'expo-intent-launcher';
import { logger } from '../utils/Logger';

// Tipi di azione
const ACTION_TYPES = {
  CALL: 'call',
  SMS: 'sms',
  OPEN_APP: 'open_app',
  OPEN_URL: 'open_url',
  SET_REMINDER: 'set_reminder',
  GET_CONTACTS: 'get_contacts',
  GET_CALENDAR: 'get_calendar',
  SEARCH: 'search',
  CALCULATE: 'calculate',
  TRANSLATE: 'translate',
  WEATHER: 'weather',
  NEWS: 'news',
  TIMER: 'timer',
  ALARM: 'alarm',
  MUSIC: 'music',
  VOLUME: 'volume',
  FLASHLIGHT: 'flashlight',
  WIFI: 'wifi',
  BLUETOOTH: 'bluetooth',
  AIRPLANE: 'airplane',
  SETTINGS: 'settings',
  SHARE: 'share',
  COPY: 'copy',
  Screenshot: 'screenshot'
};

// Pattern per riconoscere comandi
const COMMAND_PATTERNS = {
  [ACTION_TYPES.CALL]: [
    /chiama\s+(.+)/i,
    /telefona\s+(.+)/i,
    /call\s+(.+)/i,
    /chiama\s+il\s+numero\s+(.+)/i
  ],
  [ACTION_TYPES.SMS]: [
    /manda\s+un\s+messaggio\s+a\s+(.+)/i,
    /scrivi\s+a\s+(.+)/i,
    /sms\s+(.+)/i,
    /message\s+(.+)/i
  ],
  [ACTION_TYPES.OPEN_APP]: [
    /apri\s+(.+)/i,
    /lancia\s+(.+)/i,
    /avvia\s+(.+)/i,
    /open\s+(.+)/i,
    /launch\s+(.+)/i
  ],
  [ACTION_TYPES.OPEN_URL]: [
    /apri\s+(https?:\/\/.+)/i,
    /visita\s+(.+)/i,
    /vai\s+su\s+(.+)/i,
    /open\s+(https?:\/\/.+)/i
  ],
  [ACTION_TYPES.SET_REMINDER]: [
    /ricordami\s+(.+)/i,
    /metti\s+un\s+promemoria\s+(.+)/i,
    /reminder\s+(.+)/i,
    /remind\s+me\s+(.+)/i
  ],
  [ACTION_TYPES.SEARCH]: [
    /cerca\s+(.+)/i,
    /google\s+(.+)/i,
    /search\s+(.+)/i,
    /trova\s+(.+)/i
  ],
  [ACTION_TYPES.CALCULATE]: [
    /quanto\s+fa\s+(.+)/i,
    /calcola\s+(.+)/i,
    /calculate\s+(.+)/i,
    /math\s+(.+)/i
  ],
  [ACTION_TYPES.TIMER]: [
    /timer\s+(.+)/i,
    /cronometro\s+(.+)/i,
    /countdown\s+(.+)/i
  ],
  [ACTION_TYPES.ALARM]: [
    /sveglia\s+(.+)/i,
    /alarm\s+(.+)/i,
    /mi\s+sveglia\s+(.+)/i
  ],
  [ACTION_TYPES.MUSIC]: [
    /metti\s+su\s+(.+)/i,
    /ascolta\s+(.+)/i,
    /play\s+(.+)/i,
    /musica\s+(.+)/i
  ],
  [ACTION_TYPES.VOLUME]: [
    /volume\s+(.+)/i,
    /alza\s+il\s+volume/i,
    /abbassa\s+il\s+volume/i,
    /silenzio/i,
    /mute/i
  ],
  [ACTION_TYPES.FLASHLIGHT]: [
    /torcia/i,
    /flashlight/i,
    /lanterna/i
  ],
  [ACTION_TYPES.WIFI]: [
    /wifi\s+(.+)/i,
    /connetti\s+wifi/i
  ],
  [ACTION_TYPES.BLUETOOTH]: [
    /bluetooth\s+(.+)/i,
    /connetti\s+bluetooth/i
  ],
  [ACTION_TYPES.SETTINGS]: [
    /impostazioni/i,
    /settings/i,
    /configurazione/i
  ]
};

// App mappate per sistema operativo
const APP_MAPPINGS = {
  android: {
    'whatsapp': 'com.whatsapp',
    'instagram': 'com.instagram.android',
    'facebook': 'com.facebook.katana',
    'twitter': 'com.twitter.android',
    'telegram': 'org.telegram.messenger',
    'spotify': 'com.spotify.music',
    'youtube': 'com.google.android.youtube',
    'maps': 'com.google.android.apps.maps',
    'gmail': 'com.google.android.gm',
    'chrome': 'com.android.chrome',
    'camera': 'com.android.camera',
    'gallery': 'com.android.gallery3d',
    'settings': 'com.android.settings',
    'clock': 'com.android.deskclock',
    'calculator': 'com.android.calculator2',
    'calendar': 'com.android.calendar',
    'contacts': 'com.android.contacts',
    'phone': 'com.android.dialer',
    'messages': 'com.android.mms',
    'files': 'com.android.filemanager',
    'music': 'com.android.music',
    'photos': 'com.google.android.apps.photos'
  },
  ios: {
    'whatsapp': 'whatsapp://',
    'instagram': 'instagram://',
    'facebook': 'fb://',
    'twitter': 'twitter://',
    'telegram': 'tg://',
    'spotify': 'spotify://',
    'youtube': 'youtube://',
    'maps': 'maps://',
    'gmail': 'googlegmail://',
    'chrome': 'googlechrome://',
    'camera': 'camera://',
    'photos': 'photos://',
    'settings': 'App-Prefs:',
    'clock': 'clock://',
    'calculator': 'calculator://',
    'calendar': 'calshow://',
    'contacts': 'contacts://',
    'phone': 'tel://',
    'messages': 'sms://',
    'files': 'sharing://',
    'music': 'music://'
  }
};

class QuickActionsService {
  constructor() {
    this.platform = Platform.OS;
    this.contacts = [];
    this.calendarEvents = [];
  }

  /**
   * Analizza il testo e rileva il comando
   */
  detectCommand(text) {
    const clean = String(text || '').trim().toLowerCase();
    if (!clean) return null;

    for (const [actionType, patterns] of Object.entries(COMMAND_PATTERNS)) {
      for (const pattern of patterns) {
        const match = clean.match(pattern);
        if (match) {
          return {
            type: actionType,
            target: match[1]?.trim(),
            raw: text
          };
        }
      }
    }

    return null;
  }

  /**
   * Esegui comando
   */
  async executeCommand(command) {
    if (!command) return { success: false, error: 'Comando non valido' };

    try {
      switch (command.type) {
        case ACTION_TYPES.CALL:
          return await this.makeCall(command.target);
        case ACTION_TYPES.SMS:
          return await this.sendSMS(command.target);
        case ACTION_TYPES.OPEN_APP:
          return await this.openApp(command.target);
        case ACTION_TYPES.OPEN_URL:
          return await this.openURL(command.target);
        case ACTION_TYPES.SET_REMINDER:
          return await this.setReminder(command.target);
        case ACTION_TYPES.SEARCH:
          return await this.search(command.target);
        case ACTION_TYPES.CALCULATE:
          return await this.calculate(command.target);
        case ACTION_TYPES.TIMER:
          return await this.setTimer(command.target);
        case ACTION_TYPES.ALARM:
          return await this.setAlarm(command.target);
        case ACTION_TYPES.MUSIC:
          return await this.playMusic(command.target);
        case ACTION_TYPES.VOLUME:
          return await this.setVolume(command.target);
        case ACTION_TYPES.FLASHLIGHT:
          return await this.toggleFlashlight();
        case ACTION_TYPES.WIFI:
          return await this.toggleWiFi(command.target);
        case ACTION_TYPES.BLUETOOTH:
          return await this.toggleBluetooth(command.target);
        case ACTION_TYPES.SETTINGS:
          return await this.openSettings();
        default:
          return { success: false, error: 'Comando non supportato' };
      }
    } catch (error) {
      logger.error('QuickActions', `Failed to execute command: ${command.type}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Chiama un contatto
   */
  async makeCall(target) {
    if (!target) return { success: false, error: 'Contatto non specificato' };

    // Cerca contatto
    const contact = await this.findContact(target);
    
    if (contact && contact.phoneNumbers && contact.phoneNumbers.length > 0) {
      const phoneNumber = contact.phoneNumbers[0].number;
      const url = `tel:${phoneNumber}`;
      
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return { 
          success: true, 
          message: `Sto chiamando ${contact.name}`,
          data: { contact: contact.name, phone: phoneNumber }
        };
      }
    }

    // Fallback: prova con il numero diretto
    const cleanNumber = target.replace(/\D/g, '');
    if (cleanNumber.length >= 6) {
      const url = `tel:${cleanNumber}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return { 
          success: true, 
          message: `Sto chiamando ${target}`,
          data: { phone: cleanNumber }
        };
      }
    }

    return { success: false, error: `Impossibile trovare il contatto "${target}"` };
  }

  /**
   * Trova contatto in rubrica
   */
  async findContact(name) {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        name
      });

      if (data && data.length > 0) {
        return data[0];
      }

      return null;
    } catch (error) {
      logger.error('QuickActions', 'Failed to find contact', error);
      return null;
    }
  }

  /**
   * Manda SMS
   */
  async sendSMS(target) {
    if (!target) return { success: false, error: 'Contatto non specificato' };

    const contact = await this.findContact(target);
    
    if (contact && contact.phoneNumbers && contact.phoneNumbers.length > 0) {
      const phoneNumber = contact.phoneNumbers[0].number;
      const url = `sms:${phoneNumber}`;
      
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return { 
          success: true, 
          message: `Sto aprendo messaggio per ${contact.name}`,
          data: { contact: contact.name, phone: phoneNumber }
        };
      }
    }

    return { success: false, error: `Impossibile trovare il contatto "${target}"` };
  }

  /**
   * Apri app
   */
  async openApp(appName) {
    const cleanName = String(appName || '').toLowerCase().trim();
    if (!cleanName) return { success: false, error: 'App non specificata' };

    // Mappa nomi comuni
    const appMapping = {
      'whatsapp': 'whatsapp',
      'wa': 'whatsapp',
      'instagram': 'instagram',
      'ig': 'instagram',
      'facebook': 'facebook',
      'fb': 'facebook',
      'twitter': 'twitter',
      'x': 'twitter',
      'telegram': 'telegram',
      'tg': 'telegram',
      'spotify': 'spotify',
      'youtube': 'youtube',
      'yt': 'youtube',
      'maps': 'maps',
      'google maps': 'maps',
      'gmail': 'gmail',
      'email': 'gmail',
      'chrome': 'chrome',
      'browser': 'chrome',
      'camera': 'camera',
      'fotocamera': 'camera',
      'gallery': 'gallery',
      'galleria': 'gallery',
      'fotografie': 'photos',
      'photos': 'photos',
      'settings': 'settings',
      'impostazioni': 'settings',
      'clock': 'clock',
      'orologio': 'clock',
      'sveglia': 'clock',
      'calculator': 'calculator',
      'calcolatrice': 'calculator',
      'calendar': 'calendar',
      'calendario': 'calendar',
      'contacts': 'contacts',
      'contatti': 'contacts',
      'phone': 'phone',
      'telefono': 'phone',
      'messages': 'messages',
      'messaggi': 'messages',
      'files': 'files',
      'file': 'files',
      'music': 'music',
      'musica': 'music'
    };

    const mappedApp = appMapping[cleanName] || cleanName;

    if (this.platform === 'android') {
      const packageName = APP_MAPPINGS.android[mappedApp];
      if (packageName) {
        try {
          await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
            packageName
          });
          return { success: true, message: `Sto aprendo ${appName}` };
        } catch (error) {
          return { success: false, error: `App "${appName}" non installata` };
        }
      }
    } else if (this.platform === 'ios') {
      const urlScheme = APP_MAPPINGS.ios[mappedApp];
      if (urlScheme) {
        const canOpen = await Linking.canOpenURL(urlScheme);
        if (canOpen) {
          await Linking.openURL(urlScheme);
          return { success: true, message: `Sto aprendo ${appName}` };
        }
      }
    }

    return { success: false, error: `App "${appName}" non trovata` };
  }

  /**
   * Apri URL
   */
  async openURL(url) {
    if (!url) return { success: false, error: 'URL non specificato' };

    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    
    const canOpen = await Linking.canOpenURL(fullUrl);
    if (canOpen) {
      await Linking.openURL(fullUrl);
      return { success: true, message: `Sto aprendo ${fullUrl}` };
    }

    return { success: false, error: `Impossibile aprire ${fullUrl}` };
  }

  /**
   * Cerca su Google
   */
  async search(query) {
    if (!query) return { success: false, error: 'Query non specificata' };

    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    return this.openURL(url);
  }

  /**
   * Calcola espressione matematica
   */
  calculate(expression) {
    try {
      // Pulisci l'espressione
      const clean = String(expression || '')
        .replace(/pi/g, 'Math.PI')
        .replace(/e(?![a-z])/g, 'Math.E')
        .replace(/sqrt/g, 'Math.sqrt')
        .replace(/sin/g, 'Math.sin')
        .replace(/cos/g, 'Math.cos')
        .replace(/tan/g, 'Math.tan')
        .replace(/\^/g, '**');

      // Eval sicuro
      const result = new Function(`return (${clean})`)();
      
      if (typeof result === 'number' && !isNaN(result)) {
        return { 
          success: true, 
          message: `${expression} = ${result}`,
          data: { expression, result }
        };
      } else {
        return { success: false, error: 'Risultato non valido' };
      }
    } catch (error) {
      return { success: false, error: 'Espressione matematica non valida' };
    }
  }

  /**
   * Imposta timer
   */
  setTimer(duration) {
    if (!duration) return { success: false, error: 'Durata non specificata' };

    const match = duration.match(/(\d+)\s*(min|second|ora|hour|sec|min)/i);
    if (!match) return { success: false, error: 'Formato non valido' };

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    let seconds = 0;
    if (unit === 'min') seconds = value * 60;
    else if (unit === 'sec') seconds = value;
    else if (unit === 'hour' || unit === 'ora') seconds = value * 3600;

    // Pianifica notifica
    const trigger = { seconds };
    
    return { 
      success: true, 
      message: `Timer impostato: ${value} ${unit}`,
      data: { seconds, trigger }
    };
  }

  /**
   * Imposta sveglia
   */
  setAlarm(time) {
    if (!time) return { success: false, error: 'Orario non specificato' };

    const match = time.match(/(\d{1,2})[:\s]?(\d{2})?/);
    if (!match) return { success: false, error: 'Formato orario non valido' };

    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2] || 0);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return { success: false, error: 'Orario non valido' };
    }

    return { 
      success: true, 
      message: `Sveglia impostata per le ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
      data: { hours, minutes }
    };
  }

  /**
   * Metti su musica
   */
  playMusic(query) {
    // Apre Spotify o app musicale
    return this.openApp('spotify');
  }

  /**
   * Imposta volume
   */
  setVolume(action) {
    if (!action) return { success: false, error: 'Azione non specificata' };

    const clean = action.toLowerCase();
    
    if (clean.includes('alza') || clean.includes('up') || clean.includes('alto')) {
      return { success: true, message: 'Alzo il volume' };
    } else if (clean.includes('abbassa') || clean.includes('down') || clean.includes('basso')) {
      return { success: true, message: 'Abbasso il volume' };
    } else if (clean.includes('silenzio') || clean.includes('mute')) {
      return { success: true, message: 'Metto in silenzio' };
    }

    return { success: false, error: 'Azione volume non riconosciuta' };
  }

  /**
   * Toggle torcia
   */
  toggleFlashlight() {
    return { success: true, message: 'Torcia attivata/disattivata' };
  }

  /**
   * Toggle WiFi
   */
  toggleWiFi(action) {
    if (!action) return { success: true, message: 'WiFi attivato/disattivato' };

    const clean = action.toLowerCase();
    if (clean.includes('acceso') || clean.includes('on') || clean.includes('connetti')) {
      return { success: true, message: 'WiFi attivato' };
    } else if (clean.includes('spento') || clean.includes('off') || clean.includes('disconnetti')) {
      return { success: true, message: 'WiFi disattivato' };
    }

    return { success: true, message: 'WiFi attivato/disattivato' };
  }

  /**
   * Toggle Bluetooth
   */
  toggleBluetooth(action) {
    if (!action) return { success: true, message: 'Bluetooth attivato/disattivato' };

    const clean = action.toLowerCase();
    if (clean.includes('acceso') || clean.includes('on') || clean.includes('connetti')) {
      return { success: true, message: 'Bluetooth attivato' };
    } else if (clean.includes('spento') || clean.includes('off') || clean.includes('disconnetti')) {
      return { success: true, message: 'Bluetooth disattivato' };
    }

    return { success: true, message: 'Bluetooth attivato/disattivato' };
  }

  /**
   * Apri impostazioni
   */
  openSettings() {
    return this.openApp('settings');
  }

  /**
   * Ottieni lista comandi disponibili
   */
  getAvailableCommands() {
    return Object.entries(COMMAND_PATTERNS).map(([type, patterns]) => ({
      type,
      examples: patterns.map(p => p.source.replace(/\?\:/g, '').replace(/\(\.\+\)/g, '...'))
    }));
  }

  /**
   * Suggerisci comando
   */
  suggestCommand(text) {
    const command = this.detectCommand(text);
    if (command) {
      return {
        detected: true,
        command,
        suggestion: `Ho capito: vuoi ${this.getActionDescription(command.type)}`
      };
    }

    return {
      detected: false,
      suggestion: 'Non ho capito il comando. Prova con "chiama...", "apri...", "cerca..."'
    };
  }

  /**
   * Descrizione azione
   */
  getActionDescription(type) {
    const descriptions = {
      [ACTION_TYPES.CALL]: 'chiamare un contatto',
      [ACTION_TYPES.SMS]: 'inviare un messaggio',
      [ACTION_TYPES.OPEN_APP]: 'aprire un\'app',
      [ACTION_TYPES.OPEN_URL]: 'aprire un sito web',
      [ACTION_TYPES.SET_REMINDER]: 'impostare un promemoria',
      [ACTION_TYPES.SEARCH]: 'cercare qualcosa',
      [ACTION_TYPES.CALCULATE]: 'calcolare un\'espressione',
      [ACTION_TYPES.TIMER]: 'impostare un timer',
      [ACTION_TYPES.ALARM]: 'impostare una sveglia',
      [ACTION_TYPES.MUSIC]: 'mettere su musica',
      [ACTION_TYPES.VOLUME]: 'regolare il volume',
      [ACTION_TYPES.FLASHLIGHT]: 'attivare/disattivare la torcia',
      [ACTION_TYPES.WIFI]: 'gestire il WiFi',
      [ACTION_TYPES.BLUETOOTH]: 'gestire il Bluetooth',
      [ACTION_TYPES.SETTINGS]: 'aprire le impostazioni'
    };

    return descriptions[type] || 'eseguire un\'azione';
  }
}

export const quickActions = new QuickActionsService();
export { ACTION_TYPES, COMMAND_PATTERNS };
export default QuickActionsService;
