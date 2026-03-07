// FLOW — Shared UI micro-components
// Reusable across LIVE, RADAR, CARTE, SEMAINE.
// No layout opinions — just atomic elements.
// Zero emoji. Color is the only language.

import type React from "react";
import { motion } from "motion/react";
import { C, mono, label, SP } from "./theme";

// ── Section Header — whispered, never shouted ──

export function SectionHeader({ text, style }: { text: string; style?: React.CSSProperties }) {
  return (
    <div className="pt-4 pb-1.5" style={style}>
      <span
        className="uppercase tracking-[0.25em]"
        style={{ ...mono, fontSize: "0.35rem", color: C.textGhost }}
      >
        {text}
      </span>
    </div>
  );
}

// ── Status Badge — the repeating badge pattern ──
// Used for: RARE, COMPOSE, VAGUE, HOLD, HUNT, FORMATION, ACTIVE, etc.

interface BadgeProps {
  text: string;
  color: string;
  /** Border color (defaults to color at 30% opacity) */
  borderColor?: string;
}

export function StatusBadge({ text, color, borderColor }: BadgeProps) {
  return (
    <span
      className="uppercase tracking-[0.08em]"
      style={{
        ...mono,
        fontSize: "0.28rem",
        color,
        padding: "1px 4px",
        border: `1px solid ${borderColor ?? `${color}30`}`,
        borderRadius: 2,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

// ── Action Line — ▸ MAINTENIR. / ▸ REJOINDRE. ──
// The dominant element in every card.

interface ActionLineProps {
  action: string;
  color: string;
  isHero?: boolean;
}

export function ActionLine({ action, color, isHero }: ActionLineProps) {
  return (
    <span
      style={{
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
        fontSize: isHero
          ? "clamp(1.1rem, 3.6vw, 1.45rem)"
          : "clamp(0.85rem, 2.8vw, 1.1rem)",
        color,
        lineHeight: 1.15,
        letterSpacing: "-0.01em",
      }}
    >
      {"\u25B8"} {action.toUpperCase()}
    </span>
  );
}

// ── Time Window Bar — visual countdown progress ──

export function WindowProgress({ start, end }: { start: string; end: string }) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const parseHM = (hm: string): Date => {
    const [h, m] = hm.split(":").map(Number);
    const d = new Date(`${today}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
    if (d.getTime() < now.getTime() - 12 * 3600000) d.setDate(d.getDate() + 1);
    return d;
  };

  const startTime = parseHM(start);
  const endTime = parseHM(end);
  if (endTime <= startTime) endTime.setDate(endTime.getDate() + 1);

  const total = endTime.getTime() - startTime.getTime();
  const elapsed = now.getTime() - startTime.getTime();
  const progress = total > 0 ? Math.max(0, Math.min(1, elapsed / total)) : 0;
  const fillPct = Math.round(progress * 100);
  const barColor = progress < 0.7 ? C.green : progress < 0.9 ? C.amber : C.red;

  return (
    <div className="flex-1 h-[3px] relative" style={{ backgroundColor: `${C.textGhost}30`, borderRadius: 1 }}>
      <motion.div
        className="h-full absolute left-0 top-0"
        style={{ backgroundColor: barColor, borderRadius: 1 }}
        initial={{ width: 0 }}
        animate={{ width: `${fillPct}%` }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </div>
  );
}

// ── Data Cell — labeled value pair (DEMANDE / FORTE) ──

interface DataCellProps {
  label: string;
  value: string;
  valueColor?: string;
}

export function DataCell({ label: lbl, value, valueColor = C.textMid }: DataCellProps) {
  return (
    <div className="flex flex-col gap-0">
      <span
        className="uppercase tracking-[0.15em]"
        style={{ ...mono, fontSize: "0.3rem", color: C.textGhost }}
      >
        {lbl}
      </span>
      <span style={{ ...label, fontSize: "0.5rem", color: valueColor }}>
        {value}
      </span>
    </div>
  );
}

// ── Score Bar — horizontal mini-bar (used in FMW panels) ──

interface ScoreBarProps {
  label: string;
  value: number; // 0-100
  labelWidth?: number;
}

export function ScoreBar({ label: lbl, value, labelWidth = 46 }: ScoreBarProps) {
  const barColor = value >= 60 ? C.green : value >= 35 ? C.amber : C.textDim;
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ ...mono, fontSize: "0.28rem", color: C.textGhost, width: labelWidth }}>
        {lbl}
      </span>
      <div style={{ flex: 1, height: 3, backgroundColor: C.border, borderRadius: 1, overflow: "hidden" }}>
        <div style={{
          width: `${value}%`,
          height: "100%",
          backgroundColor: barColor,
          borderRadius: 1,
        }} />
      </div>
    </div>
  );
}

// ── Screen Header — consistent header bar for all 4 screens ──

interface ScreenHeaderProps {
  title: string;
  /** Active dot pulsing */
  isActive?: boolean;
  /** Right side content */
  right?: React.ReactNode;
  /** Subtitle line below title */
  subtitle?: string;
}

export function ScreenHeader({ title, isActive, right, subtitle }: ScreenHeaderProps) {
  return (
    <div
      className="shrink-0 flex items-center justify-between"
      style={{
        padding: `${SP.sm}px ${SP.lg}px`,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div className="flex flex-col gap-0">
        <div className="flex items-center gap-2.5">
          <span
            className="uppercase tracking-[0.3em]"
            style={{ ...label, fontSize: "0.6rem", fontWeight: 500, color: C.text }}
          >
            {title}
          </span>
          {isActive !== undefined && (
            <motion.div
              animate={isActive ? {
                scale: [1, 1.3, 1],
                opacity: [0.4, 0.8, 0.4],
              } : {}}
              transition={{ duration: 3, repeat: Infinity }}
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                backgroundColor: isActive ? C.green : C.textDim,
              }}
            />
          )}
        </div>
        {subtitle && (
          <span
            className="uppercase tracking-[0.15em]"
            style={{ ...mono, fontSize: "0.3rem", color: C.textGhost }}
          >
            {subtitle}
          </span>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

// ── Card Container — consistent card wrapper ──

interface CardContainerProps {
  children: React.ReactNode;
  borderColor?: string;
  borderWidth?: number;
  isHero?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function CardContainer({
  children,
  borderColor,
  borderWidth = 2,
  isHero,
  onClick,
  className = "",
  style,
}: CardContainerProps) {
  return (
    <div
      className={`flex flex-col ${className}`}
      onClick={onClick}
      style={{
        backgroundColor: isHero ? C.surfaceRaised : C.surface,
        borderLeft: borderColor ? `${isHero ? 3 : borderWidth}px solid ${borderColor}` : undefined,
        borderRadius: 2,
        overflow: "hidden",
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
