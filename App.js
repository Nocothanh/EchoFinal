import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import EchoCore from './src/components/EchoCore';
import ChatLog from './src/components/ChatLog';
import InputBar from './src/components/InputBar';
import theme from './src/config/theme';
import { useEcho } from './src/hooks/useEcho';

const STATUS_LABELS = {
  idle: 'Pronto',
  listening: 'Ascolto in corso',
  thinking: 'Sto elaborando',
  speaking: 'Sto parlando',
};

export default function App() {
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

  const statusLabel = STATUS_LABELS[status] || STATUS_LABELS.idle;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.backdrop} />

      <KeyboardAvoidingView
        style={styles.shell}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hero}>
          <Text style={styles.title}>Echo</Text>
          <Text style={styles.subtitle}>Interfaccia vocale futuristica, pronta all'uso.</Text>
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
          disabled={isDisabled}
          voiceAvailable={voiceAvailable}
        />
      </KeyboardAvoidingView>
    </View>
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
