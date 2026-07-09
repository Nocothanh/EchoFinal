/**
 * MapsService.js - Servizio Mappe e Navigazione
 * Google Maps, Apple Maps, Waze - gratuito
 */

import { Platform, Linking, Alert } from 'react-native';
import * as Location from 'expo-location';
import { logger } from '../utils/Logger';

// URL schemes per diverse app di mappatura
const MAP_SCHEMES = {
  google: {
    ios: 'comgooglemaps://',
    android: 'google.navigation:',
    web: 'https://www.google.com/maps'
  },
  apple: {
    ios: 'maps://',
    android: null,
    web: 'https://maps.apple.com'
  },
  waze: {
    ios: 'waze://',
    android: 'waze://',
    web: 'https://www.waze.com'
  }
};

class MapsServiceClass {
  constructor() {
    this.isInitialized = false;
    this.defaultMapApp = 'google';
    this.location = null;
  }

  /**
   * Inizializza il servizio
   */
  async init() {
    try {
      // Ottieni posizione corrente
      await this._getLocation();

      this.isInitialized = true;
      logger.info('MapsService', 'Initialized', {
        location: this.location
      });

      return true;
    } catch (error) {
      logger.error('MapsService', 'Failed to initialize', error);
      return false;
    }
  }

  /**
   * Ottieni posizione corrente
   */
  async _getLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        logger.warn('MapsService', 'Location permission not granted');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      this.location = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };

      return this.location;
    } catch (error) {
      logger.error('MapsService', 'Failed to get location', error);
      return null;
    }
  }

  /**
   * Naviga a un indirizzo
   */
  async navigateTo(destination, options = {}) {
    const mapApp = options.mapApp || this.defaultMapApp;
    const travelMode = options.travelMode || 'driving'; // driving, walking, bicycling, transit

    try {
      // Costruisci URL per l'app specifica
      const url = this._buildNavigationUrl(destination, mapApp, travelMode);
      
      if (!url) {
        return { success: false, error: `App ${mapApp} non supportata` };
      }

      // Verifica se l'app è installata
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
        logger.info('MapsService', 'Navigation started', {
          destination,
          mapApp,
          travelMode
        });
        return { 
          success: true, 
          action: `Navigazione verso ${destination}`,
          mapApp,
          travelMode
        };
      } else {
        // Fallback: apri Google Maps web
        const webUrl = this._buildWebNavigationUrl(destination, travelMode);
        await Linking.openURL(webUrl);
        return { 
          success: true, 
          action: `Aperta navigazione web verso ${destination}`,
          mapApp: 'web',
          travelMode
        };
      }
    } catch (error) {
      logger.error('MapsService', 'Failed to navigate', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Costruisci URL di navigazione
   */
  _buildNavigationUrl(destination, mapApp, travelMode) {
    const encoded = encodeURIComponent(destination);

    switch (mapApp) {
      case 'google':
        if (Platform.OS === 'ios') {
          return `comgooglemaps://?daddr=${encoded}&directionsmode=${travelMode}&navigate=yes`;
        } else {
          return `google.navigation:q=${encoded}&mode=${this._getGoogleTravelMode(travelMode)}`;
        }

      case 'apple':
        if (Platform.OS === 'ios') {
          return `maps://?q=${encoded}&dirflg=${this._getAppleTravelMode(travelMode)}`;
        }
        return null;

      case 'waze':
        return `waze://?q=${encoded}&navigate=yes`;

      default:
        return null;
    }
  }

  /**
   * Costruisci URL web per navigazione
   */
  _buildWebNavigationUrl(destination, travelMode) {
    const encoded = encodeURIComponent(destination);
    return `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=${travelMode}`;
  }

  /**
   * Mappa travel mode per Google Maps
   */
  _getGoogleTravelMode(mode) {
    const modes = {
      driving: 'driving',
      walking: 'walking',
      bicycling: 'bicycling',
      transit: 'transit'
    };
    return modes[mode] || 'driving';
  }

  /**
   * Mappa travel mode per Apple Maps
   */
  _getAppleTravelMode(mode) {
    const modes = {
      driving: 'd',
      walking: 'w',
      bicycling: 'b',
      transit: 'r'
    };
    return modes[mode] || 'd';
  }

  /**
   * Cerca luoghi vicini
   */
  async searchNearby(query, options = {}) {
    const radius = options.radius || 5000; // 5km
    const limit = options.limit || 5;

    try {
      // Ottieni posizione corrente
      if (!this.location) {
        await this._getLocation();
      }

      if (!this.location) {
        return { success: false, error: 'Posizione non disponibile' };
      }

      // Usa Google Maps Places API (gratuita con limiti)
      // Nota: richiede API key per uso production
      // Per ora, apriamo la ricerca in Google Maps
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${this.location.latitude},${this.location.longitude},15z`;
      
      await Linking.openURL(searchUrl);
      
      return {
        success: true,
        action: `Ricerca "${query}" in corso`,
        url: searchUrl
      };
    } catch (error) {
      logger.error('MapsService', 'Failed to search nearby', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Trova ristoranti vicini
   */
  async findRestaurants(options = {}) {
    return this.searchNearby('ristoranti', options);
  }

  /**
   * Trova distributori di benzina vicini
   */
  async findGasStations(options = {}) {
    return this.searchNearby('distributori benzina', options);
  }

  /**
   * Trova parcheggi vicini
   */
  async findParking(options = {}) {
    return this.searchNearby('parcheggi', options);
  }

  /**
   * Trova farmacie vicine
   */
  async findPharmacies(options = {}) {
    return this.searchNearby('farmacie', options);
  }

  /**
   * Trova supermercati vicini
   */
  async findSupermarkets(options = {}) {
    return this.searchNearby('supermercati', options);
  }

  /**
   * Mostra posizione su mappa
   */
  async showOnMap(location, options = {}) {
    const { latitude, longitude, title } = location;
    const mapApp = options.mapApp || this.defaultMapApp;

    try {
      let url;

      switch (mapApp) {
        case 'google':
          url = Platform.OS === 'ios'
            ? `comgooglemaps://?q=${latitude},${longitude}&center=${latitude},${longitude}`
            : `geo:${latitude},${longitude}?q=${latitude},${longitude}`;
          break;

        case 'apple':
          url = `maps://${latitude},${longitude}?q=${title || 'Posizione'}`;
          break;

        case 'waze':
          url = `waze://?ll=${latitude},${longitude}&navigate=yes`;
          break;

        default:
          url = `https://www.google.com/maps/@${latitude},${longitude},15z`;
      }

      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback web
        await Linking.openURL(`https://www.google.com/maps/@${latitude},${longitude},15z`);
      }

      return { success: true, action: 'Posizione mostrata sulla mappa' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Calcola distanza tra due punti
   */
  calculateDistance(point1, point2) {
    const R = 6371; // Raggio Terra in km
    const dLat = this._toRad(point2.latitude - point1.latitude);
    const dLon = this._toRad(point2.longitude - point1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this._toRad(point1.latitude)) * Math.cos(this._toRad(point2.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return {
      km: Math.round(distance * 100) / 100,
      meters: Math.round(distance * 1000),
      miles: Math.round(distance * 0.621371 * 100) / 100
    };
  }

  _toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Genera indirizzo formattato
   */
  async reverseGeocode(latitude, longitude) {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      
      if (results && results.length > 0) {
        const result = results[0];
        const address = [
          result.name,
          result.street,
          result.city,
          result.region,
          result.postalCode,
          result.country
        ].filter(Boolean).join(', ');

        return { success: true, address, details: result };
      }

      return { success: false, error: 'Indirizzo non trovato' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Genera briefing navigazione
   */
  generateNavigationBriefing(destination, travelMode = 'driving') {
    const modeText = {
      driving: 'in macchina',
      walking: 'a piedi',
      bicycling: 'in bicicletta',
      transit: 'con i mezzi pubblici'
    };

    return `🧭 Navigazione ${modeText[travelMode] || 'in macchina'} verso ${destination}`;
  }

  /**
   * Imposta app di mappatura predefinita
   */
  setDefaultMapApp(app) {
    if (MAP_SCHEMES[app]) {
      this.defaultMapApp = app;
      logger.info('MapsService', `Default map app set to ${app}`);
      return true;
    }
    return false;
  }

  /**
   * Ottieni app di mappatura disponibili
   */
  async getAvailableMapApps() {
    const apps = [];
    
    for (const [name, schemes] of Object.entries(MAP_SCHEMES)) {
      const scheme = schemes[Platform.OS] || schemes.web;
      if (scheme) {
        try {
          const canOpen = await Linking.canOpenURL(scheme);
          apps.push({ name, available: canOpen, scheme });
        } catch (e) {
          apps.push({ name, available: false, scheme });
        }
      }
    }

    return apps;
  }

  /**
   * Ottieni stato
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      location: this.location,
      defaultMapApp: this.defaultMapApp
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.location = null;
    logger.info('MapsService', 'Cleanup completed');
  }
}

export const mapsService = new MapsServiceClass();
export default MapsServiceClass;
