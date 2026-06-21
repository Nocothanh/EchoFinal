import { generateEchoPersonaPrompt } from './persona-generator-develop';
import { buildVisionNarrative } from './ai-powered-video-analyzer-adapter';
// Use centralized LLM client and TTS service
import { callProvider } from './src/services/LLMClient';
import { speak as ttsSpeak, stopSpeech as ttsStop } from './src/services/TTS';
import { fetchWithTimeout, requestWithRetry, sanitizeModelText } from './llm-resilience';
import { Audio } from 'expo-av';
import { Speech } from 'expo-speech';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';

let isEchoSpeaking = false;
let currentSound = null;

async function speakText(text, cfg, callbacks = {}) {
  // Delegate to centralized TTS module
  return ttsSpeak(text, cfg, callbacks);
}

async function stopEchoSpeech() {
  try {
    if (currentSound) {
      await currentSound.stopAsync();
      await currentSound.unloadAsync();
      currentSound = null;
    }
    await ttsStop();
  } catch (error) {
    console.warn('Error stopping speech:', error);
  }
  isEchoSpeaking = false;
}

export default function App() {
  const [conversationHistory, setConversationHistory] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState({
    provider: 'groq',
    apiKey: '',
    model: 'mixtral-8x7b-32768',
    elKey: '',
    elVoice: '',
  });
  const scrollRef = useRef(null);

  const sendMessage = async () => {
    if (!userInput.trim()) return;

    const newHistory = [...conversationHistory, { role: 'user', content: userInput }];
    setConversationHistory(newHistory);
    setUserInput('');
    setIsLoading(true);

    try {
      const sysPrompt = generateEchoPersonaPrompt();
      const cleanHist = newHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Use the new callProvider wrapper which centralizes providers
      const messages = [{ role: 'system', content: sysPrompt }, ...cleanHist];
      const rawReply = await callProvider(
        { provider: config.provider, apiKey: config.apiKey, model: config.model },
        messages,
        { isCall: false }
      );

      const responseHistory = [...newHistory, { role: 'assistant', content: rawReply }];
      setConversationHistory(responseHistory);

      // Speak the response
      await speakText(rawReply, config, {
        onStart: () => console.log('Speaking started'),
        onDone: () => console.log('Speaking finished'),
      });
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollRef} style={styles.conversation}>
        {conversationHistory.map((msg, idx) => (
          <View key={idx} style={msg.role === 'user' ? styles.userMessage : styles.assistantMessage}>
            <Text style={styles.messageText}>{msg.content}</Text>
          </View>
        ))}
        {isLoading && <ActivityIndicator size="large" color="#0000ff" />}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.button} onPress={sendMessage} disabled={isLoading}>
          <Text style={styles.buttonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  conversation: {
    flex: 1,
    padding: 10,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 10,
    marginVertical: 5,
    maxWidth: '80%',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    padding: 10,
    marginVertical: 5,
    maxWidth: '80%',
  },
  messageText: {
    color: '#000',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
  },
  button: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 5,
    paddingVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
