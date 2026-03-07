// FLOW — SEMAINE Screen
// Money calendar: plan your week by earning potential
// Each window is expandable with zones, strategy, amplifiers

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { WeekCalendar, WeekSignal } from "../types/signal";
import { C, mono, label } from "./theme";

// ── Helpers ──

function getDemandColor(
  demand: "low" | "medium" | "high" | "very_high"
): string {
  switch (demand) {
    case "very_high": return C.green;
    case "high": return C.greenBright;
    case "medium": return C.amber;
    case "low": return C.textDim;
  }
}

function getDemandLabel(
  demand: "low" | "medium" | "high" | "very_high"
): string {
  switch (demand) {
    case "very_high": return "TRES FORTE";
    case "high": return "FORTE";
    case "medium": return "MODEREE";
    case "low": return "FAIBLE";
  }
}

function getConfidenceLabel(confidence: string): string {
  switch (confidence) {
    case "high": return "HAUTE";
    case "medium": return "MOYENNE";
    case "low": return "FAIBLE";
    default: return confidence.toUpperCase();
  }
}

// ── Generate default strategy if missing ──

function getStrategy(signal: WeekSignal): string {
  // Use provided strategy if available
  if (signal.strategy && signal.strategy.trim().length > 0) {
    return signal.strategy;
  }

  // Generate default based on signal data
  const zone = signal.zone || "centre";
  const timeStart = signal.time_window.start || signal.time_window.label || "debut fenetre";

  // Commitment hint based on earning potential
  const commitment =
    signal.earning_potential === "very_high" ? "Prioritaire" :
    signal.earning_potential === "high" ? "Recommande" : "";

  // Duration hint if available
  const durationHint =
    signal.time_window.duration_minutes && signal.time_window.duration_minutes >= 90
      ? ` (${Math.round(signal.time_window.duration_minutes / 60)}h fenetre)`
      : "";

  const prefix = commitment ? `${commitment}. ` : "";
  return `${prefix}Position ${zone} avant ${timeStart}${durationHint}`;
}

// ── Best Night Card ──

