# EchoFinal — Quick setup

Questo progetto fornisce un'interfaccia React Native (Expo) per un'assistente vocale chiamato "Echo". La branch feature/echo-mvp contiene il lavoro iniziale. Di seguito alcune istruzioni veloci per avviare lo sviluppo.

Prerequisiti
- Node.js
- Expo CLI (se stai usando la versione gestita)

Installazione
1. Copia le chiavi sensibili localmente (non committarle nel repo):
   - CREA un file `.env` con le chiavi (vedi `.env.example`).
2. Installa dipendenze:
   npm install

Avvio (dev)
- expo start (o npx expo start)

Note importanti
- Nel repository sono presenti file che sembrano contenere credenziali (`credentials.json`, `echo-ai.keystore`). Ti raccomando di rimuoverli dalla repository pubblica e ruotare le chiavi se valide.
- Questo scaffold usa WebView per alcuni componenti (riconoscimento vocale, registrazione audio, avatar 3D) per evitare integrazioni native immediate.

Prossimi passi raccomandati
- Integrare wake-word nativo (Picovoice) ed eventualmente ASR on-device (Vosk/Whisper)
- Spostare le chiamate ai provider LLM in un servizio centralizzato (src/services/LLMClient.js)
- Preparare permessi e foreground service su Android per "always-listen"
