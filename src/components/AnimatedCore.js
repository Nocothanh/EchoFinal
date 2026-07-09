/**
 * AnimatedCore.js - Cuore Animato JARVIS
 * Animazioni SVG reattive alla voce e allo stato dell'assistente
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Circle, Path, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useAnimatedStyle, withTiming, withRepeat, withSequence, interpolate } from 'react-native-reanimated';
import theme from '../config/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Colori per stato
const STATE_COLORS = {
  idle: { primary: '#3B82F6', secondary: '#1E40AF', glow: 'rgba(59, 130, 246, 0.3)' },
  listening: { primary: '#10B981', secondary: '#047857', glow: 'rgba(16, 185, 129, 0.5)' },
  thinking: { primary: '#F59E0B', secondary: '#D97706', glow: 'rgba(245, 158, 11, 0.5)' },
  speaking: { primary: '#8B5CF6', secondary: '#6D28D9', glow: 'rgba(139, 92, 246, 0.5)' },
  error: { primary: '#EF4444', secondary: '#B91C1C', glow: 'rgba(239, 68, 68, 0.5)' }
};

// Effetti sonori visivi
const WAVE_EFFECTS = {
  idle: { amplitude: 2, frequency: 0.5, speed: 1000 },
  listening: { amplitude: 8, frequency: 2, speed: 300 },
  thinking: { amplitude: 5, frequency: 1.5, speed: 500 },
  speaking: { amplitude: 12, frequency: 3, speed: 200 },
  error: { amplitude: 3, frequency: 0.8, speed: 800 }
};

export default function AnimatedCore({ 
  state = 'idle', 
  size = 200, 
  audioLevel = 0,
  onPress = null 
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  const colors = STATE_COLORS[state] || STATE_COLORS.idle;
  const effects = WAVE_EFFECTS[state] || WAVE_EFFECTS.idle;

  // Animazione pulsante
  useEffect(() => {
    if (state === 'idle') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true
          })
        ])
      ).start();
    } else if (state === 'listening') {
      Animated.loop(
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ).start();
    } else if (state === 'thinking') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true
          })
        ])
      ).start();
    } else if (state === 'speaking') {
      Animated.loop(
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

  // Animazione rotazione (per thinking)
  useEffect(() => {
    if (state === 'thinking') {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [state]);

  // Animazione onde audio
  useEffect(() => {
    if (state === 'speaking' || state === 'listening') {
      Animated.loop(
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: effects.speed,
          easing: Easing.linear,
          useNativeDriver: true
        })
      ).start();
    } else {
      waveAnim.setValue(0);
    }
  }, [state]);

  // Animazione glow
  useEffect(() => {
    if (state === 'speaking') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.8,
            duration: 500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true
          }),
          Animated.timing(glowAnim, {
            toValue: 0.3,
            duration: 500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true
          })
        ])
      ).start();
    } else {
      glowAnim.setValue(0.3);
    }
  }, [state]);

  // Calcola onde basate su audio level
  const waves = useMemo(() => {
    const waveCount = 3;
    const waveData = [];
    
    for (let i = 0; i < waveCount; i++) {
      const baseRadius = (size / 2 - 20) + (i * 15);
      const amplitude = effects.amplitude * (audioLevel || 1) * (1 - i * 0.2);
      waveData.push({
        radius: baseRadius,
        amplitude,
        frequency: effects.frequency + i * 0.5,
        delay: i * 100
      });
    }
    
    return waveData;
  }, [size, effects, audioLevel]);

  const animatedScale = {
    transform: [{ scale: pulseAnim }]
  };

  const animatedRotate = {
    transform: [{ rotate: rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg']
    })}]
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View style={[styles.svgContainer, animatedScale]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <RadialGradient id="glowGradient" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.glow} />
              <Stop offset="100%" stopColor="transparent" />
            </RadialGradient>
            <RadialGradient id="coreGradient" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.primary} />
              <Stop offset="100%" stopColor={colors.secondary} />
            </RadialGradient>
          </Defs>

          {/* Glow esterno */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 10}
            fill="url(#glowGradient)"
            opacity={glowAnim}
          />

          {/* Onde audio */}
          {waves.map((wave, index) => (
            <Circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={wave.radius}
              fill="none"
              stroke={colors.primary}
              strokeWidth={2}
              opacity={0.3 - index * 0.1}
              strokeDasharray={`${wave.amplitude} ${wave.frequency}`}
            />
          ))}

          {/* Cerchio principale */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 40}
            fill="url(#coreGradient)"
            opacity={0.9}
          />

          {/* Cerchio interno */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 60}
            fill={colors.primary}
            opacity={0.7}
          />

          {/* Centro brillante */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={15}
            fill="white"
            opacity={0.9}
          />

          {/* Anelli decorativi */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - 25}
            fill="none"
            stroke={colors.primary}
            strokeWidth={1}
            opacity={0.5}
            strokeDasharray="5 3"
          />
        </Svg>
      </Animated.View>

      {/* Overlay per touch */}
      {onPress && (
        <View style={styles.touchOverlay}>
          <Animated.View style={styles.touchIndicator} />
        </View>
      )}
    </View>
  );
}

// Componente per visualizzazione onde audio inline
export function AudioWaveform({ 
  audioLevel = 0, 
  barCount = 20, 
  color = '#3B82F6',
  height = 50,
  style = {} 
}) {
  const bars = useMemo(() => {
    return Array.from({ length: barCount }, (_, i) => ({
      id: i,
      baseHeight: Math.random() * height * 0.3 + height * 0.1,
      delay: i * 50
    }));
  }, [barCount, height]);

  return (
    <View style={[styles.waveformContainer, style]}>
      {bars.map((bar) => {
        const barHeight = bar.baseHeight + (audioLevel * height * 0.6);
        return (
          <Animated.View
            key={bar.id}
            style={[
              styles.waveformBar,
              {
                height: Math.min(barHeight, height),
                backgroundColor: color,
                opacity: 0.5 + audioLevel * 0.5
              }
            ]}
          />
        );
      })}
    </View>
  );
}

// Componente per indicatore stato
export function StatusIndicator({ state = 'idle', size = 12, style = {} }) {
  const color = STATE_COLORS[state]?.primary || STATE_COLORS.idle.primary;
  
  return (
    <View style={[styles.statusIndicator, style]}>
      <View style={[styles.statusDot, { 
        width: size, 
        height: size, 
        backgroundColor: color,
        borderRadius: size / 2
      }]} />
      <View style={[styles.statusPulse, { 
        width: size * 2, 
        height: size * 2, 
        borderColor: color,
        borderRadius: size
      }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  svgContainer: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  touchOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center'
  },
  touchIndicator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2
  },
  waveformBar: {
    width: 4,
    borderRadius: 2
  },
  statusIndicator: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusDot: {
    position: 'absolute'
  },
  statusPulse: {
    borderWidth: 1,
    opacity: 0.3
  }
});

export { STATE_COLORS, WAVE_EFFECTS };