function BestNightCard({
  bestNight,
  topSignal,
}: {
  bestNight: WeekCalendar["best_night"];
  topSignal?: WeekSignal;
}) {
  if (!bestNight) return null;

  const demandColor = getDemandColor(bestNight.expected_demand);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-5 py-5"
      style={{
        backgroundColor: C.surface,
        border: `1px solid ${C.greenDim}`,
        borderRadius: 4,
      }}
    >
      {/* Label */}
      <span
        className="block uppercase tracking-[0.15em] mb-2"
        style={{
          ...label,
          fontSize: "0.55rem",
          fontWeight: 500,
          color: C.green,
        }}
      >
        BEST NIGHT THIS WEEK
      </span>

      {/* Day */}
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "2.2rem",
          fontWeight: 400,
          color: C.text,
          margin: 0,
          lineHeight: 1.1,
        }}
      >
        {bestNight.day}
      </h2>

      {/* Reason */}
      <p
        className="mt-2"
        style={{
          ...label,
          fontSize: "0.85rem",
          color: C.textDim,
        }}
      >
        {bestNight.reason}
      </p>

      {/* Amplifiers */}
      {topSignal?.overlapping_factors && topSignal.overlapping_factors.length > 0 && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {topSignal.overlapping_factors.slice(0, 3).map((factor, i) => (
            <span
              key={i}
              className="px-2 py-1 uppercase tracking-[0.08em]"
              style={{
                ...label,
                fontSize: "0.5rem",
                color: C.amber,
                backgroundColor: `${C.amber}10`,
                border: `1px solid ${C.amberDim}`,
                borderRadius: 2,
              }}
            >
              {factor}
            </span>
          ))}
        </div>
      )}

      {/* Time window + demand */}
      {topSignal && (
        <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <span
            style={{
              ...mono,
              fontSize: "0.85rem",
              color: C.textMid,
            }}
          >
            {topSignal.time_window.label || `${topSignal.time_window.start} – ${topSignal.time_window.end || ""}`}
          </span>
          <span
            className="uppercase tracking-[0.1em]"
            style={{
              ...label,
              fontSize: "0.65rem",
              fontWeight: 500,
              color: demandColor,
            }}
          >
            DEMANDE ATTENDUE: {getDemandLabel(bestNight.expected_demand)}
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ── Money Window Card ──

function MoneyWindowCard({
  day,
  signals,
  isExpanded,
  onToggle,
}: {
  day: WeekCalendar["days"][0];
  signals: WeekSignal[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const topSignal = signals[0];
  if (!topSignal) return null;

  const demandColor = getDemandColor(topSignal.earning_potential);

  return (
    <motion.div
      layout
      className="overflow-hidden"
      style={{
        backgroundColor: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 4,
      }}
    >
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-4 text-left"
        style={{
          backgroundColor: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        {/* Top row */}
        <div className="flex items-start justify-between mb-1">
          <span
            className="uppercase tracking-[0.1em]"
            style={{
              ...label,
              fontSize: "0.5rem",
              color: C.textGhost,
            }}
          >
            MONEY WINDOW
          </span>
          <span
            style={{
              ...mono,
              fontSize: "0.7rem",
              color: C.textDim,
            }}
          >
            {topSignal.time_window.label || topSignal.time_window.start}
          </span>
        </div>

        {/* Day + title */}
        <div className="flex items-baseline gap-2 mb-1">
          <span
            style={{
              ...label,
              fontSize: "1.1rem",
              fontWeight: 500,
              color: C.text,
            }}
          >
            {day.day_label}
          </span>
          <span
            style={{
              ...label,
              fontSize: "0.8rem",
              color: C.textDim,
            }}
          >
            {topSignal.title}
          </span>
        </div>

        {/* Reason */}
        <p
          style={{
            ...label,
            fontSize: "0.75rem",
            color: C.textGhost,
            margin: 0,
          }}
        >
          {topSignal.reason}
        </p>

        {/* Demand + confidence row */}
        <div className="flex items-center justify-between mt-3">
          <span
            className="uppercase tracking-[0.08em]"
            style={{
              ...label,
              fontSize: "0.55rem",
              color: demandColor,
            }}
          >
            DEMANDE: {getDemandLabel(topSignal.earning_potential)}
          </span>
          <span
            className="uppercase tracking-[0.08em]"
            style={{
              ...label,
              fontSize: "0.55rem",
              color: C.textDim,
            }}
          >
            CONFIDENCE: {getConfidenceLabel(topSignal.confidence)}
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4"
            style={{ borderTop: `1px solid ${C.border}` }}
          >
            <div className="pt-3">
              {/* Zones */}
              <div className="mb-3">
                <span
                  className="block mb-1.5 uppercase tracking-[0.1em]"
                  style={{
                    ...label,
                    fontSize: "0.5rem",
                    color: C.textGhost,
                  }}
                >
                  ZONES
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="px-2 py-1"
                    style={{
                      ...label,
                      fontSize: "0.7rem",
                      color: C.text,
                      backgroundColor: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 2,
                    }}
                  >
                    {topSignal.zone}
                  </span>
                  {/* Show additional zones from other signals */}
                  {signals.slice(1, 4).map((s, i) => (
                    <span
                      key={i}
                      className="px-2 py-1"
                      style={{
                        ...label,
                        fontSize: "0.7rem",
                        color: C.textMid,
                        backgroundColor: C.bg,
                        border: `1px solid ${C.border}`,
                        borderRadius: 2,
                      }}
                    >
                      {s.zone}
                    </span>
                  ))}
                </div>
              </div>

              {/* Strategy - always shown, generated if missing */}
              <div className="mb-3">
                <span
                  className="block mb-1 uppercase tracking-[0.1em]"
                  style={{
                    ...label,
                    fontSize: "0.5rem",
                    color: C.textGhost,
                  }}
                >
                  STRATEGIE
                </span>
                <span
                  style={{
                    ...label,
                    fontSize: "0.8rem",
                    color: C.text,
                  }}
                >
                  {getStrategy(topSignal)}
                </span>
              </div>

              {/* Action recommendation */}
              <div className="mb-3">
                <span
                  className="block mb-1 uppercase tracking-[0.1em]"
                  style={{
                    ...label,
                    fontSize: "0.5rem",
                    color: C.textGhost,
                  }}
                >
                  ACTION
                </span>
                <span
                  style={{
                    ...label,
                    fontSize: "0.8rem",
                    color: C.text,
                  }}
                >
                  {topSignal.action}
                </span>
              </div>

              {/* Amplifiers */}
              {topSignal.overlapping_factors && topSignal.overlapping_factors.length > 0 && (
                <div>
                  <span
                    className="block mb-1.5 uppercase tracking-[0.1em]"
                    style={{
                      ...label,
                      fontSize: "0.5rem",
                      color: C.textGhost,
                    }}
                  >
                    AMPLIFIE
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {topSignal.overlapping_factors.map((factor, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 uppercase tracking-[0.06em]"
                        style={{
                          ...label,
                          fontSize: "0.5rem",
                          color: C.amber,
                          backgroundColor: `${C.amber}10`,
                          border: `1px solid ${C.amberDim}`,
                          borderRadius: 2,
                        }}
                      >
                        {factor}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── SEMAINE Screen ──

interface SemaineScreenProps {
  weekCalendar: WeekCalendar | null;
}

export function SemaineScreen({ weekCalendar }: SemaineScreenProps) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  if (!weekCalendar) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span
          style={{
            ...label,
            fontSize: "0.9rem",
            color: C.textGhost,
          }}
        >
          Calendrier en chargement...
        </span>
      </div>
    );
  }

  // Find best night's top signal
  const bestNightDay = weekCalendar.days.find(
    (d) => d.day_label === weekCalendar.best_night?.day
  );
  const bestNightTopSignal = bestNightDay?.signals[0];

  // Filter days with signals
  const daysWithSignals = weekCalendar.days.filter(
    (d) => d.signals.length > 0
  );

  // Count windows
  const windowCount = daysWithSignals.reduce(
    (sum, d) => sum + d.signals.length,
    0
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <span
          className="uppercase tracking-[0.2em]"
          style={{
            ...label,
            fontSize: "0.75rem",
            fontWeight: 500,
            color: C.text,
          }}
        >
          SEMAINE
        </span>
        <span
          style={{
            ...mono,
            fontSize: "0.7rem",
            color: C.textDim,
          }}
        >
          {windowCount} fenetres
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          {/* Best Night */}
          {weekCalendar.best_night && (
            <BestNightCard
              bestNight={weekCalendar.best_night}
              topSignal={bestNightTopSignal}
            />
          )}

          {/* Other days */}
          {daysWithSignals
            .filter((d) => d.day_label !== weekCalendar.best_night?.day)
            .map((day) => (
              <MoneyWindowCard
                key={day.day_of_week}
                day={day}
                signals={day.signals}
                isExpanded={expandedDay === day.day_of_week}
                onToggle={() =>
                  setExpandedDay(
                    expandedDay === day.day_of_week ? null : day.day_of_week
                  )
                }
              />
            ))}

          {/* Empty state */}
          {daysWithSignals.length === 0 && (
            <div className="py-12 text-center">
              <span
                style={{
                  ...label,
                  fontSize: "0.9rem",
                  color: C.textGhost,
                }}
              >
                Aucune fenetre prevue cette semaine
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
