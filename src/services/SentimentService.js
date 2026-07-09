/**
 * SentimentService.js - Analisi del Sentimento
 * Rileva emozioni nel testo dell'utente
 */

import { logger } from '../utils/Logger';

// Parole chiave per emozioni (italiano + inglese)
const EMOTION_KEYWORDS = {
  happy: {
    it: ['felice', 'contento', 'contenta', 'felicità', 'gioia', 'gioioso', 'allegro', 'entusiasta', 'fantastico', 'ottimo', 'perfetto', 'bene', 'great', 'awesome', 'amazing', 'happy', 'joy', 'excellent'],
    intensity: 1.2
  },
  sad: {
    it: ['triste', 'tristezza', 'malinconico', 'depresso', 'giù', 'male', 'terribile', 'orribile', 'pessimo', 'awful', 'terrible', 'sad', 'depressed', 'miserable', 'horrible'],
    intensity: 1.3
  },
  angry: {
    it: ['arrabbiato', 'arrabbiata', 'furioso', 'incazzato', 'rabbia', 'odio', 'schifo', 'indignato', 'furious', 'angry', 'mad', 'hate', 'angry', 'rage', 'furious'],
    intensity: 1.4
  },
  anxious: {
    it: ['ansioso', 'ansiosa', 'preoccupato', 'preoccupata', 'nervoso', 'nervosa', 'stressato', 'stressata', 'tensione', 'anxious', 'worried', 'nervous', 'stressed', 'tense'],
    intensity: 1.1
  },
  tired: {
    it: ['stanco', 'stanca', 'faticato', 'esausto', 'esausta', 'spossato', 'spossata', 'dormire', 'riposo', 'tired', 'exhausted', 'fatigued', 'sleepy', 'rest'],
    intensity: 0.9
  },
  excited: {
    it: ['eccitato', 'eccitata', 'entusiasta', 'impaziente', 'curioso', 'curiosa', 'interessato', 'interessata', 'hype', 'excited', 'enthusiastic', 'eager', 'curious'],
    intensity: 1.3
  },
  confused: {
    it: ['confuso', 'confusa', 'spiazzato', 'spiazzata', 'perplex', 'non capisco', 'non ho capito', 'chiarire', 'confused', 'lost', 'puzzled', 'unclear'],
    intensity: 1.0
  },
  grateful: {
    it: ['grazie', 'ringrazio', 'grato', 'grata', 'apprezzo', 'gentile', 'carino', 'perfetto', 'thanks', 'thankful', 'grateful', 'appreciate'],
    intensity: 1.1
  },
  bored: {
    it: ['noioso', 'noiosa', 'annoiato', 'annoiata', 'noia', 'stanco', 'senza voglia', 'bored', 'tired', 'uninterested', 'apathy'],
    intensity: 0.8
  },
  neutral: {
    it: ['ok', 'va bene', 'bene', 'normale', 'solito', 'uffa', 'okay', 'fine', 'normal', 'usual'],
    intensity: 0.5
  }
};

// Pattern per intensità
const INTENSITY_PATTERNS = {
  high: [/!!+/, /[A-Z]{3,}/, /molto/, /estrema/, /terribile/, /fantastico/],
  medium: [/!/, /abbastanza/, /piuttosto/, /fairly/],
  low: [/\.\.\./, /forse/, /magari/, /maybe/, /perhaps/]
};

// Pattern per contesto temporale
const TEMPORAL_PATTERNS = {
  past: [/ieri/, /fa/, /prima/, /ieri/, /prima/, /yesterday/, /ago/, /before/],
  present: [/adesso/, /ora/, /oggi/, /in questo momento/, /now/, /today/, /currently/],
  future: [/domani/, /prossimamente/, /poi/, /dopo/, /tomorrow/, /later/, /after/]
};

class SentimentServiceClass {
  constructor() {
    this.isInitialized = false;
    this.sentimentHistory = [];
    this.userMoodProfile = {
      dominantMood: 'neutral',
      moodFrequency: {},
      avgSentiment: 0
    };
  }

  /**
   * Inizializza il servizio
   */
  async init() {
    this.isInitialized = true;
    logger.info('SentimentService', 'Initialized');
    return true;
  }

