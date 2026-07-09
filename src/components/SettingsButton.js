/**
 * SettingsButton.js - Pulsante per aprire le impostazioni
 * Posizionato nell'angolo della schermata principale
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import theme from '../config/theme';

export default function SettingsButton({ onPress, configured = false }) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name="settings-outline"
          size={24}
          color={theme.colors.textMuted}
        />
        {!configured && <View style={styles.badge} />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 100,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface || 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
});
