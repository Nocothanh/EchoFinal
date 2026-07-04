import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { configManager } from '../config/JarvisConfig';
import theme from '../config/theme';

export default function SettingsModal({ visible, onClose }) {
  const [groqKey, setGroqKey] = useState('');
  const [elevenKey, setElevenKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadKeys() {
      try {
        const g = await SecureStore.getItemAsync('GROQ_API_KEY');
        const e = await SecureStore.getItemAsync('ELEVENLABS_API_KEY');
        if (!mounted) return;
        setGroqKey(g || '');
        setElevenKey(e || '');
      } catch (err) {
        console.error('[SettingsModal] loadKeys', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (visible) loadKeys();
    return () => { mounted = false; };
  }, [visible]);

  async function handleSave() {
    setSaving(true);
    try {
      // Store in secure storage
      if (groqKey && groqKey.length > 0) {
        await SecureStore.setItemAsync('GROQ_API_KEY', groqKey);
        await configManager.set('llm.apiKey', groqKey);
      }
      if (elevenKey && elevenKey.length > 0) {
        await SecureStore.setItemAsync('ELEVENLABS_API_KEY', elevenKey);
        await configManager.set('tts.apiKey', elevenKey);
      }
      Alert.alert('Salvato', 'Le credenziali sono state salvate in modo sicuro.');
      onClose();
    } catch (err) {
      console.error('[SettingsModal] save', err);
      Alert.alert('Errore', 'Impossibile salvare le credenziali.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Impostazioni credenziali</Text>

          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <>
              <Text style={styles.label}>GROQ API Key</Text>
              <TextInput
                style={styles.input}
                value={groqKey}
                onChangeText={setGroqKey}
                placeholder="gsk_xxxxx"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />

              <Text style={styles.label}>ElevenLabs API Key</Text>
              <TextInput
                style={styles.input}
                value={elevenKey}
                onChangeText={setElevenKey}
                placeholder="xxxxx"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />

              <View style={styles.row}>
                <Pressable onPress={onClose} style={[styles.button, styles.cancel]}>
                  <Text style={styles.buttonText}>Annulla</Text>
                </Pressable>

                <Pressable onPress={handleSave} style={[styles.button, styles.save]} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Salva</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface || '#0A0F1C',
    padding: theme.spacing.lg,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  title: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: theme.spacing.sm,
  },
  input: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    color: theme.colors.text,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: theme.spacing.md,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  save: {
    backgroundColor: theme.colors.primary,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
