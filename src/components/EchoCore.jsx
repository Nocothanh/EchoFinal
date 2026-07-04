import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import theme from '../config/theme';

const STATE_ORDER = ['idle', 'listening', 'thinking', 'speaking'];

const STATE_PRESETS = {
  idle: {
    duration: 3600,
    scale: 1.03,
    ringScale: 1.08,
    glowOpacity: 0.55,
  },
  listening: {
    duration: 1450,
    scale: 1.08,
    ringScale: 1.16,
    glowOpacity: 0.88,
  },
  thinking: {
    duration: 2100,
    scale: 1.05,
    ringScale: 1.14,
    glowOpacity: 0.75,
  },
  speaking: {
    duration: 1200,
    scale: 1.12,
    ringScale: 1.2,
    glowOpacity: 0.92,
  },
};

function clampState(state) {
  return STATE_ORDER.includes(state) ? state : 'idle';
}

export default function EchoCore({ state = 'idle' }) {
  const currentState = clampState(state);
  const stateIndex = STATE_ORDER.indexOf(currentState);

  const pulse = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const spin = useSharedValue(0);
  const transition = useSharedValue(stateIndex);

  useEffect(() => {
    const preset = STATE_PRESETS[currentState];

    transition.value = withTiming(stateIndex, { duration: 420 });
    pulse.value = 0;
    shimmer.value = 0;
    spin.value = 0;

    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: preset.duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: preset.duration, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    shimmer.value = withRepeat(
      withTiming(1, { duration: Math.max(900, preset.duration * 0.75), easing: Easing.linear }),
      -1,
      false,
    );

    spin.value = withRepeat(
      withTiming(1, { duration: Math.max(1600, preset.duration), easing: Easing.linear }),
      -1,
      false,
    );
  }, [currentState, pulse, shimmer, spin, stateIndex, transition]);

  const accentColor = useDerivedValue(() =>
    interpolateColor(
      transition.value,
      [0, 1, 2, 3],
      [
        theme.state.idle.accent,
        theme.state.listening.accent,
        theme.state.thinking.accent,
        theme.state.speaking.accent,
      ],
    ),
  );

  const secondaryColor = useDerivedValue(() =>
    interpolateColor(
      transition.value,
      [0, 1, 2, 3],
      [
        theme.state.idle.accentSecondary,
        theme.state.listening.accentSecondary,
        theme.state.thinking.accentSecondary,
        theme.state.speaking.accentSecondary,
      ],
    ),
  );

  const coreStyle = useAnimatedStyle(() => {
    const preset = STATE_PRESETS[currentState];
    const scale = interpolate(pulse.value, [0, 1], [1, preset.scale]);

    return {
      transform: [{ scale }],
      backgroundColor: accentColor.value,
      shadowColor: accentColor.value,
      shadowOpacity: preset.glowOpacity,
      shadowRadius: 40 + pulse.value * 28,
      opacity: 0.95,
    };
  });

  const outerRingStyle = useAnimatedStyle(() => {
    const preset = STATE_PRESETS[currentState];
    const scale = interpolate(pulse.value, [0, 1], [preset.ringScale, preset.ringScale + 0.08]);
    const rotate = interpolate(spin.value, [0, 1], [0, 360]);

    return {
      transform: [{ scale }, { rotate: `${rotate}deg` }],
      borderColor: secondaryColor.value,
      opacity: 0.52 + pulse.value * 0.26,
    };
  });

  const innerRingStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [0, 1], [0.88, 0.96]);
    const rotate = interpolate(shimmer.value, [0, 1], [360, 0]);

    return {
      transform: [{ scale }, { rotate: `${rotate}deg` }],
      borderColor: accentColor.value,
      opacity: 0.3 + pulse.value * 0.35,
    };
  });

  const auraStyle = useAnimatedStyle(() => {
    const preset = STATE_PRESETS[currentState];
    return {
      backgroundColor: accentColor.value,
      opacity: 0.12 + pulse.value * 0.18,
      transform: [{ scale: 1 + pulse.value * 0.12 }],
      shadowColor: secondaryColor.value,
      shadowOpacity: preset.glowOpacity,
      shadowRadius: 60 + pulse.value * 30,
    };
  });

  return (
    <View style={styles.wrapper} pointerEvents="none">
      <Animated.View style={[styles.aura, auraStyle]} />
      <Animated.View style={[styles.outerRing, outerRingStyle]} />
      <Animated.View style={[styles.innerRing, innerRingStyle]} />
      <Animated.View style={[styles.core, coreStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aura: {
    position: 'absolute',
    width: 196,
    height: 196,
    borderRadius: 98,
  },
  outerRing: {
    position: 'absolute',
    width: 232,
    height: 232,
    borderRadius: 116,
    borderWidth: 1,
    borderStyle: 'solid',
  },
  innerRing: {
    position: 'absolute',
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 1,
    borderStyle: 'solid',
  },
  core: {
    width: 112,
    height: 112,
    borderRadius: 56,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
});
