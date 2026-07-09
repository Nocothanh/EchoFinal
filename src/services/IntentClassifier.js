/**
 * IntentClassifier.js - On-device intent classification
 * Uses keyword matching + heuristics for instant command recognition
 * Falls back to LLM only for complex/ambiguous requests
 */

import { logger } from '../utils/Logger';

const INTENT_CATEGORIES = {
  DEVICE_CONTROL: {
    patterns: [
      /(?:turn|put|set|toggle|switch|disable|enable|activate|deactivate)\s+(?:on|off|up|down)?\s*(wifi|bluetooth|airplane|flashlight|torch|dnd|do.not.disturb|rotation|hotspot|nfc|location|gps)/i,
      /(?:alza|abbassa|accendi|spegni|attiva|disattiva|imposta)\s+(volume|luminosita|schermo|torcia|wifi|bluetooth|rotazione|modalita.aereo|nfc|posizione)/i,
      /(?:volume|brightness|luminosita)\s+(up|down|high|low|max|min|full|\d+)/i,
      /(?:screenshot|cattura.schermo|schermata)/i,
      /(?:lock|blocca|sblocca)\s*(screen|schermo)?/i
    ],
    confidence: 0.95
  },
  APP_LAUNCH: {
    patterns: [
      /(?:open|launch|start|run|apri|lancia|avvia|esegui)\s+(.+)/i,
      /(?:go.to|vai.a|vai.in)\s+(.+)/i
    ],
    confidence: 0.9
  },
  CALL: {
    patterns: [
      /(?:call|phone|chiama|telefona|chiamata)\s+(.+)/i,
      /(?:打电话|phonenumber)\s*(.+)/i
    ],
    confidence: 0.95
  },
  SMS: {
    patterns: [
      /(?:send|send.text|sms|message|text|manda|messaggio|scrivi.a|invia)\s+(.+)/i,
      /(?:whatsapp|telegram|signal)\s+(.+)/i
    ],
    confidence: 0.9
  },
  NAVIGATION: {
    patterns: [
      /(?:navigate|directions|drive|go.to|portami|naviga|vai.a|vai.in|wiez|min)\s+(.+)/i,
      /(?:dove.si|come.si.va|come.arrivo)\s+(?:a|in|al|alla|ai|alle)\s+(.+)/i
    ],
    confidence: 0.85
  },
  WEATHER: {
    patterns: [
      /(?:weather|tempo|meteo|temperature|forecast|che.tempo|com.e.il.tempo|quanto.caldo|quanto.freddo)/i,
      /(?:will.it.rain|piovera|piove|nevica)/i
    ],
    confidence: 0.9
  },
  CALENDAR: {
    patterns: [
      /(?:calendar|calendario|event|impegno|meeting|appointment|riunione)/i,
      /(?:what.do.i.have|che.impegni|cosa.devo.fare|ci.ho.qualcosa)/i
    ],
    confidence: 0.85
  },
  REMINDER: {
    patterns: [
      /(?:remind|ricordami|metti.un.promemoria|non.dimenticare)/i,
      /(?:in|tra|fra)\s+(\d+)\s*(min(?:uto|uti)?|ora|ore|h)/i
    ],
    confidence: 0.9
  },
  MUSIC: {
    patterns: [
      /(?:play|put.on|metti.su|ascolta|riproduci)\s+(.+)/i,
      /(?:music|musica|song|canzone|brano)\s*(.*)/i,
      /(?:pause|ferma|stop|skip|next|previous|avanti|indietro)/i
    ],
    confidence: 0.85
  },
  SEARCH: {
    patterns: [
      /(?:search|google|look.up|cerca|trova|chi.e|cos.e|come.si|quando.e|perche|quanto)/i,
      /(?:who|what|where|when|why|how|chi|cosa|dove|quando|perche|quanto|come)/i
    ],
    confidence: 0.7
  },
  EMAIL: {
    patterns: [
      /(?:email|mail|posta|inbox|casella)/i,
      /(?:send.email|invia.email|scrivi.email)/i
    ],
    confidence: 0.85
  },
  TIMER: {
    patterns: [
      /(?:timer|countdown|cronometro|stopwatch)/i,
      /(?:timer|countdown|imposta.timer)\s+(.+)/i
    ],
    confidence: 0.9
  },
  ALARM: {
    patterns: [
      /(?:alarm|sveglia|svegliami)/i,
      /(?:set.alarm|imposta.sveglia|svegliami.a.alle)\s+(.+)/i
    ],
    confidence: 0.9
  },
  WELLNESS: {
    patterns: [
      /(?:breathe|breathing|respira|respirazione|medita|meditazione|relax|rilassamento)/i,
      /(?:calmati|calma|zen|yoga|stretching)/i,
      /(?:ambient|suono|musica.rilassante|rain|ocean|pioggia|oceano)/i
    ],
    confidence: 0.85
  },
  NOTIFICATIONS: {
    patterns: [
      /(?:notifications?|notifiche|avvisi|messaggi.letti|what.did.i.miss)/i,
      /(?:riepilogo|digest|riepilogo.notifiche)/i
    ],
    confidence: 0.9
  }
};

