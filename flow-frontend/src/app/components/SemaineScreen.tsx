// FLOW — SEMAINE Screen
// Weekly strategic briefing, not an event calendar
// Macro field intelligence → Zone rhythms → Event distortions → Money windows

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { WeekCalendar, WeekSignal } from "../types/signal";
import { C, mono, label } from "./theme";

// ── Types for macro analysis ──

interface WeekMacroAnalysis {
  overallTone: "calme" | "soutenu" | "intense" | "exceptionnel";
  strongZones: string[];
  weakZones: string[];
  bestCorridor: "nord" | "est" | "sud" | "ouest" | "centre";
  bestTimeSlot: "jour" | "soir" | "nuit";
  eventImpact: "faible" | "modere" | "fort" | "tres_fort";
  keyEvents: string[];
  strategicAdvice: string;
}

// ── Helpers ──

function getDemandColor(demand: "low" | "medium" | "high" | "very_high"): string {
  switch (demand) {
    case "very_high": return C.green;
    case "high": return C.greenBright;
    case "medium": return C.amber;
    case "low": return C.textDim;
  }
}

function getDemandLabel(demand: "low" | "medium" | "high" | "very_high"): string {
  switch (demand) {
    case "very_high": return "TRES FORTE";
    case "high": return "FORTE";
    case "medium": return "MODEREE";
    case "low": return "FAIBLE";
  }
}

// ── Analyze week macro patterns ──

function analyzeWeekMacro(calendar: WeekCalendar): WeekMacroAnalysis {
  const allSignals = calendar.days.flatMap(d => d.signals);
  const premiumNights = calendar.days.filter(d => d.is_premium).length;

  // Overall tone
  let overallTone: WeekMacroAnalysis["overallTone"] = "calme";
  if (premiumNights >= 4) overallTone = "exceptionnel";
  else if (premiumNights >= 2) overallTone = "intense";
  else if (premiumNights >= 1 || allSignals.length >= 8) overallTone = "soutenu";

  // Zone strength analysis
  const zoneStrength: Record<string, number> = {};
  for (const signal of allSignals) {
    const zone = signal.zone || "centre";
    zoneStrength[zone] = (zoneStrength[zone] || 0) + signal.intensity;
  }
  const sortedZones = Object.entries(zoneStrength).sort((a, b) => b[1] - a[1]);
  const strongZones = sortedZones.slice(0, 3).map(([z]) => z);
  const weakZones = sortedZones.length > 3 ? sortedZones.slice(-2).map(([z]) => z) : [];

  // Best corridor from zone distribution
  const corridorMap: Record<string, string[]> = {
    nord: ["17", "18", "19", "9", "10", "montmartre", "pigalle"],
    est: ["11", "12", "20", "3", "4", "bastille", "nation", "bercy"],
    sud: ["13", "14", "5", "6", "montparnasse", "italie"],
    ouest: ["16", "15", "7", "8", "defense", "champs", "etoile"],
    centre: ["1", "2", "opera", "chatelet", "marais"],
  };
  const corridorScores: Record<string, number> = { nord: 0, est: 0, sud: 0, ouest: 0, centre: 0 };
  for (const signal of allSignals) {
    const zoneLower = (signal.zone || "").toLowerCase();
    for (const [corr, zones] of Object.entries(corridorMap)) {
      if (zones.some(z => zoneLower.includes(z))) {
        corridorScores[corr] += signal.intensity;
        break;
      }
    }
  }
  const bestCorridor = (Object.entries(corridorScores).sort((a, b) => b[1] - a[1])[0]?.[0] || "centre") as WeekMacroAnalysis["bestCorridor"];

  // Best time slot
  const timeScores = { jour: 0, soir: 0, nuit: 0 };
  for (const signal of allSignals) {
    const start = signal.time_window.start || "";
    const hour = parseInt(start.split(":")[0] || "0", 10);
    if (hour >= 6 && hour < 18) timeScores.jour += signal.intensity;
    else if (hour >= 18 && hour < 24) timeScores.soir += signal.intensity;
    else timeScores.nuit += signal.intensity;
  }
  const bestTimeSlot = (Object.entries(timeScores).sort((a, b) => b[1] - a[1])[0]?.[0] || "soir") as WeekMacroAnalysis["bestTimeSlot"];

  // Event impact analysis
  const eventSignals = allSignals.filter(s =>
    s.type === "event_exit" ||
    s.reason?.toLowerCase().includes("concert") ||
    s.reason?.toLowerCase().includes("match") ||
    s.reason?.toLowerCase().includes("spectacle")
  );
  let eventImpact: WeekMacroAnalysis["eventImpact"] = "faible";
  if (eventSignals.length >= 8) eventImpact = "tres_fort";
  else if (eventSignals.length >= 5) eventImpact = "fort";
  else if (eventSignals.length >= 2) eventImpact = "modere";

  // Key events (unique venues)
  const keyEvents = [...new Set(eventSignals.map(s => {
    const venue = s.title || s.zone || "";
    // Extract venue name, not generic
    if (venue.toLowerCase().includes("stade")) return "Stade de France";
    if (venue.toLowerCase().includes("bercy") || venue.toLowerCase().includes("accor")) return "Accor Arena";
    if (venue.toLowerCase().includes("zenith")) return "Zenith";
    if (venue.toLowerCase().includes("olympia")) return "Olympia";
    if (venue.toLowerCase().includes("defense arena")) return "La Defense Arena";
    return venue;
  }))].slice(0, 4);

  // Strategic advice
  let strategicAdvice = "";
  if (overallTone === "exceptionnel") {
    strategicAdvice = `Semaine exceptionnelle. Priorite corridor ${bestCorridor.toUpperCase()} le ${bestTimeSlot}. Plusieurs events majeurs amplifient la demande.`;
  } else if (overallTone === "intense") {
    strategicAdvice = `Bonne semaine. ${bestTimeSlot === "soir" ? "Soirees" : bestTimeSlot === "nuit" ? "Nuits" : "Journees"} chargees vers ${bestCorridor.toUpperCase()}.`;
  } else if (overallTone === "soutenu") {
    strategicAdvice = `Semaine reguliere. Opportunites concentrees ${bestTimeSlot === "soir" ? "en soiree" : bestTimeSlot === "nuit" ? "la nuit" : "la journee"}.`;
  } else {
    strategicAdvice = "Semaine calme. Surveiller les fenetres ponctuelles.";
  }

  return {
    overallTone,
    strongZones,
    weakZones,
    bestCorridor,
    bestTimeSlot,
    eventImpact,
    keyEvents,
    strategicAdvice,
  };
}

