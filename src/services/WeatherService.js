/**
 * WeatherService.js - Servizio Meteo con OpenWeatherMap
 * API gratuita per previsioni meteo
 */

import * as Location from 'expo-location';
import { logger } from '../utils/Logger';

// API Key gratuita OpenWeatherMap (da sostituire con la propria)
// Registrarsi su: https://openweathermap.org/api
const DEFAULT_API_KEY = ''; // L'utente deve inserire la propria chiave
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// Icone meteo mappate
const WEATHER_ICONS = {
  '01d': '☀️', '01n': '🌙', // Clear sky
  '02d': '⛅', '02n': '☁️', // Few clouds
  '03d': '☁️', '03n': '☁️', // Scattered clouds
  '04d': '☁️', '04n': '☁️', // Broken clouds
  '09d': '🌧️', '09n': '🌧️', // Shower rain
  '10d': '🌦️', '10n': '🌧️', // Rain
  '11d': '⛈️', '11n': '⛈️', // Thunderstorm
  '13d': '❄️', '13n': '❄️', // Snow
  '50d': '🌫️', '50n': '🌫️', // Mist
};

// Descrizioni meteo in italiano
const WEATHER_DESCRIPTIONS = {
  'clear sky': 'cielo sereno',
  'few clouds': 'poche nuvole',
  'scattered clouds': 'nuvole sparse',
  'broken clouds': 'nuvole rotte',
  'overcast clouds': 'cielo coperto',
  'shower rain': 'rovesci',
  'light rain': 'pioggia leggera',
  'moderate rain': 'pioggia moderata',
  'heavy rain': 'pioggia forte',
  'rain': 'pioggia',
  'thunderstorm': 'temporale',
  'snow': 'neve',
  'mist': 'nebbia',
  'fog': 'nebbia',
  'haze': 'foschia',
};

// Consigli meteo in italiano
const WEATHER_ADVICE = {
  clear: ['Ottima giornata per uscire!', 'Bel tempo, approfittane!'],
  cloudy: ['Giornata nuvolosa, porta un maglioncino.', 'Coperto, ma senza pioggia.'],
  rain: ['Porta l\'ombrello!', 'Meteo piovoso, resta al caldo.'],
  storm: ['Temporale in corso, evita di uscire.', 'Meteo instabile, attenzione!'],
  snow: ['Neve! Vestiti bene.', 'Freddo e neve, attenzione alle strade.'],
  fog: ['Nebbia, guida con attenzione.', 'Poca visibilità, fai piano.'],
  hot: ['Fa caldo, idratati bene!', 'Giornata calda, cerca l\'ombra.'],
  cold: ['Fa freddo, vestiti bene!', 'Giornata fredda, tieni al caldo.']
};

class WeatherServiceClass {
  constructor() {
    this.apiKey = DEFAULT_API_KEY;
    this.units = 'metric'; // metric, imperial
    this.language = 'it'; // Italiano
    this.lastWeather = null;
    this.lastForecast = null;
    this.location = null;
    this.cacheTimeout = 30 * 60 * 1000; // 30 minuti
    this.lastFetchTime = 0;
  }

  /**
   * Inizializza il servizio
   */
  async init(apiKey = null) {
    if (apiKey) {
      this.apiKey = apiKey;
    }

    // Ottieni posizione corrente
    await this._getLocation();

    logger.info('WeatherService', 'Initialized', {
      hasApiKey: !!this.apiKey,
      location: this.location ? `${this.location.latitude}, ${this.location.longitude}` : null
    });

    return !!this.apiKey;
  }

