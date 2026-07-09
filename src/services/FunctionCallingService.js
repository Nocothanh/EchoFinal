/**
 * FunctionCallingService.js - Function Calling per LLM
 * Permette al LLM di scegliere quali azioni eseguire
 */

import { logger } from '../utils/Logger';

// Definizioni delle funzioni disponibili
const AVAILABLE_FUNCTIONS = {
  // Meteo
  get_weather: {
    description: 'Ottieni informazioni meteo per una città o posizione',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'Nome della città (opzionale, usa posizione corrente se non fornito)'
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: 'Unità di temperatura'
        }
      }
    }
  },

  // Navigazione
  navigate_to: {
    description: 'Avvia navigazione verso una destinazione',
    parameters: {
      type: 'object',
      properties: {
        destination: {
          type: 'string',
          description: 'Destinazione (indirizzo o nome luogo)'
        },
        travel_mode: {
          type: 'string',
          enum: ['driving', 'walking', 'bicycling', 'transit'],
          description: 'Modalità di viaggio'
        }
      },
      required: ['destination']
    }
  },

  // Cerca luoghi
  search_nearby: {
    description: 'Cerca luoghi vicini (ristoranti, parcheggi, ecc.)',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Tipo di luogo da cercare'
        },
        radius: {
          type: 'number',
          description: 'Raggio di ricerca in metri'
        }
      },
      required: ['query']
    }
  },

  // Email
  get_emails: {
    description: 'Ottieni email recenti',
    parameters: {
      type: 'object',
      properties: {
        max_results: {
          type: 'number',
          description: 'Numero massimo di email da recuperare'
        },
        unread_only: {
          type: 'boolean',
          description: 'Solo email non lette'
        }
      }
    }
  },

  send_email: {
    description: 'Invia un\'email',
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Indirizzo email destinatario'
        },
        subject: {
          type: 'string',
          description: 'Oggetto dell\'email'
        },
        body: {
          type: 'string',
          description: 'Corpo del messaggio'
        }
      },
      required: ['to', 'subject', 'body']
    }
  },

  // Dispositivo
  control_device: {
    description: 'Controlla impostazioni dispositivo',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['brightness_up', 'brightness_down', 'vibrate', 'wifi', 'bluetooth', 'settings'],
          description: 'Azione da eseguire'
        },
        value: {
          type: 'number',
          description: 'Valore opzionale (es. livello luminosità)'
        }
      },
      required: ['action']
    }
  },

  // Calendario
  get_calendar_events: {
    description: 'Ottieni eventi calendario',
    parameters: {
      type: 'object',
      properties: {
        days_ahead: {
          type: 'number',
          description: 'Giorni da oggi da includere'
        }
      }
    }
  },

  // Contatti
  find_contact: {
    description: 'Cerca un contatto in rubrica',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Nome del contatto'
        }
      },
      required: ['name']
    }
  },

  // Chiamata
  make_call: {
    description: 'Chiama un numero di telefono',
    parameters: {
      type: 'object',
      properties: {
        phone_number: {
          type: 'string',
          description: 'Numero di telefono'
        },
        contact_name: {
          type: 'string',
          description: 'Nome del contatto (opzionale)'
        }
      },
      required: ['phone_number']
    }
  },

  // Timer
  set_timer: {
    description: 'Imposta un timer',
    parameters: {
      type: 'object',
      properties: {
        duration_minutes: {
          type: 'number',
          description: 'Durata in minuti'
        },
        label: {
          type: 'string',
          description: 'Etichetta del timer'
        }
      },
      required: ['duration_minutes']
    }
  },

  // Ricerca web
  web_search: {
    description: 'Cerca su internet',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Termine di ricerca'
        }
      },
      required: ['query']
    }
  },

  // App
  open_app: {
    description: 'Apri un\'applicazione',
    parameters: {
      type: 'object',
      properties: {
        app_name: {
          type: 'string',
          description: 'Nome dell\'app da aprire'
        }
      },
      required: ['app_name']
    }
  }
};

class FunctionCallingServiceClass {
  constructor() {
    this.isInitialized = false;
    this.functions = { ...AVAILABLE_FUNCTIONS };
    this.executionHistory = [];
  }

  /**
   * Inizializza il servizio
   */
  async init() {
    this.isInitialized = true;
    logger.info('FunctionCallingService', 'Initialized', {
      functionCount: Object.keys(this.functions).length
    });
    return true;
  }