  /**
   * Analizza sentimento del testo
   */
  analyzeSentiment(text) {
    if (!text || text.trim().length === 0) {
      return this._createResult('neutral', 0.5, 'Testo vuoto');
    }

    const cleanText = text.toLowerCase().trim();
    
    // Calcola punteggi per ogni emozione
    const scores = {};
    let totalScore = 0;
    let matchCount = 0;

    for (const [emotion, config] of Object.entries(EMOTION_KEYWORDS)) {
      let emotionScore = 0;
      let emotionMatches = 0;

      // Cerca parole chiave
      for (const keyword of config.it) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = cleanText.match(regex);
        
        if (matches) {
          emotionScore += matches.length * config.intensity;
          emotionMatches += matches.length;
        }
      }

      if (emotionMatches > 0) {
        scores[emotion] = {
          score: emotionScore,
          matches: emotionMatches,
          keywords: config.it.filter(k => cleanText.includes(k))
        };
        totalScore += emotionScore;
        matchCount += emotionMatches;
      }
    }

    // Determina emozione dominante
    let dominantEmotion = 'neutral';
    let maxScore = 0;

    for (const [emotion, data] of Object.entries(scores)) {
      if (data.score > maxScore) {
        maxScore = data.score;
        dominantEmotion = emotion;
      }
    }

    // Calcola intensità
    const intensity = this._calculateIntensity(cleanText, maxScore, matchCount);

    // Calcola confidence
    const confidence = Math.min(1, matchCount / 3); // Max confidence con 3+ match

    // Rileva contesto temporale
    const temporalContext = this._detectTemporalContext(cleanText);

    // Crea risultato
    const result = this._createResult(
      dominantEmotion,
      intensity,
      text,
      {
        scores,
        confidence,
        temporalContext,
        matchCount,
        hasExclamation: cleanText.includes('!'),
        hasQuestion: cleanText.includes('?'),
        textLength: cleanText.length
      }
    );

    // Aggiorna storia
    this._updateHistory(result);

    logger.info('SentimentService', 'Sentiment analyzed', {
      emotion: dominantEmotion,
      intensity,
      confidence
    });

