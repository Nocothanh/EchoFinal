Ho aggiunto i file di scaffold per servizi LLM, TTS, audio e permessi nella branch feature/echo-mvp.

Cosa ho fatto:
- Creato src/services/LLMClient.js: wrapper per chiamate ai provider (OpenAI/Anthropic/Groq) usando le utils esistenti.
- Creato src/services/TTS.js: wrapper per ElevenLabs + expo-speech.
- Creato src/services/AudioService.js: placeholder per future integrazioni native (wake-word/registrazione).
- Creato src/utils/permissions.js: helper minimale per richieste permessi su Android.
- Aggiunto .env.example e aggiornamento .gitignore per evitare commit di chiavi.
- Aggiunto .github/README-ECHO.md con istruzioni veloci.

Prossimi passi che posso fare ora (scegli o lascio che proceda):
1) Integrare TTS e LLMClient in App.js (pulizia/estrazione delle funzioni esistenti).
2) Aggiungere issue con task dettagliati (wake-word, ASR, foreground service Android).
3) Rimuovere i file sensibili dal repository (richiede cancellazione dei file committati — vuoi che lo faccia?)
4) Implementare un semplice flow per chiamare OpenAI usando variabile d'ambiente e mostrare i risultati nella UI.

Dimmi se vuoi che proceda con 1, 2, 3 o 4; altrimenti procedo con 4 e collego la chiamata LLM al flow di invio messaggi.
