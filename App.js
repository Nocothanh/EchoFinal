---
*** Begin Patch
*** Update File: App.js
@@
-import { generateEchoPersonaPrompt } from './persona-generator-develop';
-import { buildVisionNarrative } from './ai-powered-video-analyzer-adapter';
-import { fetchWithTimeout, requestWithRetry, sanitizeModelText } from './llm-resilience';
+import { generateEchoPersonaPrompt } from './persona-generator-develop';
+import { buildVisionNarrative } from './ai-powered-video-analyzer-adapter';
+// Use centralized LLM client and TTS service
+import { callProvider } from './src/services/LLMClient';
+import { speak as ttsSpeak, stopSpeech as ttsStop } from './src/services/TTS';
+import { fetchWithTimeout, requestWithRetry, sanitizeModelText } from './llm-resilience';
@@
-async function speakText(text, cfg, callbacks = {}) {
-  const { onStart, onDone } = callbacks;
-  await stopEchoSpeech();
-  isEchoSpeaking = true;
-  onStart?.();
-
-  if (cfg.elKey && cfg.elVoice) {
-    try {
-      const response = await fetch(
-        `https://api.elevenlabs.io/v1/text-to-speech/${cfg.elVoice}`,
-        {
-          method: 'POST',
-          headers: { 'xi-api-key': cfg.elKey, 'Content-Type': 'application/json' },
-          body: JSON.stringify({
-            text,
-            model_id: 'eleven_multilingual_v2',
-            voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.4, use_speaker_boost: true },
-          }),
-        }
-      );
-      if (response.ok) {
-        const audioBlob = await response.blob();
-        const reader = new FileReader();
-        reader.onloadend = async () => {
-          try {
-            const base64 = reader.result.split(',')[1];
-            const { sound } = await Audio.Sound.createAsync(
-              { uri: `data:audio/mpeg;base64,${base64}` },
-              { shouldPlay: true }
-            );
-            currentSound = sound;
-            sound.setOnPlaybackStatusUpdate((status) => {
-              if (status.didJustFinish) {
-                sound.unloadAsync().catch(() => {});
-                currentSound = null;
-                isEchoSpeaking = false;
-                onDone?.();
-              }
-            });
-          } catch {
-            Speech.speak(text, {
-              language: 'it-IT',
-              pitch: 1.1,
-              rate: 1.05,
-              onDone: () => { isEchoSpeaking = false; onDone?.(); },
-              onStopped: () => { isEchoSpeaking = false; onDone?.(); },
-              onError: () => { isEchoSpeaking = false; onDone?.(); },
-            });
-          }
-        };
-        reader.readAsDataURL(audioBlob);
-        return;
-      }
-    } catch {}
-  }
-  Speech.speak(text, {
-    language: 'it-IT',
-    pitch: 1.1,
-    rate: 1.05,
-    onDone: () => { isEchoSpeaking = false; onDone?.(); },
-    onStopped: () => { isEchoSpeaking = false; onDone?.(); },
-    onError: () => { isEchoSpeaking = false; onDone?.(); },
-  });
-}
+async function speakText(text, cfg, callbacks = {}) {
+  // Delegate to centralized TTS module
+  return ttsSpeak(text, cfg, callbacks);
+}
@@
-    const runRequest = providerRequests[cfg.provider] || providerRequests.groq;
-    const rawReply = await requestWithRetry(runRequest, { attempts: 2, baseDelayMs: 500 });
-    const cleanedReply = sanitizeModelText(rawReply);
-    if (!cleanedReply) throw new Error('Risposta vuota dal provider');
-    return cleanedReply;
+    // Use the new callProvider wrapper which centralizes providers
+    const messages = [{ role: 'system', content: sysPrompt }, ...cleanHist];
+    const rawReply = await callProvider({ provider: cfg.provider, apiKey: cfg.apiKey, model: cfg.model, systemPrompt: sysPrompt }, messages, { isCall });
+    return rawReply;
   }
*** End Patch