    return result;
  }

  /**
   * Crea risultato analisi
   */
  _createResult(emotion, intensity, text, metadata = {}) {
    return {
      emotion,
      intensity: Math.round(intensity * 100) / 100,
      label: this._getEmotionLabel(emotion),
      emoji: this._getEmotionEmoji(emotion),
      description: this._getEmotionDescription(emotion, intensity),
      responseSuggestion: this._getResponseSuggestion(emotion, intensity),
      metadata,
      timestamp: Date.now()
    };
  }

  /**
   * Calcola intensità
   */
  _calculateIntensity(text, baseScore, matchCount) {
    let intensity = Math.min(1, baseScore / 3);

    // Modificatori basati su pattern
    for (const [level, patterns] of Object.entries(INTENSITY_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          switch (level) {
            case 'high':
              intensity = Math.min(1, intensity * 1.3);
              break;
            case 'medium':
              intensity = Math.min(1, intensity * 1.1);
              break;
            case 'low':
              intensity = Math.max(0, intensity * 0.8);
              break;
          }
        }
      }
    }

    // Modificatore per maiuscole (urlando)
    const uppercaseRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (uppercaseRatio > 0.3) {
      intensity = Math.min(1, intensity * 1.2);
    }

    // Modificatore per punteggiatura
    const exclamationCount = (text.match(/!/g) || []).length;
    if (exclamationCount > 1) {
      intensity = Math.min(1, intensity * (1 + exclamationCount * 0.1));
    }

    return Math.max(0.1, Math.min(1, intensity));
  }

  /**
   * Rileva contesto temporale
   */
  _detectTemporalContext(text) {
    for (const [temporal, patterns] of Object.entries(TEMPORAL_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return temporal;
        }
      }
    }
    return 'present';
  }

  /**
   * Ottieni etichetta emozione
   */
  _getEmotionLabel(emotion) {
    const labels = {
      happy: 'Felice',
      sad: 'Triste',
      angry: 'Arrabbiato',
      anxious: 'Ansioso',
      tired: 'Stanco',
      excited: 'Eccitato',
      confused: 'Confuso',
      grateful: 'Grato',
      bored: 'Noioso',
      neutral: 'Neutro'
    };
    return labels[emotion] || 'Neutro';
  }

  /**
   * Ottieni emoji emozione
   */
  _getEmotionEmoji(emotion) {
    const emojis = {
      happy: '😊',
      sad: '😢',
      angry: '😠',
      anxious: '😰',
      tired: '😴',
      excited: '🤩',
      confused: '😕',
      grateful: '🙏',
      bored: '😒',
      neutral: '😐'
    };
    return emojis[emotion] || '😐';
  }

  /**
   * Ottieni descrizione emozione
   */
  _getEmotionDescription(emotion, intensity) {
    const intensityText = intensity > 0.7 ? 'molto' : intensity > 0.4 ? 'abbastanza' : 'un po\'';
    
    const descriptions = {
      happy: `Sembra che tu sia ${intensityText} felice!`,
      sad: `Sembra che tu sia ${intensityText} triste.`,
      angry: `Sembra che tu sia ${intensityText} arrabbiato.`,
      anxious: `Sembra che tu sia ${intensityText} ansioso.`,
      tired: `Sembra che tu sia ${intensityText} stanco.`,
      excited: `Sembra che tu sia ${intensityText} eccitato!`,
      confused: `Sembra che tu sia ${intensityText} confuso.`,
      grateful: `Sembra che tu sia ${intensityText} grato!`,
      bored: `Sembra che tu sia ${intensityText} annoiato.`,
      neutral: `Sembra che tu stia bene.`
    };
    
    return descriptions[emotion] || 'Non riesco a capire come ti senti.';
  }

  /**
   * Ottieni suggerimento risposta
   */
  _getResponseSuggestion(emotion, intensity) {
    const suggestions = {
      happy: {
        high: 'Perfetto! Continua così! Vuoi condividere cosa ti rende felice?',
        medium: 'Ottimo! Sono contento per te!',
        low: 'Bene, vedo che stai bene.'
      },
      sad: {
        high: 'Mi dispiace molto. Vuoi parlare di cosa ti disturba?',
        medium: 'Spero che le cose migliorino presto.',
        low: 'Vedo che non sei al top. Vuoi che ti aiuti?'
      },
      angry: {
        high: 'Capisco la tua frustrazione. Vuoi che ti aiuti a risolvere il problema?',
        medium: 'Sembra che qualcosa ti abbia dato fastidio.',
        low: 'Sembra che qualcosa non vada.'
      },
      anxious: {
        high: 'Respira profondamente. Vuoi che ti aiuti a gestire l\'ansia?',
        medium: 'Sembra che tu sia preoccupato.',
        low: 'Un po\' di preoccupazione è normale.'
      },
      tired: {
        high: 'Dovresti riposare. Vuoi che ti ricordi di prenderti una pausa?',
        medium: 'Sembra che tu abbia bisogno di riposo.',
        low: 'Forse dovresti prenderti una pausa.'
      },
      excited: {
        high: 'Wow! Sei super eccitato! Cosa ti entusiasma così tanto?',
        medium: 'Vedo che hai molta energia!',
        low: 'Sembra che qualcosa ti incuriosisca.'
      },
      confused: {
        high: 'Non ti preoccupare, cerchiamo di capire insieme.',
        medium: 'Vedo che hai qualche dubbio.',
        low: 'Sembra che tu abbia qualche domanda.'
      },
      grateful: {
        high: 'Grazie a te! Sono felice di aiutarti!',
        medium: 'Prego! Sono qui per te.',
        low: 'Di niente!'
      },
      bored: {
        high: 'Vuoi che ti proponga qualcosa di interessante?',
        medium: 'Sembra che tu abbia un po\' di noia.',
        low: 'Hai voglia di fare qualcosa?'
      },
      neutral: {
        high: 'Come posso aiutarti?',
        medium: 'Sono qui se hai bisogno.',
        low: 'Dimmi pure.'
      }
    };

    const level = intensity > 0.7 ? 'high' : intensity > 0.4 ? 'medium' : 'low';
    return suggestions[emotion]?.[level] || 'Come posso aiutarti?';
  }

  /**
   * Aggiorna storia sentimenti
   */
  _updateHistory(result) {
    this.sentimentHistory.push(result);

    // Mantieni solo ultimi 50 risultati
    if (this.sentimentHistory.length > 50) {
      this.sentimentHistory.shift();
    }

    // Aggiorna profilo mood utente
    this._updateMoodProfile(result);
  }

  /**
   * Aggiorna profilo mood
   */
  _updateMoodProfile(result) {
    const { emotion } = result;

    // Aggiorna frequenza mood
    this.userMoodProfile.moodFrequency[emotion] = 
      (this.userMoodProfile.moodFrequency[emotion] || 0) + 1;

    // Calcola mood dominante
    let maxFreq = 0;
    for (const [mood, freq] of Object.entries(this.userMoodProfile.moodFrequency)) {
      if (freq > maxFreq) {
        maxFreq = freq;
        this.userMoodProfile.dominantMood = mood;
      }
    }

    // Calcola sentiment medio
    const sentiments = this.sentimentHistory.map(h => h.intensity);
    this.userMoodProfile.avgSentiment = 
      sentiments.reduce((a, b) => a + b, 0) / sentiments.length;
  }

  /**
   * Analizza conversazione (più messaggi)
   */
  analyzeConversation(messages) {
    if (!messages || messages.length === 0) {
      return {
        overall: 'neutral',
        trend: 'stable',
        suggestions: []
      };
    }

    // Analizza ogni messaggio
    const analyses = messages.map(msg => this.analyzeSentiment(msg.content));

    // Calcola trend
    const recent = analyses.slice(-5);
    const avgRecentIntensity = recent.reduce((a, b) => a + b.intensity, 0) / recent.length;
    const avgOverallIntensity = analyses.reduce((a, b) => a + b.intensity, 0) / analyses.length;

    let trend = 'stable';
    if (avgRecentIntensity > avgOverallIntensity * 1.2) {
      trend = 'increasing';
    } else if (avgRecentIntensity < avgOverallIntensity * 0.8) {
      trend = 'decreasing';
    }

    // Trova emozione dominante
    const emotionCounts = {};
    analyses.forEach(a => {
      emotionCounts[a.emotion] = (emotionCounts[a.emotion] || 0) + 1;
    });

    const overall = Object.entries(emotionCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'neutral';

    // Suggerisci risposta basata su trend
    const suggestions = [];
    if (trend === 'increasing' && overall === 'angry') {
      suggestions.push('L\'utente sembra sempre più arrabbiato. Prova a rassicurarlo.');
    } else if (trend === 'increasing' && overall === 'sad') {
      suggestions.push('L\'utente sembra sempre più triste. Mostra empatia.');
    } else if (trend === 'decreasing' && overall === 'happy') {
      suggestions.push('L\'utente sembra più tranquillo. Continua così.');
    }

    return {
      overall,
      trend,
      avgIntensity: avgOverallIntensity,
      recentIntensity: avgRecentIntensity,
      analyses: analyses.slice(-5),
      suggestions
    };
  }

  /**
   * Ottieni profilo mood utente
   */
  getUserMoodProfile() {
    return { ...this.userMoodProfile };
  }

  /**
   * Ottieni storia sentimenti
   */
  getSentimentHistory(limit = 10) {
    return this.sentimentHistory.slice(-limit);
  }

  /**
   * Pulisci storia
   */
  clearHistory() {
    this.sentimentHistory = [];
    this.userMoodProfile = {
      dominantMood: 'neutral',
      moodFrequency: {},
      avgSentiment: 0
    };
    logger.info('SentimentService', 'History cleared');
  }

  /**
   * Ottieni stato
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      historyLength: this.sentimentHistory.length,
      userMoodProfile: this.userMoodProfile
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.sentimentHistory = [];
    this.userMoodProfile = {
      dominantMood: 'neutral',
      moodFrequency: {},
      avgSentiment: 0
    };
    logger.info('SentimentService', 'Cleanup completed');
  }
}

export const sentimentService = new SentimentServiceClass();
export default SentimentServiceClass;