  /**
   * Ottieni definizioni funzioni per il LLM
   */
  getFunctionDefinitions() {
    return Object.entries(this.functions).map(([name, def]) => ({
      name,
      description: def.description,
      parameters: def.parameters
    }));
  }

  /**
   * Ottieni formato OpenAI per function calling
   */
  getOpenAIFunctions() {
    return Object.entries(this.functions).map(([name, def]) => ({
      type: 'function',
      function: {
        name,
        description: def.description,
        parameters: def.parameters
      }
    }));
  }

  /**
   * Esegui funzione richiesta dal LLM
   */
  async executeFunction(functionName, args, services) {
    const startTime = Date.now();
    
    logger.info('FunctionCallingService', `Executing function: ${functionName}`, args);

    try {
      let result;

      switch (functionName) {
        case 'get_weather':
          result = await this._executeGetWeather(args, services);
          break;
        case 'navigate_to':
          result = await this._executeNavigateTo(args, services);
          break;
        case 'search_nearby':
          result = await this._executeSearchNearby(args, services);
          break;
        case 'get_emails':
          result = await this._executeGetEmails(args, services);
          break;
        case 'send_email':
          result = await this._executeSendEmail(args, services);
          break;
        case 'control_device':
          result = await this._executeControlDevice(args, services);
          break;
        case 'get_calendar_events':
          result = await this._executeGetCalendarEvents(args, services);
          break;
        case 'find_contact':
          result = await this._executeFindContact(args, services);
          break;
        case 'make_call':
          result = await this._executeMakeCall(args, services);
          break;
        case 'set_timer':
          result = await this._executeSetTimer(args, services);
          break;
        case 'web_search':
          result = await this._executeWebSearch(args, services);
          break;
        case 'open_app':
          result = await this._executeOpenApp(args, services);
          break;
        default:
          result = { success: false, error: `Funzione sconosciuta: ${functionName}` };
      }

      // Cronologia esecuzioni
      this.executionHistory.push({
        functionName,
        args,
        result,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      });

      // Mantieni solo ultime 100 esecuzioni
      if (this.executionHistory.length > 100) {
        this.executionHistory.shift();
      }

      logger.info('FunctionCallingService', `Function executed: ${functionName}`, {
        success: result.success,
        duration: Date.now() - startTime
      });

      return result;
    } catch (error) {
      logger.error('FunctionCallingService', `Function failed: ${functionName}`, error);
      return { success: false, error: error.message };
    }
  }

  // === Esecutori funzioni ===

  async _executeGetWeather(args, services) {
    const { weatherService } = services;
    if (!weatherService) {
      return { success: false, error: 'Weather service non disponibile' };
    }

    if (args.city) {
      await weatherService.setDefaultCity(args.city);
    }

    const result = await weatherService.getCurrentWeather(args.city);
    if (result.success) {
      const briefing = weatherService.generateWeatherBriefing(result.data);
      return { success: true, data: result.data, briefing };
    }
    return result;
  }

  async _executeNavigateTo(args, services) {
    const { mapsService } = services;
    if (!mapsService) {
      return { success: false, error: 'Maps service non disponibile' };
    }

    return mapsService.navigateTo(args.destination, {
      travelMode: args.travel_mode || 'driving'
    });
  }

  async _executeSearchNearby(args, services) {
    const { mapsService } = services;
    if (!mapsService) {
      return { success: false, error: 'Maps service non disponibile' };
    }

    return mapsService.searchNearby(args.query, {
      radius: args.radius || 5000
    });
  }

  async _executeGetEmails(args, services) {
    const { emailService } = services;
    if (!emailService) {
      return { success: false, error: 'Email service non disponibile' };
    }

    if (args.unread_only) {
      const result = await emailService.getUnreadEmails(args.max_results || 10);
      if (result.success) {
        const briefing = emailService.generateEmailBriefing(result.data);
        return { success: true, data: result.data, briefing };
      }
      return result;
    }

    return emailService.getRecentEmails(args.max_results || 10);
  }

  async _executeSendEmail(args, services) {
    const { emailService } = services;
    if (!emailService) {
      return { success: false, error: 'Email service non disponibile' };
    }

    return emailService.sendEmail(args.to, args.subject, args.body);
  }

