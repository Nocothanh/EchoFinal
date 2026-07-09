/**
 * SettingsScreen.js - Schermata Impostazioni per configurare Echo
 * Permette di inserire API keys direttamente dall'app
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { envLoader } from '../services/EnvLoader';
import { secureKeyStore } from '../services/SecureKeyStore';
import {
  PROVIDERS,
  getProviderList,
  getModelsForProvider,
  getRecommendedModel,
  validateApiKey,
  getBeginnerRecommendation,
} from '../config/providers';
import theme from '../config/theme';

const ProviderCard = ({ provider, selected, onSelect }) => (
  <TouchableOpacity
    style={[
      styles.providerCard,
      selected && styles.providerCardSelected,
      { borderColor: provider.color },
    ]}
    onPress={() => onSelect(provider.id)}
  >
    <View style={styles.providerHeader}>
      <View style={[styles.providerDot, { backgroundColor: provider.color }]} />
      <Text style={styles.providerName}>{provider.name}</Text>
      {provider.freeTier && (
        <View style={styles.freeTag}>
          <Text style={styles.freeTagText}>FREE</Text>
        </View>
      )}
    </View>
    <Text style={styles.providerDesc}>{provider.description}</Text>
  </TouchableOpacity>
);

const ApiKeyInput = ({ label, value, onChangeText, placeholder, configured }) => (
  <View style={styles.inputGroup}>
    <View style={styles.inputHeader}>
      <Text style={styles.inputLabel}>{label}</Text>
      {configured && (
        <View style={styles.configuredBadge}>
          <Text style={styles.configuredText}>✓ Configurata</Text>
        </View>
      )}
    </View>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textMuted}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
    />
  </View>
);

const ModelSelector = ({ models, selected, onSelect }) => (
  <View style={styles.modelContainer}>
    <Text style={styles.sectionLabel}>Modello</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {models.map((model) => (
        <TouchableOpacity
          key={model.id}
          style={[
            styles.modelChip,
            selected === model.id && styles.modelChipSelected,
          ]}
          onPress={() => onSelect(model.id)}
        >
          <Text
            style={[
              styles.modelChipText,
              selected === model.id && styles.modelChipTextSelected,
            ]}
          >
            {model.name}
            {model.recommended && ' ★'}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

export default function SettingsScreen({ navigation }) {
  const [selectedProvider, setSelectedProvider] = useState('groq');
  const [apiKeys, setApiKeys] = useState({
    groq: '',
    openai: '',
    anthropic: '',
  });
  const [models, setModels] = useState({
    groq: 'llama-3.3-70b-versatile',
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20241022',
  });
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [elevenLabsVoice, setElevenLabsVoice] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const config = envLoader.getConfig();
      setSelectedProvider(config.provider);
      setModels({
        groq: config.groq.model,
        openai: config.openai.model,
        anthropic: config.anthropic.model,
      });
      setElevenLabsVoice(config.elevenlabs.voiceId);

      // Load actual keys from secure store
      setApiKeys({
        groq: secureKeyStore.getKey('GROQ_API_KEY') || '',
        openai: secureKeyStore.getKey('OPENAI_API_KEY') || '',
        anthropic: secureKeyStore.getKey('ANTHROPIC_API_KEY') || '',
      });
      setElevenLabsKey(secureKeyStore.getKey('ELEVENLABS_API_KEY') || '');
    } catch (error) {
      Alert.alert('Errore', 'Impossibile caricare la configurazione');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Validate current provider's key
      const currentKey = apiKeys[selectedProvider];
      const validation = validateApiKey(selectedProvider, currentKey);
      
      if (!validation.valid) {
        Alert.alert('Errore', validation.error);
        setLoading(false);
        return;
      }

      // Save all keys
      await envLoader.setProvider(selectedProvider);
      await envLoader.updateKey('groq', apiKeys.groq, models.groq);
      await envLoader.updateKey('openai', apiKeys.openai, models.openai);
      await envLoader.updateKey('anthropic', apiKeys.anthropic, models.anthropic);
      await envLoader.updateElevenLabs(elevenLabsKey, elevenLabsVoice);

      Alert.alert('Successo', 'Impostazioni salvate!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Errore', 'Impossibile salvare le impostazioni');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    const currentKey = apiKeys[selectedProvider];
    if (!currentKey) {
      Alert.alert('Errore', 'Inserisci prima una API key');
      return;
    }

    setTesting(true);
    try {
      // Temporarily save the key for testing
      await secureKeyStore.setKey(`${selectedProvider.toUpperCase()}_API_KEY`, currentKey);
      const result = await secureKeyStore.testConnection(selectedProvider);
      
      if (result.success) {
        Alert.alert('Successo', result.message);
      } else {
        Alert.alert('Errore', result.error);
      }
    } catch (error) {
      Alert.alert('Errore', 'Test di connessione fallito');
    } finally {
      setTesting(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Conferma',
      'Vuoi resettare tutte le impostazioni? Perderai tutte le API keys salvate.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await envLoader.resetAll();
            loadConfig();
            Alert.alert('Successo', 'Impostazioni resettate');
          },
        },
      ]
    );
  };

  const recommendation = getBeginnerRecommendation();
  const currentModels = getModelsForProvider(selectedProvider);

  if (loading && !apiKeys.groq) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Caricamento...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Impostazioni</Text>
          <Text style={styles.subtitle}>Configura Echo AI</Text>
        </View>

        {/* Provider Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Provider LLM</Text>
          <Text style={styles.sectionDesc}>
            Scegli il provider per l'intelligenza artificiale
          </Text>
          
          {getProviderList().map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              selected={selectedProvider === provider.id}
              onSelect={setSelectedProvider}
            />
          ))}

          {!envLoader.hasAnyProvider() && (
            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>💡 Consiglio per principianti</Text>
              <Text style={styles.tipText}>
                Inizia con {recommendation.provider.toUpperCase()} - è gratuito e veloce!
              </Text>
              <Text style={styles.tipLink}>
                Registrati su: {recommendation.signupUrl}
              </Text>
            </View>
          )}
        </View>

        {/* API Key for selected provider */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Key</Text>
          <Text style={styles.sectionDesc}>
            Inserisci la chiave API per {PROVIDERS[selectedProvider]?.name}
          </Text>
          
          <ApiKeyInput
            label={`API Key ${PROVIDERS[selectedProvider]?.name}`}
            value={apiKeys[selectedProvider]}
            onChangeText={(text) => setApiKeys({ ...apiKeys, [selectedProvider]: text })}
            placeholder={PROVIDERS[selectedProvider]?.keyPlaceholder}
            configured={!!apiKeys[selectedProvider]}
          />

          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestConnection}
            disabled={testing || !apiKeys[selectedProvider]}
          >
            {testing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.testButtonText}>Test Connessione</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Model Selection */}
        <View style={styles.section}>
          <ModelSelector
            models={currentModels}
            selected={models[selectedProvider]}
            onSelect={(model) => setModels({ ...models, [selectedProvider]: model })}
          />
        </View>

        {/* TTS Configuration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Text-to-Speech</Text>
          <Text style={styles.sectionDesc}>Configurazione voce (opzionale)</Text>
          
          <ApiKeyInput
            label="ElevenLabs API Key"
            value={elevenLabsKey}
            onChangeText={setElevenLabsKey}
            placeholder="Inserisci chiave ElevenLabs"
            configured={!!elevenLabsKey}
          />

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Voice ID</Text>
            <TextInput
              style={styles.input}
              value={elevenLabsVoice}
              onChangeText={setElevenLabsVoice}
              placeholder="EXAVITQu4vr4xnSDxMaL"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Salva Impostazioni</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleReset}
          >
            <Text style={styles.resetButtonText}>Reset Impostazioni</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    color: theme.colors.text,
    fontSize: 16,
  },
  scroll: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textMuted,
    marginTop: 8,
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 16,
  },
  providerCard: {
    backgroundColor: theme.colors.surface || '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  providerCardSelected: {
    borderColor: theme.colors.primary,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  providerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  providerName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  freeTag: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  freeTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  providerDesc: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginLeft: 24,
  },
  tipBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 8,
  },
  tipLink: {
    fontSize: 12,
    color: theme.colors.primary,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  configuredBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  configuredText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
  },
  input: {
    backgroundColor: theme.colors.surface || '#1a1a2e',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border || '#2a2a4a',
  },
  testButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  testButtonText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  modelContainer: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  modelChip: {
    backgroundColor: theme.colors.surface || '#1a1a2e',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.colors.border || '#2a2a4a',
  },
  modelChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  modelChipText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  modelChipTextSelected: {
    color: '#fff',
  },
  buttonContainer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  resetButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border || '#2a2a4a',
  },
  resetButtonText: {
    color: theme.colors.danger || '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 40,
  },
});
