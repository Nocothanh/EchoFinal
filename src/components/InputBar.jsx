import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import theme from '../config/theme';

export default function InputBar({
  value,
  onChangeText,
  onSend,
  onMicPress,
  isListening = false,
  disabled = false,
  voiceAvailable = false,
}) {
  const isSendDisabled = disabled || !String(value || '').trim();
  const canUseMic = Boolean(voiceAvailable);

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputShell}>
        <TextInput
          style={styles.input}
          placeholder="Digita o parla con Echo"
          placeholderTextColor={theme.colors.textDim}
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          multiline
          autoCapitalize="sentences"
          autoCorrect
          returnKeyType="send"
          onSubmitEditing={onSend}
        />
        {canUseMic ? (
          <Pressable
            onPress={onMicPress}
            disabled={disabled}
            style={({ pressed }) => [
              styles.micButton,
              isListening && styles.micButtonActive,
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text style={[styles.micText, isListening && styles.micTextActive]}>
              {isListening ? '●' : '◉'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={onSend}
        disabled={isSendDisabled}
        style={({ pressed }) => [
          styles.sendButton,
          isSendDisabled && styles.sendButtonDisabled,
          pressed && !isSendDisabled && styles.pressed,
        ]}
      >
        <Text style={styles.sendText}>Send</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(10, 15, 28, 0.92)',
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 108,
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 6,
  },
  micButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.22)',
  },
  micButtonActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.2)',
    borderColor: 'rgba(34, 211, 238, 0.45)',
  },
  micText: {
    color: theme.colors.cyan,
    fontSize: 18,
    fontWeight: '700',
  },
  micTextActive: {
    color: '#cffafe',
  },
  sendButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.round,
    backgroundColor: theme.colors.primary,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  sendText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
});
