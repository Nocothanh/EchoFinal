/**
 * ContextEngine.js - Motore di Contesto JARVIS
 * Analizza ora, data, posizione, abitudini per risposte contestuali
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/Logger';

const STORAGE_KEY = 'echo_context_data';

// Giorni della settimana in italiano
const GIORNI_IT = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const GIORNI_IT_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

// Mesi in italiano
const MESI_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
                 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

// Saluti per fascia oraria
const SALUTI = {
  notte: ['Buonanotte', 'Notte', 'Dormi bene'],
  mattina: ['Buongiorno', 'Mattina', 'Sveglia!'],
  pomeriggio: ['Buon pomeriggio', 'Pomeriggio', 'Dopo pranzo'],
  sera: ['Buonasera', 'Sera', 'Come va la serata?'],
  tardi: ['Ancora sveglio?', 'È tardi', 'Non dormi?']
};

// Frasi contestuali per situazioni
const FRASI_CONTESTO = {
  lunedi: [
    "Buongiorno! Nuova settimana, nuovi obiettivi.",
    "Lunedì! Forza e coraggio!",
    "Inizio settimana! Cosa hai in programma?"
  ],
  venerdi: [
    "Venerdì! Quasi weekend!",
    "Ultimo giorno di lavoro, ce la fai!",
    "Weekend in vista! Cosa hai in programma?"
  ],
  sabato: [
    "Sabato! Giorno di relax?",
    "Weekend! Goditi la giornata.",
    "Sabato pomeriggio, che progetti hai?"
  ],
  domenica: [
    "Domenica! Riposo e ricarica.",
    "Ultimo giorno di relax prima del lunedì.",
    "Domenica! Hai qualcosa di piano?"
  ],
  meeting: [
    "Hai un meeting tra poco, vuoi che ti prepari?",
    "Meeting in arrivo! Vuoi che ti ricordi?",
    "Tra poco hai un impegno, preparati!"
  ],
  pausa: [
    "Sei stato attivo per un po', fai una pausa!",
    "Ore di lavoro: hai bisogno di una pausa?",
    "Un caffè? Hai lavorato abbastanza!"
  ]
};

class ContextEngineService {
  constructor() {
    this.context = {
      time: null,
      date: null,
      dayOfWeek: null,
      isWeekend: false,
      timeOfDay: null,
      greeting: null,
      userActivity: 'unknown',
      lastInteraction: null,
      interactionCount: 0,
      sessionStart: null,
      habits: {},
      preferences: {}
    };
    this.listeners = [];
    this.updateInterval = null;
  }

  /**
   * Inizializza il motore di contesto
   */
  async init() {
    try {
      await this.loadSavedContext();
      this.updateTimeContext();
      this.startPeriodicUpdate();
      
      logger.info('ContextEngine', 'Initialized successfully', {
        timeOfDay: this.context.timeOfDay,
        dayOfWeek: this.context.dayOfWeek
      });
      
      return true;
    } catch (error) {
      logger.error('ContextEngine', 'Failed to initialize', error);
      return false;
    }
  }

  /**
   * Carica contesto salvato
   */
  async loadSavedContext() {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        this.context.habits = data.habits || {};
        this.context.preferences = data.preferences || {};
        this.context.interactionCount = data.interactionCount || 0;
        this.context.lastInteraction = data.lastInteraction ? new Date(data.lastInteraction) : null;
      }
    } catch (error) {
      logger.warn('ContextEngine', 'Failed to load saved context', error);
    }
  }

  /**
   * Salva contesto
   */
  async saveContext() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        habits: this.context.habits,
        preferences: this.context.preferences,
        interactionCount: this.context.interactionCount,
        lastInteraction: this.context.lastInteraction?.toISOString()
      }));
    } catch (error) {
      logger.warn('ContextEngine', 'Failed to save context', error);
    }
  }

  /**
   * Aggiorna contesto temporale
   */
  updateTimeContext() {
    const now = new Date();
    this.context.time = now;
    this.context.date = now;
    this.context.dayOfWeek = GIORNI_IT[now.getDay()];
    this.context.isWeekend = now.getDay() === 0 || now.getDay() === 6;
    
    // Fascia oraria
    const hour = now.getHours();
    if (hour >= 0 && hour < 6) {
      this.context.timeOfDay = 'notte';
    } else if (hour >= 6 && hour < 12) {
      this.context.timeOfDay = 'mattina';
    } else if (hour >= 12 && hour < 18) {
      this.context.timeOfDay = 'pomeriggio';
    } else if (hour >= 18 && hour < 22) {
      this.context.timeOfDay = 'sera';
    } else {
      this.context.timeOfDay = 'tardi';
    }

    // Saluto appropriato
    const saluti = SALUTI[this.context.timeOfDay];
    this.context.greeting = saluti[Math.floor(Math.random() * saluti.length)];
  }

  /**
   * Aggiornamento periodico
   */
  startPeriodicUpdate() {
    this.updateInterval = setInterval(() => {
      this.updateTimeContext();
      this.notifyListeners();
    }, 60000); // Ogni minuto
  }

  /**
   * Ferma aggiornamento periodico
   */
  stopPeriodicUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  /**
   * Registra interazione utente
   */
  async recordInteraction() {
    this.context.interactionCount++;
    this.context.lastInteraction = new Date();
    
    // Aggiorna abitudini
    const hour = new Date().getHours();
    const day = new Date().getDay();
    const habitKey = `${day}_${hour}`;
    this.context.habits[habitKey] = (this.context.habits[habitKey] || 0) + 1;
    
    await this.saveContext();
    this.notifyListeners();
  }

  /**
   * Ottieni saluto contestuale
   */
  getGreeting(userName = 'utente') {
    const now = new Date();
    const hour = now.getHours();
    
    // Saluto base
    let saluto = this.context.greeting;
    
    // Aggiungi nome se disponibile
    if (userName && userName !== 'utente') {
      saluto = `${saluto}, ${userName}`;
    }
    
    // Aggiungi dettagli contestuali
    const giorno = GIORNI_IT[now.getDay()];
    if (hour >= 6 && hour < 12) {
      saluto += `, è ${giorno} mattina`;
    } else if (hour >= 12 && hour < 18) {
      saluto += `, buon pomeriggio di ${giorno}`;
    } else if (hour >= 18 && hour < 22) {
      saluto += `, come va la serata di ${giorno}?`;
    }
    
    return saluto;
  }

  /**
   * Ottieni frase contestuale per situazione
   */
  getContextualPhrase(situation = null) {
    const now = new Date();
    const day = GIORNI_IT[now.getDay()].toLowerCase();
    
    // Sezione situazione specifica
    if (situation && FRASI_CONTESTO[situation]) {
      const phrases = FRASI_CONTESTO[situation];
      return phrases[Math.floor(Math.random() * phrases.length)];
    }
    
    // Fallback: frase basata sul giorno
    if (FRASI_CONTESTO[day]) {
      const phrases = FRASI_CONTESTO[day];
      return phrases[Math.floor(Math.random() * phrases.length)];
    }
    
    return null;
  }

  /**
   * Analizza patterns di utilizzo
   */
  analyzeHabits() {
    const habits = this.context.habits;
    const totalInteractions = Object.values(habits).reduce((a, b) => a + b, 0);
    
    if (totalInteractions < 5) {
      return { level: 'new', message: 'Nuovo utente, sto imparando le tue abitudini!' };
    }

    // Trova ora più active
    let maxHour = 0;
    let maxCount = 0;
    for (const [key, count] of Object.entries(habits)) {
      if (count > maxCount) {
        maxCount = count;
        maxHour = parseInt(key.split('_')[1]);
      }
    }

    const hourRange = maxHour >= 6 && maxHour < 12 ? 'mattina' : 
                      maxHour >= 12 && maxHour < 18 ? 'pomeriggio' : 'sera';

    return {
      level: 'established',
      peakHour: maxHour,
      peakPeriod: hourRange,
      totalInteractions,
      message: `Sei più attivo la ${hourRange}, ho notato!`
    };
  }

  /**
   * Suggerimento proattivo basato su contesto
   */
  getProactiveSuggestion() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const habits = this.analyzeHabits();

    // Mattina: suggerimento giornaliero
    if (hour >= 6 && hour < 12) {
      if (day === 1) { // Lunedì
        return "Buon lunedì! Vuoi che ti elenchi gli obiettivi per la settimana?";
      }
      if (hour >= 7 && hour <= 8) {
        return "Ora è un buon momento per pianificare la giornata. Vuoi che ti aiuti?";
      }
    }

    // Pomeriggio: pausa
    if (hour >= 14 && hour <= 16) {
      return "Hai lavorato un po', fai una pausa! Vuoi che ti metta un promemoria?";
    }

    // Sera: riepilogo
    if (hour >= 18 && hour <= 20) {
      return "Giornata finita! Vuoi che ti faccia un riepilogo?";
    }

    // Notte: riposo
    if (hour >= 22 || hour < 6) {
      return "È tardi! Vuoi che ti metta la sveglia per domani?";
    }

    return null;
  }

  /**
   * Controlla se è un buon momento per notificare
   */
  shouldNotify() {
    const now = new Date();
    const hour = now.getHours();
    
    // Non notificare di notte
    if (hour >= 22 || hour < 7) {
      return { should: false, reason: 'Ora non appropriata per notifiche' };
    }
    
    // Controlla ultima interazione
    if (this.context.lastInteraction) {
      const timeSinceLastInteraction = now - this.context.lastInteraction;
      const minutesSinceLast = timeSinceLastInteraction / (1000 * 60);
      
      // Non notificare se è stato interattivo di recente
      if (minutesSinceLast < 30) {
        return { should: false, reason: 'Utente è stato attivo di recente' };
      }
    }
    
    return { should: true, reason: 'Buon momento per notificare' };
  }

  /**
   * Aggiorna preferenza utente
   */
  async updatePreference(key, value) {
    this.context.preferences[key] = value;
    await this.saveContext();
    this.notifyListeners();
  }

  /**
   * Ottieni tutte le informazioni di contesto
   */
  getFullContext() {
    const now = new Date();
    return {
      ...this.context,
      formattedDate: `${now.getDate()} ${MESI_IT[now.getMonth()]} ${now.getFullYear()}`,
      formattedTime: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
      dayOfWeekShort: GIORNI_IT_SHORT[now.getDay()],
      month: MESI_IT[now.getMonth()],
      year: now.getFullYear(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      habitsAnalysis: this.analyzeHabits()
    };
  }

  /**
   * Genera system prompt con contesto
   */
  generateContextPrompt() {
    const ctx = this.getFullContext();
    const suggestion = this.getProactiveSuggestion();
    
    let prompt = `\n\n[CONTESTO ATTUALE]\n`;
    prompt += `Data: ${ctx.formattedDate}\n`;
    prompt += `Ora: ${ctx.formattedTime}\n`;
    prompt += `Giorno: ${ctx.dayOfWeek}\n`;
    prompt += `Periodo: ${ctx.timeOfDay}\n`;
    prompt += `Weekend: ${ctx.isWeekend ? 'Sì' : 'No'}\n`;
    
    if (suggestion) {
      prompt += `Suggerimento proattivo: ${suggestion}\n`;
    }
    
    if (ctx.habitsAnalysis.level === 'established') {
      prompt += `Pattern utente: ${ctx.habitsAnalysis.message}\n`;
    }
    
    prompt += `[/CONTESTO]\n`;
    
    return prompt;
  }

  /**
   * Listener per cambiamenti
   */
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(cb => {
      try { cb(this.context); } catch (e) {}
    });
  }

  /**
   * Pulisci risorse
   */
  cleanup() {
    this.stopPeriodicUpdate();
    this.listeners = [];
  }
}

export const contextEngine = new ContextEngineService();
export default ContextEngineService;