// ── Week Briefing Header ──

function WeekBriefing({ calendar }: { calendar: WeekCalendar }) {
  const analysis = analyzeWeekMacro(calendar);

  const toneLabels = {
    calme: "CALME",
    soutenu: "SOUTENUE",
    intense: "INTENSE",
    exceptionnel: "EXCEPTIONNELLE",
  };
  const toneColors = {
    calme: C.textDim,
    soutenu: C.amber,
    intense: C.green,
    exceptionnel: C.greenBright,
  };

  const timeLabels = {
    jour: "JOURNEES",
    soir: "SOIREES",
    nuit: "NUITS",
  };

  const eventLabels = {
    faible: "Peu d'events",
    modere: "Events ponctuels",
    fort: "Plusieurs events majeurs",
    tres_fort: "Semaine evenementielle",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 py-4"
      style={{
        backgroundColor: `${toneColors[analysis.overallTone]}08`,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="uppercase tracking-[0.12em]"
          style={{
            ...label,
            fontSize: "0.5rem",
            color: C.textGhost,
          }}
        >
          BRIEFING SEMAINE
        </span>
        <span
          className="uppercase tracking-[0.1em] px-2 py-0.5"
          style={{
            ...label,
            fontSize: "0.55rem",
            fontWeight: 600,
            color: toneColors[analysis.overallTone],
            backgroundColor: `${toneColors[analysis.overallTone]}15`,
            borderRadius: 2,
          }}
        >
          {toneLabels[analysis.overallTone]}
        </span>
      </div>

      {/* Strategic advice */}
      <p
        style={{
          ...label,
          fontSize: "0.9rem",
          color: C.text,
          lineHeight: 1.4,
          marginBottom: 12,
        }}
      >
        {analysis.strategicAdvice}
      </p>

      {/* Macro indicators */}
      <div className="flex flex-wrap gap-3 mb-3">
        {/* Best corridor */}
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: "0.85rem" }}>
            {analysis.bestCorridor === "nord" ? "↑" :
             analysis.bestCorridor === "sud" ? "↓" :
             analysis.bestCorridor === "est" ? "→" :
             analysis.bestCorridor === "ouest" ? "←" : "◎"}
          </span>
          <span style={{ ...label, fontSize: "0.7rem", color: C.textMid }}>
            {analysis.bestCorridor.toUpperCase()}
          </span>
        </div>

        {/* Best time */}
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: "0.75rem" }}>⏰</span>
          <span style={{ ...label, fontSize: "0.7rem", color: C.textMid }}>
            {timeLabels[analysis.bestTimeSlot]}
          </span>
        </div>

        {/* Event impact */}
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: "0.75rem" }}>
            {analysis.eventImpact === "tres_fort" ? "🔥" :
             analysis.eventImpact === "fort" ? "🎭" : "📍"}
          </span>
          <span style={{ ...label, fontSize: "0.7rem", color: C.textMid }}>
            {eventLabels[analysis.eventImpact]}
          </span>
        </div>
      </div>

      {/* Strong zones */}
      {analysis.strongZones.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="uppercase tracking-[0.08em]"
            style={{ ...label, fontSize: "0.5rem", color: C.textGhost }}
          >
            ZONES FORTES:
          </span>
          {analysis.strongZones.map((zone, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5"
              style={{
                ...label,
                fontSize: "0.6rem",
                color: C.green,
                backgroundColor: `${C.green}10`,
                borderRadius: 2,
              }}
            >
              {zone}
            </span>
          ))}
        </div>
      )}

      {/* Key events */}
      {analysis.keyEvents.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-2">
          <span
            className="uppercase tracking-[0.08em]"
            style={{ ...label, fontSize: "0.5rem", color: C.textGhost }}
          >
            EVENTS:
          </span>
          {analysis.keyEvents.map((event, i) => (
            <span
              key={i}
              style={{
                ...label,
                fontSize: "0.6rem",
                color: C.textDim,
              }}
            >
              {event}{i < analysis.keyEvents.length - 1 ? " ·" : ""}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Day Summary Row ──

function DaySummaryRow({
  day,
  isExpanded,
  onToggle,
}: {
  day: WeekCalendar["days"][0];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const topSignal = day.signals[0];
  const signalCount = day.signals.length;

  // Compute day intensity
  const totalIntensity = day.signals.reduce((sum, s) => sum + s.intensity, 0);
  const avgIntensity = signalCount > 0 ? totalIntensity / signalCount : 0;

  // Day context
  const dayContext = topSignal
    ? generateDayContext(topSignal, day.signals)
    : "Journee calme";

  // Best window time
  const bestWindow = topSignal?.time_window.label || topSignal?.time_window.start || "";

  return (
    <motion.div
      layout
      className="overflow-hidden"
      style={{
        backgroundColor: C.surface,
        border: `1px solid ${day.is_premium ? C.greenDim : C.border}`,
        borderRadius: 4,
        borderLeft: day.is_premium ? `3px solid ${C.green}` : `3px solid transparent`,
      }}
    >
      {/* Row header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 text-left flex items-center justify-between"
        style={{
          backgroundColor: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        <div className="flex items-center gap-3">
          {/* Day name */}
          <span
            style={{
              ...label,
              fontSize: "0.95rem",
              fontWeight: 500,
              color: C.text,
              minWidth: 70,
            }}
          >
            {day.day_label}
          </span>

          {/* Context */}
          <span
            className="truncate"
            style={{
              ...label,
              fontSize: "0.75rem",
              color: C.textDim,
              maxWidth: 200,
            }}
          >
            {dayContext}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Window count */}
          {signalCount > 0 && (
            <span
              style={{
                ...mono,
                fontSize: "0.65rem",
                color: C.textGhost,
              }}
            >
              {signalCount} fenetre{signalCount > 1 ? "s" : ""}
            </span>
          )}

          {/* Intensity indicator */}
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4].map((level) => (
              <div
                key={level}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  backgroundColor: level <= avgIntensity
                    ? avgIntensity >= 3 ? C.green : C.amber
                    : `${C.textGhost}30`,
                }}
              />
            ))}
          </div>

          {/* Chevron */}
          <span
            style={{
              color: C.textGhost,
              fontSize: "0.8rem",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          >
            ▾
          </span>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && day.signals.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4"
            style={{ borderTop: `1px solid ${C.border}` }}
          >
            <div className="pt-3 flex flex-col gap-2">
              {day.signals.map((signal, i) => (
                <SignalWindowRow key={signal.id || i} signal={signal} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Signal Window Row (in expanded day) ──

function SignalWindowRow({ signal }: { signal: WeekSignal }) {
  const demandColor = getDemandColor(signal.earning_potential);

  // Generate ride type hint
  const rideType = getRideTypeHint(signal);

  return (
    <div
      className="flex items-center gap-3 px-3 py-2"
      style={{
        backgroundColor: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 3,
      }}
    >
      {/* Time */}
      <span
        style={{
          ...mono,
          fontSize: "0.75rem",
          color: C.textMid,
          minWidth: 50,
        }}
      >
        {signal.time_window.start || signal.time_window.label}
      </span>

      {/* Zone + cause */}
      <div className="flex-1 min-w-0">
        <span
          className="block truncate"
          style={{
            ...label,
            fontSize: "0.8rem",
            color: C.text,
          }}
        >
          {signal.zone || signal.title}
        </span>
        <span
          className="block truncate"
          style={{
            ...label,
            fontSize: "0.65rem",
            color: C.textDim,
          }}
        >
          {signal.reason || "Demande elevee"}
        </span>
      </div>

      {/* Ride type hint */}
      <span
        className="px-1.5 py-0.5 uppercase tracking-[0.05em]"
        style={{
          ...label,
          fontSize: "0.5rem",
          color: C.textDim,
          backgroundColor: `${C.textGhost}20`,
          borderRadius: 2,
        }}
      >
        {rideType}
      </span>

      {/* Demand */}
      <span
        className="uppercase tracking-[0.05em]"
        style={{
          ...label,
          fontSize: "0.55rem",
          color: demandColor,
        }}
      >
        {getDemandLabel(signal.earning_potential).split(" ")[0]}
      </span>
    </div>
  );
}

// ── Context generators ──

function generateDayContext(topSignal: WeekSignal, allSignals: WeekSignal[]): string {
  const zones = [...new Set(allSignals.map(s => s.zone))].slice(0, 2);
  const reason = topSignal.reason || "";

  // Event-based context
  if (reason.toLowerCase().includes("concert")) {
    return `Concert ${zones[0] || "Paris"}`;
  }
  if (reason.toLowerCase().includes("match")) {
    return `Match ${zones[0] || ""}`;
  }
  if (reason.toLowerCase().includes("spectacle") || reason.toLowerCase().includes("theatre")) {
    return `Sorties spectacles`;
  }

  // Time-based context
  const hour = parseInt(topSignal.time_window.start?.split(":")[0] || "20", 10);
  if (hour >= 22 || hour < 6) {
    return `Nuit active ${zones.join(" / ") || "centre"}`;
  }
  if (hour >= 18) {
    return `Soiree ${zones.join(" / ") || "Paris"}`;
  }

  // Zone-based fallback
  if (zones.length > 0) {
    return `Activite ${zones.join(" / ")}`;
  }

  return "Demande standard";
}

function getRideTypeHint(signal: WeekSignal): string {
  const reason = (signal.reason || "").toLowerCase();
  const zone = (signal.zone || "").toLowerCase();
  const title = (signal.title || "").toLowerCase();

  // Airport
  if (zone.includes("cdg") || zone.includes("orly") || reason.includes("aeroport")) {
    return "AERO";
  }

  // Train station
  if (zone.includes("gare") || reason.includes("train")) {
    return "GARE";
  }

  // Concert/Event
  if (reason.includes("concert") || title.includes("concert")) {
    return "EVENT";
  }

  // Nightlife
  if (reason.includes("club") || reason.includes("nuit") || reason.includes("sortie")) {
    return "NUIT";
  }

  // Restaurant
  if (reason.includes("restaurant") || reason.includes("diner")) {
    return "RESTO";
  }

  // Business
  if (reason.includes("affaires") || reason.includes("bureau")) {
    return "PRO";
  }

  // Default based on time
  const hour = parseInt(signal.time_window.start?.split(":")[0] || "20", 10);
  if (hour >= 22 || hour < 6) return "NUIT";
  if (hour >= 18) return "SOIR";
  return "JOUR";
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
          Analyse de la semaine...
        </span>
      </div>
    );
  }

  // Sort days by premium status + signal count
  const sortedDays = [...weekCalendar.days].sort((a, b) => {
    if (a.is_premium !== b.is_premium) return a.is_premium ? -1 : 1;
    return b.signals.length - a.signals.length;
  });

  const totalWindows = weekCalendar.days.reduce((sum, d) => sum + d.signals.length, 0);
  const premiumNights = weekCalendar.days.filter(d => d.is_premium).length;

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
        <div className="flex items-center gap-3">
          <span
            style={{
              ...mono,
              fontSize: "0.65rem",
              color: C.textDim,
            }}
          >
            {totalWindows} fenetres
          </span>
          {premiumNights > 0 && (
            <span
              className="px-1.5 py-0.5"
              style={{
                ...label,
                fontSize: "0.5rem",
                color: C.green,
                backgroundColor: `${C.green}12`,
                borderRadius: 2,
              }}
            >
              {premiumNights} nuit{premiumNights > 1 ? "s" : ""} premium
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Week briefing */}
        <WeekBriefing calendar={weekCalendar} />

        {/* Day rows */}
        <div className="px-4 py-4 flex flex-col gap-2">
          {sortedDays.map((day) => (
            <DaySummaryRow
              key={day.day_of_week}
              day={day}
              isExpanded={expandedDay === day.day_of_week}
              onToggle={() =>
                setExpandedDay(
                  expandedDay === day.day_of_week ? null : day.day_of_week
                )
              }
            />
          ))}

          {sortedDays.length === 0 && (
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