const DIRECT_COMMANDS = {
  'flashlight on': { intent: 'DEVICE_CONTROL', action: 'flashlight_on' },
  'flashlight off': { intent: 'DEVICE_CONTROL', action: 'flashlight_off' },
  'torcia accendi': { intent: 'DEVICE_CONTROL', action: 'flashlight_on' },
  'torcia spegni': { intent: 'DEVICE_CONTROL', action: 'flashlight_off' },
  'screenshot': { intent: 'DEVICE_CONTROL', action: 'screenshot' },
  'cattura schermo': { intent: 'DEVICE_CONTROL', action: 'screenshot' },
  'volume up': { intent: 'DEVICE_CONTROL', action: 'volume_up' },
  'volume down': { intent: 'DEVICE_CONTROL', action: 'volume_down' },
  'alza volume': { intent: 'DEVICE_CONTROL', action: 'volume_up' },
  'abbassa volume': { intent: 'DEVICE_CONTROL', action: 'volume_down' },
  'what time is it': { intent: 'TIME', action: 'current_time' },
  'che ore sono': { intent: 'TIME', action: 'current_time' },
  'what day is it': { intent: 'DATE', action: 'current_date' },
  'che giorno e': { intent: 'DATE', action: 'current_date' },
  'goodbye': { intent: 'WELLNESS', action: 'goodbye' },
  'arrivederci': { intent: 'WELLNESS', action: 'goodbye' }
};

class IntentClassifierService {
  constructor() {
    this.isInitialized = false;
    this.classificationHistory = [];
  }

  async init() {
    this.isInitialized = true;
    logger.info('IntentClassifier', 'Initialized with keyword-based classifier');
    return true;
  }

  /**
   * Classify user input into an intent with confidence score
   */
  classify(text) {
    if (!text) return null;

    const clean = text.toLowerCase().trim();

    const directMatch = DIRECT_COMMANDS[clean];
    if (directMatch) {
      return {
        intent: directMatch.intent,
        action: directMatch.action,
        confidence: 0.99,
        entities: {},
        needsLLM: false
      };
    }

    let bestMatch = null;
    let bestConfidence = 0;

    for (const [intent, config] of Object.entries(INTENT_CATEGORIES)) {
      for (const pattern of config.patterns) {
        const match = clean.match(pattern);
        if (match) {
          const confidence = config.confidence;
          if (confidence > bestConfidence) {
            bestConfidence = confidence;
            bestMatch = {
              intent,
              confidence,
              entities: this.extractEntities(clean, intent, match),
              rawMatch: match
            };
          }
        }
      }
    }

    if (bestMatch) {
      bestMatch.needsLLM = bestMatch.confidence < 0.8;
      this.classificationHistory.push({
        text: clean,
        intent: bestMatch.intent,
        confidence: bestMatch.confidence,
        timestamp: Date.now()
      });
      return bestMatch;
    }

    return {
      intent: 'UNKNOWN',
      confidence: 0,
      entities: {},
      needsLLM: true
    };
  }

  extractEntities(text, intent, match) {
    const entities = {};

    switch (intent) {
      case 'APP_LAUNCH':
      case 'CALL':
      case 'SMS':
        entities.target = match[1]?.trim();
        break;
      case 'NAVIGATION':
        entities.destination = match[1]?.trim();
        break;
      case 'MUSIC':
        entities.query = match[1]?.trim();
        break;
      case 'SEARCH':
        entities.query = text;
        break;
      case 'WEATHER':
        const cityMatch = text.match(/(?:a|di|per|in|at|in)\s+(.+?)$/);
        if (cityMatch) entities.city = cityMatch[1].trim();
        break;
      case 'TIMER':
        const timeMatch = text.match(/(\d+)\s*(min|sec|h|hour)/i);
        if (timeMatch) {
          entities.amount = parseInt(timeMatch[1]);
          entities.unit = timeMatch[2];
        }
        break;
      case 'REMINDER':
        const reminderMatch = text.match(/(?:in|tra|fra)\s+(\d+)\s*(min(?:uto)?|ora|ore|h)/i);
        if (reminderMatch) {
          entities.delay = parseInt(reminderMatch[1]);
          entities.unit = reminderMatch[2];
        }
        const reminderTextMatch = text.match(/(?:di|to|che|about)\s+(.+)/i);
        if (reminderTextMatch) entities.message = reminderTextMatch[1].trim();
        break;
      case 'DEVICE_CONTROL':
        const deviceMatch = text.match(/(volume|luminosita|brightness|wifi|bluetooth|torcia|flashlight|rotation|rotazione)/i);
        if (deviceMatch) entities.device = deviceMatch[1].toLowerCase();
        break;
    }

    return entities;
  }

  /**
   * Check if the intent can be handled locally without LLM
   */
  canHandleLocally(intent) {
    const localIntents = [
      'DEVICE_CONTROL', 'APP_LAUNCH', 'CALL', 'TIMER', 'ALARM',
      'WELLNESS', 'NOTIFICATIONS'
    ];
    return localIntents.includes(intent);
  }

  getStats() {
    const intentCounts = {};
    this.classificationHistory.forEach(h => {
      intentCounts[h.intent] = (intentCounts[h.intent] || 0) + 1;
    });
    return {
      totalClassified: this.classificationHistory.length,
      intentDistribution: intentCounts
    };
  }
}

export const intentClassifier = new IntentClassifierService();
export default IntentClassifierService;