  async _executeControlDevice(args, services) {
    const { deviceControlService } = services;
    if (!deviceControlService) {
      return { success: false, error: 'Device control service non disponibile' };
    }

    return deviceControlService.controlDevice(args.action, {
      level: args.value,
      pattern: args.value || 'medium'
    });
  }

  async _executeGetCalendarEvents(args, services) {
    // Placeholder - usa CalendarService se disponibile
    return { 
      success: true, 
      data: [],
      message: 'Funzione calendario in arrivo'
    };
  }

  async _executeFindContact(args, services) {
    const { contactService } = services;
    if (!contactService) {
      return { success: false, error: 'Contact service non disponibile' };
    }

    const results = await contactService.searchContacts(args.name);
    return { success: true, data: results };
  }

  async _executeMakeCall(args, services) {
    const { quickActions } = services;
    if (!quickActions) {
      return { success: false, error: 'Quick actions non disponibile' };
    }

    return quickActions.executeCommand({
      type: 'call',
      target: args.contact_name || args.phone_number
    });
  }

  async _executeSetTimer(args, services) {
    const { quickActions } = services;
    if (!quickActions) {
      return { success: false, error: 'Quick actions non disponibile' };
    }

    return quickActions.executeCommand({
      type: 'timer',
      target: `${args.duration_minutes} min`
    });
  }

  async _executeWebSearch(args, services) {
    const { quickActions } = services;
    if (!quickActions) {
      return { success: false, error: 'Quick actions non disponibile' };
    }

    return quickActions.executeCommand({
      type: 'search',
      target: args.query
    });
  }

  async _executeOpenApp(args, services) {
    const { quickActions } = services;
    if (!quickActions) {
      return { success: false, error: 'Quick actions non disponibile' };
    }

    return quickActions.executeCommand({
      type: 'open_app',
      target: args.app_name
    });
  }

  /**
   * Processa response del LLM con function calls
   */
  async processLLMResponse(llmResponse, services) {
    // Controlla se ci sono function calls nella response
    if (!llmResponse.function_calls || llmResponse.function_calls.length === 0) {
      return {
        hasFunctionCalls: false,
        textResponse: llmResponse.content
      };
    }

    // Esegui ogni function call
    const results = [];
    for (const fc of llmResponse.function_calls) {
      const result = await this.executeFunction(fc.name, fc.arguments, services);
      results.push({
        function: fc.name,
        result
      });
    }

    return {
      hasFunctionCalls: true,
      functionResults: results,
      textResponse: this._generateFunctionResponseText(results)
    };
  }

  /**
   * Genera testo di risposta per function calls
   */
  _generateFunctionResponseText(results) {
    const texts = results.map(r => {
      if (r.result.success) {
        return r.result.briefing || r.result.message || `${r.function} eseguita con successo`;
      } else {
        return `Errore in ${r.function}: ${r.result.error}`;
      }
    });

    return texts.join('\n\n');
  }

  /**
   * Aggiungi funzione personalizzata
   */
  addFunction(name, definition) {
    this.functions[name] = definition;
    logger.info('FunctionCallingService', `Added custom function: ${name}`);
  }

  /**
   * Rimuovi funzione
   */
  removeFunction(name) {
    if (AVAILABLE_FUNCTIONS[name]) {
      logger.warn('FunctionCallingService', `Cannot remove built-in function: ${name}`);
      return false;
    }
    delete this.functions[name];
    return true;
  }

  /**
   * Ottieni cronologia esecuzioni
   */
  getExecutionHistory(limit = 10) {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Ottieni statistiche
   */
  getStats() {
    const functionCounts = {};
    this.executionHistory.forEach(h => {
      functionCounts[h.functionName] = (functionCounts[h.functionName] || 0) + 1;
    });

    return {
      totalExecutions: this.executionHistory.length,
      functionCounts,
      avgDuration: this.executionHistory.reduce((a, b) => a + b.duration, 0) / 
                   (this.executionHistory.length || 1)
    };
  }

  /**
   * Ottieni stato
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      functionCount: Object.keys(this.functions).length,
      executionCount: this.executionHistory.length
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.executionHistory = [];
    logger.info('FunctionCallingService', 'Cleanup completed');
  }
}

export const functionCallingService = new FunctionCallingServiceClass();
export { AVAILABLE_FUNCTIONS };
export default FunctionCallingServiceClass;
