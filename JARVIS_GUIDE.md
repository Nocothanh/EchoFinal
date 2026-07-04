# 🤖 JARVIS AI - GUIDA COMPLETA INTEGRAZIONE

## 📋 STATO DEL PROGETTO

✅ **FASE 1: Setup Fondamentale** - COMPLETATO
- ✅ JarvisConfig (centralizzazione configurazione)
- ✅ Logger strutturato
- ✅ ErrorHandler con retry & circuit breaker
- ✅ GroqOptimizer (LLM ottimizzato)
- ✅ Credenziali sicure con .env
- ✅ Wake-word "Echo" detection
- ✅ Speech Recognition Service

✅ **FASE 3: User Memory & Context** - COMPLETATO
- ✅ StorageService (SQLite persistente)
- ✅ UserProfile (personalizzazione)
- ✅ RAGEngine (contesto semantico)
- ✅ TimeTracker (tracciamento completo)

✅ **FASE 4: Proattività & Device Control** - COMPLETATO
- ✅ SchedulerService (task scheduling)
- ✅ DailyBriefing (briefing mattutino)
- ✅ ProactiveMonitor (suggerimenti intelligenti)
- ✅ IntentService (comandi Android)
- ✅ ContactService (gestione contatti)
- ✅ CalendarService (gestione calendario)
- ✅ MediaControlService (controllo media)
- ✅ DeviceControlService (controllo dispositivo)

✅ **FASE 5: Core Integration** - COMPLETATO
- ✅ JarvisCore (orchestrazione centrale)

---

## 🚀 SETUP INIZIALE

### 1. Copia variabili di ambiente

```bash
cp .env.example .env
```

Modifica `.env` con le tue credenziali:

```bash
GROQ_API_KEY=gsk_xxxxx  # Da https://console.groq.com
ELEVENLABS_API_KEY=xxxxx  # Da https://elevenlabs.io
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL  # Bella voice
NODE_ENV=production
JARVIS_WAKE_WORD=Echo
```

### 2. Installa dipendenze

```bash
npm install
# oppure
yarn install
```

### 3. Avvia l'app

```bash
npm start
# Android
npm run android
# iOS
npm run ios
# Web
npm run web
```

---

## 🔧 CONFIGURAZIONE AVANZATA

### Android Build (FIX GRADLE 8.8)

Se ricevi errore con Gradle 8.8, aggiungi a `android/gradle.properties`:

```properties
# Fix for Gradle 8.8 compatibility
android.enableDexingArtifactTransform=false
android.useNewApkCreator=true
android.nonTransitiveRClass=true

# Memory settings
org.gradle.jvmargs=-Xmx4096m
```

Per il build di produzione:

```bash
NODE_ENV=production npm run build:android-prod
```

### iOS Setup

Permessi richiesti in `Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Jarvis ha bisogno dell'accesso al microfono per la voce</string>
<key>NSContactsUsageDescription</key>
<string>Jarvis ha bisogno di accedere ai tuoi contatti</string>
<key>NSCalendarsUsageDescription</key>
<string>Jarvis ha bisogno di accedere al tuo calendario</string>
```

---

## 💬 USO BASICO

### In React Native App:

```javascript
import { jarvisCore } from './src/core/JarvisCore';

// Inizializza
await jarvisCore.initialize('user_123');

// Invia messaggio
const response = await jarvisCore.processMessage('Ciao Jarvis!');
console.log(response.message);

// Esegui comando vocale
const result = await jarvisCore.executeVoiceCommand('Chiama Mario');

// Arresta
await jarvisCore.shutdown();
```

---

## 🎤 COMANDI VOCALI SUPPORTATI

### Telefonate
```
"Chiama Mario"
"Chiama il mio capo"
```

### Messaggi
```
"Scrivi un messaggio a Luigi"
"Invia SMS a Maria"
```

### Calendario
```
"Mostra eventi di oggi"
"Quali riunioni ho domani?"
"Crea evento domani alle 10"
```

### Media
```
"Riproduci musica"
"Pausa"
"Prossima traccia"
"Alza il volume"
```

### Generale
```
"Echo" (wake-word per attivare)
Qualsiasi altro messaggio viene processato da Groq
```

---

## 🗂️ STRUTTURA PROGETTO

