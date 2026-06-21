// Minimal permission helpers for Android. Adapt for Expo or iOS as needed.
import { PermissionsAndroid, Platform } from 'react-native';

export async function requestMicrophonePermission() {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
      title: 'Permesso microfono', message: 'Echo richiede accesso al microfono per ascoltare i comandi vocale', buttonPositive: 'OK'
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (e) { return false; }
}

export async function requestLocationPermission() {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Permesso posizione', message: 'Echo richiede la posizione per suggerire luoghi e attività', buttonPositive: 'OK'
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (e) { return false; }
}

export async function requestAllBasicPermissions() {
  const mic = await requestMicrophonePermission();
  const loc = await requestLocationPermission();
  return mic && loc;
}
