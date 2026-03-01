// FLOW — Shared color system and style tokens
// Single source of truth for the entire instrument.

import type React from "react";

export const C = {
  bg: "#0a0a0b",
  surface: "#111114",
  surfaceHover: "#161619",
  border: "#1e1e24",
  green: "#00B14F",
  greenDim: "#006830",
  greenBright: "#00D460",
  amber: "#C9A24A",
  amberDim: "#7a6230",
  gray: "#4a4a50",
  grayDim: "#2a2a30",
  red: "#a04040",
  text: "#d0cdc8",
  textMid: "#8a8890",
  textDim: "#5a5a60",
  textGhost: "#333338",
} as const;

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