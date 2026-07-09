/**
 * DeepLinkService.js - App deep links for 25+ apps
 * Search inside apps by voice: "play Despacito on Spotify", "search cats on YouTube"
 */

import { Linking, Platform } from 'react-native';
import { logger } from '../utils/Logger';

const APP_DEEP_LINKS = {
  // Music
  'spotify': {
    ios: 'spotify://',
    android: 'com.spotify.music',
    search: (q) => Platform.OS === 'ios'
      ? `spotify://search/${encodeURIComponent(q)}`
      : `spotify://search/${encodeURIComponent(q)}`,
    play: (q) => Platform.OS === 'ios'
      ? `spotify://search/${encodeURIComponent(q)}`
      : `spotify://search/${encodeURIComponent(q)}`
  },
  'youtube music': {
    ios: 'ytmusic://',
    android: 'com.google.android.apps.youtube.music',
    search: (q) => `https://music.youtube.com/search?q=${encodeURIComponent(q)}`
  },
  'amazon music': {
    ios: 'amznm://',
    android: 'com.amazon.mp3',
    search: (q) => `https://music.amazon.com/search/${encodeURIComponent(q)}`
  },
  'soundcloud': {
    ios: 'soundcloud://',
    android: 'com.soundcloud.android',
    search: (q) => `https://soundcloud.com/search?q=${encodeURIComponent(q)}`
  },
  'deezer': {
    ios: 'deezer://',
    android: 'deezer.android.app',
    search: (q) => `deezer://www.deezer.com/search/${encodeURIComponent(q)}`
  },
  'shazam': {
    ios: 'shazam://',
    android: 'com.shazam.android'
  },

  // Video
  'youtube': {
    ios: 'youtube://',
    android: 'com.google.android.youtube',
    search: (q) => `youtube://results?search_query=${encodeURIComponent(q)}`
  },
  'netflix': {
    ios: 'nflx-',
    android: 'com.netflix.mediaclient',
    search: (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}`
  },
  'tiktok': {
    ios: 'tiktok://',
    android: 'com.zhiliaoapp.musically',
    search: (q) => `https://www.tiktok.com/search?q=${encodeURIComponent(q)}`
  },
  'twitch': {
    ios: 'twitch://',
    android: 'tv.twitch.android.app',
    search: (q) => `https://www.twitch.tv/search?term=${encodeURIComponent(q)}`
  },

  // Social
  'twitter': {
    ios: 'twitter://',
    android: 'com.twitter.android',
    search: (q) => `twitter://search?query=${encodeURIComponent(q)}`
  },
  'x': {
    ios: 'twitter://',
    android: 'com.twitter.android',
    search: (q) => `twitter://search?query=${encodeURIComponent(q)}`
  },
  'reddit': {
    ios: 'reddit://',
    android: 'com.reddit.frontpage',
    search: (q) => `reddit://search?q=${encodeURIComponent(q)}`
  },
  'instagram': {
    ios: 'instagram://',
    android: 'com.instagram.android',
    search: (q) => `https://www.instagram.com/explore/tags/${encodeURIComponent(q.replace('#', ''))}`
  },
  'whatsapp': {
    ios: 'whatsapp://',
    android: 'com.whatsapp'
  },
  'telegram': {
    ios: 'tg://',
    android: 'org.telegram.messenger'
  },

  // Shopping
  'amazon': {
    ios: 'com.amazon://',
    android: 'com.amazon.mShop.android.shopping',
    search: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`
  },
  'ebay': {
    ios: 'ebay://',
    android: 'com.ebay.mobile',
    search: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`
  },

  // Travel
  'maps': {
    ios: 'maps://',
    android: 'com.google.android.apps.maps',
    navigate: (q) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`
  },
  'google maps': {
    ios: 'maps://',
    android: 'com.google.android.apps.maps',
    navigate: (q) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`
  },
  'uber': {
    ios: 'uber://',
    android: 'com.ubercab',
    navigate: (q) => `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff=${encodeURIComponent(q)}`
  },
  'lyft': {
    ios: 'lyft://',
    android: 'lyft.android'
  },
  'google translate': {
    ios: 'googletranslate://',
    android: 'com.google.android.apps.translate'
  },

  // Browse
  'chrome': {
    ios: 'googlechrome://',
    android: 'com.android.chrome'
  },
  'play store': {
    android: 'market://search?q='
  }
};

class DeepLinkServiceClass {
  constructor() {
    this.isInitialized = false;
  }

  async init() {
    this.isInitialized = true;
    logger.info('DeepLinkService', 'Initialized with 25+ app deep links');
    return true;
  }

