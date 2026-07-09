/**
 * App.js - Echo AI - JARVIS-like Mobile Assistant
 * 
 * Miglioramenti:
 * - Animazioni reattive alla voce
 * - Context awareness (ora, data, abitudini)
 * - Quick actions (chiama, apri app, etc.)
 * - Notifiche push proattive
 * - Personalità JARVIS con umorismo
 */

import React, { useState, useEffect } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AnimatedCore from './src/components/AnimatedCore';
import ChatLog from './src/components/ChatLog';
import InputBar from './src/components/InputBar';
import SettingsButton from './src/components/SettingsButton';
import SettingsScreen from './src/screens/SettingsScreen';
import theme from './src/config/theme';
import { useEcho } from './src/hooks/useEcho';
import { envLoader } from './src/services/EnvLoader';
import { contextEngine } from './src/services/ContextEngine';

const Stack = createNativeStackNavigator();

const STATUS_LABELS = {
  idle: 'Pronto',
  listening: 'Ascolto in corso',
  thinking: 'Sto elaborando',
  speaking: 'Sto parlando',
};

const STATUS_ICONS = {
  idle: '🔵',
  listening: '🟢',
  thinking: '🟡',
  speaking: '🟣',
};

function HomeScreen({ navigation }) {
  const {
    messages,
    input,
    setInput,
    status,
    isThinking,
    isListening,
    isSpeaking,
    voiceAvailable,
    error,
    isDisabled,
    sendFromInput,
    startListening,
    stopListening,
    context,
    audioLevel,
    userName,
  } = useEcho();

  const [isConfigured, setIsConfigured] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

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
  const statusIcon = STATUS_ICONS[status] || STATUS_ICONS.idle;

  // Saluto basato sul contesto
  const getGreeting = () => {
    if (userName) {
      return contextEngine.getGreeting(userName);
    }
    return contextEngine.getGreeting();
  };

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
        {/* Header con saluto contestuale */}
        <View style={styles.hero}>
          <Text style={styles.title}>Echo</Text>
          <Text style={styles.subtitle}>{getGreeting()}</Text>
          
          {!isConfigured && (
            <View style={styles.setupBanner}>
              <Text style={styles.setupText}>
                ⚙️ Configura le API keys nelle impostazioni per iniziare
              </Text>
            </View>
          )}

          {/* Indicatore contesto */}
          {context && (
            <View style={styles.contextIndicator}>
              <Text style={styles.contextText}>
                {context.formattedTime} • {context.dayOfWeek}
              </Text>
            </View>
          )}
        </View>

        {/* Core animato JARVIS */}
        <View style={styles.coreWrap}>
          <AnimatedCore
            state={status}
            size={200}
            audioLevel={audioLevel}
            onPress={() => {
              if (isConfigured) {
                if (isListening) {
                  stopListening();
                } else {
                  startListening();
                }
              }
            }}
          />
          <View style={styles.statusRow}>
            <Text style={styles.statusIcon}>{statusIcon}</Text>
            <Text style={styles.statusLabel}>{statusLabel}</Text>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        {/* Chat Log */}
        <View style={styles.logWrap}>
          <ChatLog messages={messages} isThinking={isThinking} />
        </View>

        {/* Quick Actions Toggle */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickActionsToggle}
            onPress={() => setShowQuickActions(!showQuickActions)}
          >
            <Text style={styles.quickActionsToggleText}>
              {showQuickActions ? '▼ Nascondi' : '▶ Comandi rapidi'}
            </Text>
          </TouchableOpacity>

          {showQuickActions && (
            <View style={styles.quickActionsList}>
              <TouchableOpacity
                style={styles.quickActionChip}
                onPress={() => {
                  setInput('Chiama Maria');
                  setShowQuickActions(false);
                }}
              >
                <Text style={styles.quickActionText}>📞 Chiama</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.quickActionChip}
                onPress={() => {
                  setInput('Apri WhatsApp');
                  setShowQuickActions(false);
                }}
              >
                <Text style={styles.quickActionText}>💬 WhatsApp</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.quickActionChip}
                onPress={() => {
                  setInput('Apri Spotify');
                  setShowQuickActions(false);
                }}
              >
                <Text style={styles.quickActionText}>🎵 Musica</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.quickActionChip}
                onPress={() => {
                  setInput('Cerca su Google');
                  setShowQuickActions(false);
                }}
              >
                <Text style={styles.quickActionText}>🔍 Cerca</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.quickActionChip}
                onPress={() => {
                  setInput('Che ore sono?');
                  setShowQuickActions(false);
                }}
              >
                <Text style={styles.quickActionText}>🕐 Ora</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.quickActionChip}
                onPress={() => {
                  setInput('Che tempo fa?');
                  setShowQuickActions(false);
                }}
              >
                <Text style={styles.quickActionText}>🌤️ Meteo</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Input Bar */}
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
  contextIndicator: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  contextText: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  coreWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -theme.spacing.xs,
  },
  statusIcon: {
    marginRight: 6,
  },
  statusLabel: {
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
  quickActionsContainer: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  quickActionsToggle: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 20,
    alignSelf: 'center',
  },
  quickActionsToggleText: {
    color: theme.colors.primary || '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
  quickActionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  quickActionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface || 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border || 'rgba(255,255,255,0.1)',
  },
  quickActionText: {
    color: theme.colors.text,
    fontSize: 12,
  },
});
