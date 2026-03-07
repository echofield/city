// FLOW — Shared color system and style tokens
// Single source of truth for the entire instrument.

import type React from "react";

export const C = {
  bg: "#0a0a0b",
  surface: "#111114",
  surfaceHover: "#161619",
  surfaceRaised: "#18181c",
  border: "#1e1e24",
  borderActive: "#2a2a32",
  green: "#00B14F",
  greenDim: "#006830",
  greenBright: "#00D460",
  amber: "#C9A24A",
  amberDim: "#7a6230",
  gray: "#4a4a50",
  grayDim: "#2a2a30",
  red: "#a04040",
  redBright: "#cc4444",
  blue: "#4a7aaa",
  text: "#d0cdc8",
  textBright: "#eae8e4",
  textMid: "#8a8890",
  textDim: "#5a5a60",
  textGhost: "#333338",

  // Signal type colors
  signalEvent: "#8B5CF6",
  signalTransport: "#F97316",
  signalAirport: "#3B82F6",
  signalNightlife: "#EC4899",
  signalCompound: "#EF4444",
} as const;

// ── Typography presets ──

export const mono: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "0.75rem",
  fontWeight: 400,
};

export const label: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontSize: "0.75rem",
  fontWeight: 400,
};

export const heading: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 300,
  lineHeight: 1.1,
};

// Flow / Title — screen headers
export const flowTitle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: "0.6rem",
  letterSpacing: "0.3em",
  textTransform: "uppercase" as const,
  color: C.text,
};

// Flow / Signal Title — venue names
export const flowSignalTitle: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  lineHeight: 1.15,
  letterSpacing: "-0.01em",
  color: C.textBright,
};

// Flow / Signal Action — the dominant action verb
export const flowSignalAction: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  lineHeight: 1.15,
  letterSpacing: "-0.01em",
};

// Flow / Body — readable body text
export const flowBody: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 400,
  fontSize: "0.5rem",
  lineHeight: 1.4,
  color: C.textMid,
};

// Flow / Label — whispered section headers
export const flowLabel: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: 400,
  fontSize: "0.35rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase" as const,
  color: C.textGhost,
};

// Flow / Micro — smallest text (badges, tags)
export const flowMicro: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: 400,
  fontSize: "0.28rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};

// ── Spacing tokens ──

export const SP = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;