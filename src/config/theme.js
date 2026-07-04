export const theme = {
  colors: {
    background: '#05060a',
    backgroundElevated: '#0a0f1c',
    surface: '#0d1220',
    surfaceSoft: '#111827',
    border: 'rgba(148, 163, 184, 0.14)',
    text: '#e2e8f0',
    textMuted: '#94a3b8',
    textDim: '#64748b',
    primary: '#8b5cf6',
    primarySoft: 'rgba(139, 92, 246, 0.2)',
    cyan: '#22d3ee',
    amber: '#f59e0b',
    speaking: '#a855f7',
    speakingAlt: '#22c55e',
    danger: '#fb7185',
    success: '#34d399',
  },
  state: {
    idle: {
      accent: '#22d3ee',
      accentSecondary: '#8b5cf6',
    },
    listening: {
      accent: '#22d3ee',
      accentSecondary: '#67e8f9',
    },
    thinking: {
      accent: '#f59e0b',
      accentSecondary: '#fbbf24',
    },
    speaking: {
      accent: '#a855f7',
      accentSecondary: '#22c55e',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  radii: {
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
    round: 999,
  },
  fonts: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
    mono: 'Courier',
  },
};

export default theme;