  /**
   * Parse a voice command and extract app + action
   */
  parseCommand(text) {
    const lower = text.toLowerCase().trim();

    const playMatch = lower.match(/(?:play|metti|ascolta|riproduci)\s+(.+?)(?:\s+(?:on|su|in|di)\s+(.+))?$/i);
    if (playMatch) {
      return { action: 'play', query: playMatch[1].trim(), app: playMatch[2]?.trim() || 'spotify' };
    }

    const searchMatch = lower.match(/(?:search|cerca|trova|google)\s+(.+?)(?:\s+(?:on|su|in|di)\s+(.+))?$/i);
    if (searchMatch) {
      return { action: 'search', query: searchMatch[1].trim(), app: searchMatch[2]?.trim() || 'youtube' };
    }

    const openMatch = lower.match(/(?:open|apri|lancia|avvia)\s+(.+)/i);
    if (openMatch) {
      return { action: 'open', app: openMatch[1].trim() };
    }

    const navMatch = lower.match(/(?:navigate|naviga|portami|vai a|vai in)\s+(.+)/i);
    if (navMatch) {
      return { action: 'navigate', destination: navMatch[1].trim() };
    }

    const watchMatch = lower.match(/(?:watch|guarda|vedi)\s+(.+?)(?:\s+(?:on|su|in|di)\s+(.+))?$/i);
    if (watchMatch) {
      return { action: 'search', query: watchMatch[1].trim(), app: watchMatch[2]?.trim() || 'youtube' };
    }

    return null;
  }

  /**
   * Execute a deep link command
   */
  async execute(command) {
    if (!command) return { success: false, error: 'Comando non valido' };

    try {
      switch (command.action) {
        case 'play':
          return await this.playInApp(command.query, command.app);
        case 'search':
          return await this.searchInApp(command.query, command.app);
        case 'open':
          return await this.openApp(command.app);
        case 'navigate':
          return await this.navigate(command.destination);
        default:
          return { success: false, error: `Azione sconosciuta: ${command.action}` };
      }
    } catch (error) {
      logger.error('DeepLinkService', 'Execute failed', error);
      return { success: false, error: error.message };
    }
  }

  async playInApp(query, appName) {
    const app = APP_DEEP_LINKS[appName.toLowerCase()];
    if (!app) return { success: false, error: `App "${appName}" non supportata` };

    const url = app.play ? app.play(query) : app.search?.(query);
    if (!url) return { success: false, error: `Ricerca non supportata per ${appName}` };

    return this.openURL(url, `Riproduco "${query}" su ${appName}`);
  }

  async searchInApp(query, appName) {
    const app = APP_DEEP_LINKS[appName.toLowerCase()];
    if (!app) return { success: false, error: `App "${appName}" non supportata` };

    const url = app.search?.(query);
    if (!url) return { success: false, error: `Ricerca non supportata per ${appName}` };

    return this.openURL(url, `Cerco "${query}" su ${appName}`);
  }

  async openApp(appName) {
    const app = APP_DEEP_LINKS[appName.toLowerCase()];
    if (!app) return { success: false, error: `App "${appName}" non trovata` };

    const scheme = Platform.OS === 'ios' ? app.ios : app.android;
    if (!scheme) return { success: false, error: `App non disponibile su ${Platform.OS}` };

    if (scheme.startsWith('http')) {
      return this.openURL(scheme, `Apro ${appName}`);
    }

    const canOpen = await Linking.canOpenURL(scheme).catch(() => false);
    if (canOpen) {
      await Linking.openURL(scheme);
      return { success: true, message: `Apro ${appName}` };
    }

    if (Platform.OS === 'android' && app.android) {
      return this.openURL(
        `https://play.google.com/store/apps/details?id=${app.android}`,
        `Apro ${appName} su Play Store`
      );
    }

    return { success: false, error: `${appName} non installata` };
  }

  async navigate(destination) {
    const url = Platform.OS === 'ios'
      ? `maps://maps?q=${encodeURIComponent(destination)}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;

    return this.openURL(url, `Navigo verso ${destination}`);
  }

  async openURL(url, message) {
    try {
      const canOpen = await Linking.canOpenURL(url).catch(() => false);
      if (canOpen) {
        await Linking.openURL(url);
        return { success: true, message: message || `Apro ${url}` };
      }
      return { success: false, error: `Impossibile aprire ${url}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getSupportedApps() {
    return Object.keys(APP_DEEP_LINKS);
  }
}

export const deepLinkService = new DeepLinkServiceClass();
export default DeepLinkServiceClass;