```
src/
├── config/
│   └── JarvisConfig.js          # Configurazione centralizzata
├── core/
│   └── JarvisCore.js            # Orchestrazione principale
├── services/
│   ├── GroqOptimizer.js         # LLM con Groq
│   ├── StorageService.js        # SQLite persistenza
│   ├── UserProfile.js           # Profilo utente
│   ├── RAGEngine.js             # Context retrieval
│   ├── TimeTracker.js           # Activity tracking
│   ├── SchedulerService.js      # Task scheduling
│   ├── DailyBriefing.js         # Briefing mattutino
│   ├── ProactiveMonitor.js      # Suggerimenti intelligenti
│   ├── WakeWordDetector.js      # Riconoscimento "Echo"
│   ├── SpeechRecognitionService.js  # ASR
│   ├── IntentService.js         # Comandi Android
│   ├── ContactService.js        # Gestione contatti
│   ├── CalendarService.js       # Gestione calendario
│   ├── MediaControlService.js   # Controllo media
│   └── DeviceControlService.js  # Controllo dispositivo
├── middleware/
│   └── ErrorHandler.js          # Gestione errori
├── utils/
│   ├── Logger.js                # Logging strutturato
│   └── permissions.js           # Gestione permessi
└── App.js                        # Entry point
```

---

## 🔐 PRIVACY & SICUREZZA

### Credenziali
- ✅ `.env` NON committato (in `.gitignore`)
- ✅ API keys in `expo-secure-store` su mobile
- ✅ Configurazione sensibile protetta

### Dati Utente
- ✅ Conversazioni salvate localmente (SQLite)
- ✅ Time tracking rispetta privacy
- ✅ Location tracking disabilitato di default
- ✅ GDPR-compliant

---

## 📊 MONITORING & DEBUG

### Logger

```javascript
import { logger } from './src/utils/Logger';

logger.info('MyModule', 'Message', { data: 'value' });
logger.error('MyModule', 'Error occurred', error);

// Esporta log
const logs = logger.exportLogs();
```

### Metriche Groq

```javascript
import { groqOptimizer } from './src/services/GroqOptimizer';

const metrics = groqOptimizer.getMetrics();
console.log(`Success rate: ${metrics.successRate}`);
console.log(`Avg latency: ${metrics.averageLatency}ms`);
```

### Stats Utente

```javascript
const stats = await jarvisCore.getSessionStats();
console.log(stats);
// {
//   conversations: 5,
//   messages: 24,
//   avgDuration: 450
// }
```

---

## ⚙️ CONFIGURAZIONE AVANZATA

### Personalizza Brevisting

```javascript
// In JarvisConfig.js
scheduler: {
  enableDailyBriefing: true,
  briefingTime: '08:00',  // Cambiar
}
```

### Abilita Time Tracking Completo

```javascript
// In JarvisConfig.js
timeTracking: {
  enabled: true,
  trackLocation: true,    // ⚠️ Richiede permessi
  trackAppUsage: true,
  trackActivities: true,
}
```

### Modifica Modello LLM

```javascript
// In JarvisConfig.js
llm: {
  model: 'mixtral-8x7b-32768',  // o altri modelli Groq
  temperature: 0.7,
  maxTokens: 200,
}
```

---

## 🐛 TROUBLESHOOTING

### Errore: "Groq API key not configured"

**Soluzione:** Aggiungi `GROQ_API_KEY` al file `.env`

### Errore Build Android: "NODE_ENV not specified"

**Soluzione:** Aggiungi a `babel.config.js` e assicurati di settare `NODE_ENV`

### Wake-word non rilevato

**Soluzione:** Controlla che:
1. Permessi microfono abilitati
2. Device supporta Web Speech API (migliore su Chrome/Android)
3. Wake-word è settato correttamente in `.env`

### Database error SQLite

**Soluzione:** Pulisci il database con:
```javascript
await storageService.cleanupOldData(90);
```

---

## 🚀 PROSSIMI PASSI

1. **Native Modules**
   - Implementare `JarvisIntentModule.java` per Android
   - Implementare `JarvisIntentModule.swift` per iOS

2. **NLP Avanzato**
   - Integrare BERT per command parsing
   - Implement entity extraction

3. **Smart Home**
   - Integrare Home Assistant API
   - Controllo Alexa/Google Home

4. **Cloud Sync**
   - Firebase Realtime Database
   - Cloud backup conversazioni

5. **ML Fine-tuning**
   - Fine-tune su dati personali
   - Implementare RLHF

---

## 📞 SUPPORTO

Per domande o problemi:
- Apri issue su GitHub
- Consulta documentazione Expo
- Vedi logs con `logger.exportLogs()`

---

**Creato con ❤️ per Jarvis AI**