  /**
   * Ottieni posizione dispositivo
   */
  async _getLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        logger.warn('WeatherService', 'Location permission not granted');
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
      logger.error('WeatherService', 'Failed to get location', error);
      return null;
    }
  }

  /**
   * Ottieni meteo corrente
   */
  async getCurrentWeather(city = null) {
    if (!this.apiKey) {
      return { success: false, error: 'API key non configurata' };
    }

    // Controlla cache
    const now = Date.now();
    if (this.lastWeather && (now - this.lastFetchTime) < this.cacheTimeout) {
      return { success: true, data: this.lastWeather, cached: true };
    }

    try {
      let url;

      if (city) {
        // Cerca per città
        url = `${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${this.apiKey}&units=${this.units}&lang=${this.language}`;
      } else if (this.location) {
        // Usa posizione corrente
        url = `${BASE_URL}/weather?lat=${this.location.latitude}&lon=${this.location.longitude}&appid=${this.apiKey}&units=${this.units}&lang=${this.language}`;
      } else {
        return { success: false, error: 'Posizione non disponibile' };
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.cod !== 200) {
        return { success: false, error: data.message || 'Errore nel recupero meteo' };
      }

      // Trasforma dati
      const weather = this._transformCurrentWeather(data);
      this.lastWeather = weather;
      this.lastFetchTime = now;

      logger.info('WeatherService', 'Weather fetched', {
        city: weather.city,
        temp: weather.temperature,
        condition: weather.condition
      });

      return { success: true, data: weather };
    } catch (error) {
      logger.error('WeatherService', 'Failed to fetch weather', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Trasforma dati meteo corrente
   */
  _transformCurrentWeather(data) {
    const main = data.main || {};
    const weather = data.weather?.[0] || {};
    const wind = data.wind || {};
    const sys = data.sys || {};

    return {
      city: data.name,
      country: sys.country,
      temperature: Math.round(main.temp),
      feelsLike: Math.round(main.feels_like),
      tempMin: Math.round(main.temp_min),
      tempMax: Math.round(main.temp_max),
      humidity: main.humidity,
      pressure: main.pressure,
      visibility: data.visibility,
      windSpeed: wind.speed,
      windDeg: wind.deg,
      condition: weather.main || 'Unknown',
      description: weather.description || 'Non disponibile',
      icon: weather.icon,
      iconEmoji: WEATHER_ICONS[weather.icon] || '🌤️',
      descriptionIt: WEATHER_DESCRIPTIONS[weather.description] || weather.description,
      sunrise: sys.sunrise ? new Date(sys.sunrise * 1000).toLocaleTimeString('it-IT') : null,
      sunset: sys.sunset ? new Date(sys.sunset * 1000).toLocaleTimeString('it-IT') : null,
      timestamp: Date.now()
    };
  }

  /**
   * Ottieni previsioni 5 giorni
   */
  async getForecast(city = null) {
    if (!this.apiKey) {
      return { success: false, error: 'API key non configurata' };
    }

    try {
      let url;

      if (city) {
        url = `${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${this.apiKey}&units=${this.units}&lang=${this.language}`;
      } else if (this.location) {
        url = `${BASE_URL}/forecast?lat=${this.location.latitude}&lon=${this.location.longitude}&appid=${this.apiKey}&units=${this.units}&lang=${this.language}`;
      } else {
        return { success: false, error: 'Posizione non disponibile' };
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.cod !== '200') {
        return { success: false, error: data.message || 'Errore nel recupero previsioni' };
      }

      const forecast = this._transformForecast(data);
      this.lastForecast = forecast;

      return { success: true, data: forecast };
    } catch (error) {
      logger.error('WeatherService', 'Failed to fetch forecast', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Trasforma dati previsioni
   */
  _transformForecast(data) {
    const city = data.city;
    const forecasts = data.list || [];

    // Raggruppa per giorno
    const dailyForecasts = {};
    
    forecasts.forEach(item => {
      const date = new Date(item.dt * 1000).toLocaleDateString('it-IT');
      
      if (!dailyForecasts[date]) {
        dailyForecasts[date] = {
          date,
          temps: [],
          conditions: [],
          descriptions: [],
          icons: []
        };
      }

      dailyForecasts[date].temps.push(item.main.temp);
      dailyForecasts[date].conditions.push(item.weather[0].main);
      dailyForecasts[date].descriptions.push(item.weather[0].description);
      dailyForecasts[date].icons.push(item.weather[0].icon);
    });

    // Calcola medie per ogni giorno
    const daily = Object.values(dailyForecasts).map(day => ({
      date: day.date,
      tempMin: Math.round(Math.min(...day.temps)),
      tempMax: Math.round(Math.max(...day.temps)),
      condition: this._getMostFrequent(day.conditions),
      description: this._getMostFrequent(day.descriptions),
      icon: this._getMostFrequent(day.icons),
      iconEmoji: WEATHER_ICONS[this._getMostFrequent(day.icons)] || '🌤️',
      descriptionIt: WEATHER_DESCRIPTIONS[this._getMostFrequent(day.descriptions)] || this._getMostFrequent(day.descriptions)
    }));

    return {
      city: city.name,
      country: city.country,
      daily: daily.slice(0, 5), // Max 5 giorni
      timestamp: Date.now()
    };
  }

  /**
   * Ottieni elemento più frequente
   */
  _getMostFrequent(arr) {
    const counts = {};
    arr.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || arr[0];
  }

  /**
   * Genera briefing meteo in italiano
   */
  generateWeatherBriefing(weather) {
    if (!weather) return 'Meteo non disponibile';

    const temp = weather.temperature;
    const condition = weather.condition?.toLowerCase() || '';
    const humidity = weather.humidity;
    const wind = weather.windSpeed;

    let briefing = `A ${weather.city}, `;

    // Temperatura
    if (temp < 0) {
      briefing += `fa freddo con ${temp} gradi. `;
      briefing += this._getRandomAdvice('cold');
    } else if (temp < 10) {
      briefing += `sono ${temp} gradi, un po' freddo. `;
      briefing += this._getRandomAdvice('cold');
    } else if (temp < 20) {
      briefing += `sono ${temp} gradi, gradevole. `;
    } else if (temp < 30) {
      briefing += `ci sono ${temp} gradi, caldo moderato. `;
    } else {
      briefing += `ci sono ${temp} gradi, molto caldo! `;
      briefing += this._getRandomAdvice('hot');
    }

    // Condizioni
    if (condition.includes('rain') || condition.includes('drizzle')) {
      briefing += ` C'è ${weather.descriptionIt}. `;
      briefing += this._getRandomAdvice('rain');
    } else if (condition.includes('thunderstorm')) {
      briefing += ` C'è un temporale! `;
      briefing += this._getRandomAdvice('storm');
    } else if (condition.includes('snow')) {
      briefing += ` Sta nevicando! `;
      briefing += this._getRandomAdvice('snow');
    } else if (condition.includes('mist') || condition.includes('fog')) {
      briefing += ` C'è nebbia. `;
      briefing += this._getRandomAdvice('fog');
    } else if (condition.includes('cloud')) {
      briefing += ` C'è ${weather.descriptionIt}. `;
      briefing += this._getRandomAdvice('cloudy');
    } else if (condition.includes('clear')) {
      briefing += ` C'è ${weather.descriptionIt}. `;
      briefing += this._getRandomAdvice('clear');
    }

    // Umidità e vento
    if (humidity > 80) {
      briefing += ` L'umidità è alta (${humidity}%).`;
    }
    if (wind > 20) {
      briefing += ` C'è vento (${wind} km/h).`;
    }

    return briefing.trim();
  }

  /**
   * Ottieni consiglio casuale
   */
  _getRandomAdvice(type) {
    const advice = WEATHER_ADVICE[type];
    if (!advice || advice.length === 0) return '';
    return advice[Math.floor(Math.random() * advice.length)];
  }

  /**
   * Genera briefing giornaliero completo
   */
  generateDailyBriefing(weather, forecast = null) {
    let briefing = '☀️ Buongiorno! Ecco il briefing della giornata:\n\n';

    // Meteo oggi
    briefing += `📊 METEO OGGI:\n`;
    briefing += this.generateWeatherBriefing(weather);
    briefing += '\n\n';

    // Prossimi giorni
    if (forecast && forecast.daily && forecast.daily.length > 0) {
      briefing += `📅 PROSSIMI GIORNI:\n`;
      forecast.daily.slice(0, 3).forEach(day => {
        briefing += `• ${day.date}: ${day.tempMin}° - ${day.tempMax}° ${day.iconEmoji} ${day.descriptionIt}\n`;
      });
    }

    return briefing;
  }

  /**
   * Controlla se piove oggi
   */
  isRaining(weather) {
    if (!weather) return false;
    const condition = weather.condition?.toLowerCase() || '';
    return condition.includes('rain') || condition.includes('drizzle') || condition.includes('shower');
  }

  /**
   * Controlla se fa caldo
   */
  isHot(weather, threshold = 30) {
    if (!weather) return false;
    return weather.temperature >= threshold;
  }

  /**
   * Controlla se fa freddo
   */
  isCold(weather, threshold = 5) {
    if (!weather) return false;
    return weather.temperature <= threshold;
  }

  /**
   * Ottieni suggerimento abbigliamento
   */
  getClothingSuggestion(weather) {
    if (!weather) return null;

    const temp = weather.temperature;
    const condition = weather.condition?.toLowerCase() || '';

    if (condition.includes('rain')) {
      return '🧥 Porta un giubbotto impermeabile e un ombrello!';
    } else if (condition.includes('snow')) {
      return '🧣 Vestiti bene: cappotto, sciarpa e guanti!';
    } else if (temp < 5) {
      return '🧥 Fa freddo: cappotto, sciarpa e cappello!';
    } else if (temp < 15) {
      return '🧥 Metti un maglione o un giubbotto leggero.';
    } else if (temp < 25) {
      return '👕 Abbigliamento leggero, va bene così.';
    } else {
      return '👕 Fa caldo: vestiti leggeri e cerca l\'ombra!';
    }
  }

  /**
   * Imposta API key
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
    logger.info('WeatherService', 'API key updated');
  }

  /**
   * Imposta città predefinita
   */
  async setDefaultCity(city) {
    const result = await this.getCurrentWeather(city);
    if (result.success) {
      logger.info('WeatherService', `Default city set to ${city}`);
      return true;
    }
    return false;
  }

  /**
   * Ottieni stato
   */
  getState() {
    return {
      hasApiKey: !!this.apiKey,
      location: this.location,
      lastWeather: this.lastWeather,
      lastForecast: this.lastForecast,
      cacheTimeout: this.cacheTimeout,
      lastFetchTime: this.lastFetchTime
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.lastWeather = null;
    this.lastForecast = null;
    this.location = null;
    logger.info('WeatherService', 'Cleanup completed');
  }
}

export const weatherService = new WeatherServiceClass();
export default WeatherServiceClass;
