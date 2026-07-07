// Reusable permission helpers. Prefer these over per-service duplicates.
// All helpers are tolerant: if a package is unavailable (e.g. Expo Go) or
// the user denies, they return a falsy result without throwing.

import { Platform } from 'react-native';

async function safeImport(name) {
  try { return await import(name); } catch (_) { return null; }
}

async function requestExpoPermission(moduleName, method) {
  const mod = await safeImport(moduleName);
  if (!mod || typeof mod[method] !== 'function') {
    return { granted: false, unavailable: true };
  }
  try {
    const res = await mod[method]();
    return { ...(res || {}), granted: !!(res && (res.granted || res.status === 'granted')) };
  } catch (error) {
    return { granted: false, error };
  }
}

export function requestMicrophonePermission() {
  // Delegated to expo-speech-recognition through VoiceInput; kept for legacy
  // callers on RN Android that want a raw PermissionsAndroid prompt.
  if (Platform.OS !== 'android') return Promise.resolve(true);
  return import('react-native').then(async ({ PermissionsAndroid }) => {
    try {
      const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
        title: 'Permesso microfono',
        message: 'Echo richiede accesso al microfono per ascoltare i comandi vocali',
        buttonPositive: 'OK',
      });
      return g === PermissionsAndroid.RESULTS.GRANTED;
    } catch { return false; }
  });
}

export const requestContactsPermission = () =>
  requestExpoPermission('expo-contacts', 'requestPermissionsAsync');

export const requestCalendarPermission = () =>
  requestExpoPermission('expo-calendar', 'requestCalendarPermissionsAsync');

export const requestNotificationsPermission = () =>
  requestExpoPermission('expo-notifications', 'requestPermissionsAsync');

export const requestMediaLibraryPermission = () =>
  requestExpoPermission('expo-media-library', 'requestPermissionsAsync');
