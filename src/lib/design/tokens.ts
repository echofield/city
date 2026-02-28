/**
 * City Flow Intelligence - Design Tokens
 * Inspired by OPÉRA Meridien system
 */

export const colors = {
  // Base
  void: '#070A0B',
  surface: '#0B0F10',
  surfaceRaised: '#101516',
  surfaceGlass: 'rgba(16, 21, 22, 0.85)',

  // Typography
  textPrimary: '#E7ECEB',
  textSecondary: '#9AA4A1',
  textGhost: 'rgba(231, 236, 235, 0.35)',
  textWhisper: 'rgba(231, 236, 235, 0.15)',

  // Signal Green (Flow accent)
  signal: '#00B14F',
  signalDark: '#00893C',
  signalGlow: 'rgba(0, 177, 79, 0.15)',

  // Intent Gold (Field accent)
  intent: '#C9A24A',
  intentDark: '#A38433',
  intentGlow: 'rgba(201, 162, 74, 0.12)',

  // Status
  alert: '#C45C3E',
  alertGlow: 'rgba(196, 92, 62, 0.12)',
  calm: '#4A7B6A',

  // Borders
  border: 'rgba(154, 164, 161, 0.12)',
  borderSubtle: 'rgba(154, 164, 161, 0.06)',
} as const

export const typography = {
  fontSans: '"Inter", system-ui, sans-serif',
  fontMono: '"JetBrains Mono", monospace',

  // Font sizes
  size: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '2rem',    // 32px
  },

  // Line heights
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.75',
  },

  // Letter spacing
  letterSpacing: {
    tight: '-0.01em',
    normal: '0',
    wide: '0.05em',
    wider: '0.1em',
  },
} as const

export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
} as const

export const motion = {
  duration: {
    fast: '150ms',
    base: '300ms',
    slow: '600ms',
    gentle: '1400ms',
  },
  easing: {
    out: 'cubic-bezier(0.22, 1, 0.36, 1)',
    inOut: 'cubic-bezier(0.45, 0, 0.55, 1)',
  },
} as const

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  md: '0 4px 12px rgba(0, 0, 0, 0.4)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.5)',
  glow: {
    signal: '0 0 20px rgba(0, 177, 79, 0.2)',
    intent: '0 0 20px rgba(201, 162, 74, 0.15)',
    alert: '0 0 20px rgba(196, 92, 62, 0.15)',
  },
} as const
