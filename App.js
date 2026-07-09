/**
 * App.js - Echo AI - JARVIS-like Mobile Assistant
 * 
 * Miglioramenti:
 * - Aggiunta navigazione con schermata Impostazioni
 * - Pulsante settings nell'header
 * - Supporto multi-provider LLM
 * - API keys configurabili direttamente dall'app
 */

import React, { useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import EchoCore from './src/components/EchoCore';
import ChatLog from './src/components/ChatLog';
import InputBar from './src/components/InputBar';
import SettingsButton from './src/components/SettingsButton';
import SettingsScreen from './src/screens/SettingsScreen';
import theme from './src/config/theme';
import { useEcho } from './src/hooks/useEcho';
import { envLoader } from './src/services/EnvLoader';

const Stack = createNativeStackNavigator();

const STATUS_LABELS = {
  idle: 'Pronto',
  listening: 'Ascolto in corso',
  thinking: 'Sto elaborando',
  speaking: 'Sto parlando',
};

function HomeScreen({ navigation }) {
  const {
    messages,
    input,
    setInput,
    status,
    isThinking,
    isListening,
    voiceAvailable,
    error,
    isDisabled,
    sendFromInput,
    startListening,
    stopListening,
  } = useEcho();

  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    // Check if app is configured
    const checkConfig = () => {
      setIsConfigured(envLoader.hasAnyProvider());
    };
    
    checkConfig();
    
    // Listen for config changes
    const unsubscribe = envLoader.addListener(checkConfig);
    return unsubscribe;
  }, []);

  const statusLabel = STATUS_LABELS[status] || STATUS_LABELS.idle;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.backdrop} />

      {/* Settings Button */}
      <SettingsButton
        onPress={() => navigation.navigate('Settings')}
        configured={isConfigured}
      />

      <KeyboardAvoidingView
        style={styles.shell}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hero}>
          <Text style={styles.title}>Echo</Text>
          <Text style={styles.subtitle}>Interfaccia vocale futuristica, pronta all'uso.</Text>
          
          {!isConfigured && (
            <View style={styles.setupBanner}>
              <Text style={styles.setupText}>
                ⚙️ Configura le API keys nelle impostazioni per iniziare
              </Text>
            </View>
          )}
        </View>

        <View style={styles.coreWrap}>
          <EchoCore state={status} />
          <Text style={styles.statusLabel}>{statusLabel}</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <View style={styles.logWrap}>
          <ChatLog messages={messages} isThinking={isThinking} />
        </View>

        <InputBar
          value={input}
          onChangeText={setInput}
          onSend={sendFromInput}
          onMicPress={isListening ? stopListening : startListening}
          isListening={isListening}
          disabled={isDisabled || !isConfigured}
          voiceAvailable={voiceAvailable}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            presentation: 'modal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
  },
  shell: {
    flex: 1,
    paddingTop: 56,
  },
  hero: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  title: {
    color: theme.colors.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: 6,
    color: theme.colors.textMuted,
    fontSize: 14,
  },
  setupBanner: {
    marginTop: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  setupText: {
    color: '#FCD34D',
    fontSize: 13,
    textAlign: 'center',
  },
  coreWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
  },
  statusLabel: {
    marginTop: -theme.spacing.xs,
    color: theme.colors.textMuted,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  errorText: {
    marginTop: theme.spacing.sm,
    color: theme.colors.danger,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  logWrap: {
    flex: 1,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
});
