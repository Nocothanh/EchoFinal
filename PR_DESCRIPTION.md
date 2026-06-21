## Integrate LLM/TTS and MVP scaffold

Questo PR aggiunge:

- Scaffold servizi: src/services/LLMClient.js, src/services/TTS.js, src/services/AudioService.js
- Utils permessi: src/utils/permissions.js
- .env.example, .gitignore, README aggiornato
- Refactor App.js per usare callProvider() e ttsSpeak() centralizzati

Dettagli tecnici:
- Provider LLM predefinito: groq (puoi cambiare in Settings)
- TTS: ElevenLabs se configurata, altrimenti expo-speech fallback

Cosa testare:
- Impostare provider e API key in Settings
- Inviare messaggi chat e verificare che Echo risponda
- Testare CallScreen per la modalità vocale

Security notes:
- credentials.json ed echo-ai.keystore sono presenti nella branch per sviluppo. Ruotare le chiavi se sono sensibili e considerare la rimozione dalla history.
