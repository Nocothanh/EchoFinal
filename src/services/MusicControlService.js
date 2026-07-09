/**
 * MusicControlService.js
 * Play/pause/skip, now playing, and media session control
 */

import { Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

class MusicControlService {
  constructor() {
    this.isInitialized = false;
    this.currentApp = null;
    this.isPlaying = false;
  }

  async init() {
    this.isInitialized = true;
    return true;
  }

  // Android Media Session Controls via Media Session intent
  async mediaAction(action) {
    if (Platform.OS !== 'android') {
      return { success: false, error: 'Media session control is Android-only' };
    }

    try {
      const actions = {
        'play': { key: 'android.intent.action.MEDIA_BUTTON', extra: { 'android.intent.extra.KEY_EVENT': 85 } },
        'pause': { key: 'android.intent.action.MEDIA_BUTTON', extra: { 'android.intent.extra.KEY_EVENT': 85 } },
        'next': { key: 'android.intent.action.MEDIA_BUTTON', extra: { 'android.intent.extra.KEY_EVENT': 87 } },
        'previous': { key: 'android.intent.action.MEDIA_BUTTON', extra: { 'android.intent.extra.KEY_EVENT': 88 } },
        'stop': { key: 'android.intent.action.MEDIA_BUTTON', extra: { 'android.intent.extra.KEY_EVENT': 86 } }
      };

      const config = actions[action];
      if (!config) return { success: false, error: `Unknown action: ${action}` };

      await IntentLauncher.startActivityAsync(config.key, config.extra);
      this.isPlaying = action === 'play';
      return { success: true, action };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async play() { return this.mediaAction('play'); }
  async pause() { return this.mediaAction('pause'); }
  async togglePlayPause() { return this.mediaAction(this.isPlaying ? 'pause' : 'play'); }
  async nextTrack() { return this.mediaAction('next'); }
  async previousTrack() { return this.mediaAction('previous'); }
  async stop() { return this.mediaAction('stop'); }

  async openMusicApp(appName = 'spotify') {
    const apps = {
      spotify: { android: 'com.spotify.music', ios: 'spotify:' },
      apple_music: { ios: 'music://' },
      youtube_music: { android: 'com.google.android.apps.youtube.music', ios: 'ytmusic:' },
      amazon_music: { android: 'com.amazon.mp3', ios: 'amaznmusic:' },
      deezer: { android: 'deezer.android.app', ios: 'deezer://www.deezer.com' },
      soundcloud: { android: 'com.soundcloud.android', ios: 'soundcloud://' },
      tidal: { android: 'com.tidal.hifi', ios: 'tidal://', url: 'https://tidal.com' }
    };

    const app = apps[appName.toLowerCase()];
    if (!app) return { success: false, error: `Unknown music app: ${appName}` };

    try {
      if (Platform.OS === 'android' && app.android) {
        await IntentLauncher.startActivityAsync('android.intent.action.MAIN', {
          category: 'android.intent.category.LAUNCHER',
          packageName: app.android
        });
      } else if (Platform.OS === 'ios' && app.ios) {
        await Linking.openURL(app.ios);
      } else if (app.url) {
        await Linking.openURL(app.url);
      }
      this.currentApp = appName;
      return { success: true, app: appName };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async playInSpotify(query) {
    const searchUrl = `spotifysearch:${encodeURIComponent(query)}`;
    const playUrl = `spotify:search:${encodeURIComponent(query)}`;

    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL(searchUrl).catch(() => Linking.openURL(playUrl));
      } else {
        await Linking.openURL(`spotify:search:${query}`);
      }
      return { success: true, app: 'spotify' };
    } catch (error) {
      return this.openMusicApp('spotify');
    }
  }

  async playInApp(query, appName) {
    const searchUrls = {
      youtube_music: `youtube-music://search?q=${encodeURIComponent(query)}`,
      amazon_music: `amaznmusic://search?query=${encodeURIComponent(query)}`,
      deezer: `deezer://www.deezer.com/search/${encodeURIComponent(query)}`,
      soundcloud: `soundcloud://search?q=${encodeURIComponent(query)}`
    };

    const url = searchUrls[appName.toLowerCase()];
    if (url) {
      try {
        await Linking.openURL(url);
        return { success: true, app: appName };
      } catch (e) {}
    }

    return this.openMusicApp(appName);
  }

  async setVolume(level) {
    if (Platform.OS === 'android') {
      try {
        const volume = Math.max(0, Math.min(15, Math.round(level * 15)));
        await IntentLauncher.startActivityAsync('android.intent.action.VOLUME_SETTINGS');
        return { success: true, level };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: 'Volume control not available on iOS without native module' };
  }

  getSupportedApps() {
    return [
      { id: 'spotify', name: 'Spotify', icon: '🎵' },
      { id: 'youtube_music', name: 'YouTube Music', icon: '▶️' },
      { id: 'amazon_music', name: 'Amazon Music', icon: '🎶' },
      { id: 'deezer', name: 'Deezer', icon: '🎧' },
      { id: 'soundcloud', name: 'SoundCloud', icon: '☁️' },
      { id: 'tidal', name: 'Tidal', icon: '🌊' }
    ];
  }

  parseMusicCommand(text) {
    const lower = text.toLowerCase();
    const commands = {
      play: /(?:play|riproduci|metti|avvia|metti su|play)\s+(.+)/i,
      pause: /(?:pause|pausa|ferma|stop)/i,
      next: /(?:next|avanti|prossima|canzone successiva)/i,
      previous: /(?:previous|indietro|precedente|canzone precedente)/i,
      shuffle: /(?:shuffle|mescola|casuale)/i,
      volume_up: /(?:volume up|alza volume|più volume)/i,
      volume_down: /(?:volume down|abbassa volume|meno volume)/i,
    };

    for (const [cmd, regex] of Object.entries(commands)) {
      const match = lower.match(regex);
      if (match) {
        return { command: cmd, query: match[1] || null };
      }
    }
    return null;
  }

  cleanup() {}
}

export const musicControlService = new MusicControlService();
export default MusicControlService;
