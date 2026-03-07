// FLOW — CARTE Screen: Tactical Command Panel
// Split layout: Map + Command Panel.
// The command panel is the core: one glance, one decision.
// FENETRE ACTIVE timer creates urgency. OPP/FRIC/COST externalizes the calculation.
// NAVIGUER sends the driver. Wave phase shows timing context.
// Mobile: map top 45%, command panel below (scrollable).
// Desktop: map left, command panel right.
// Zero emoji. Color is the only language.

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FlowMap } from "./FlowMap";
import { C, mono, label } from "./theme";
import type { FlowSignal, FlowState, BanlieueHubState, CorridorStatus } from "./FlowEngine";
import { SignalIntensity } from "./SignalIntensity";
import {
  causeLabel,
  wazeUrl,
  rideLabelShort,
} from "./signal-helpers";

// ── Zone to Arrondissement mapping ──

const ZONE_ARR: Record<string, string> = {
  "Montmartre": "XVIII",
  "Pigalle": "XVIII",
  "Opera": "IX",
  "Chatelet": "I",
  "Bastille": "XI",
  "Nation": "XII",
  "Republique": "XI",
  "Saint-Germain": "VI",
  "Marais": "IV",
  "Belleville": "XX",
  "Oberkampf": "XI",
  "Gare du Nord": "X",
  "Gare de Lyon": "XII",
  "Montparnasse": "XIV",
  "Etoile": "VIII",
  "Champs-Elysees": "VIII",
  "La Defense": "92",
  "Bercy": "XII",
  "Invalides": "VII",
  "Place d'Italie": "XIII",
  "Trocadero": "XVI",
  "L'Olympia": "IX",
  "Zenith": "XIX",
  "Accor Arena": "XII",
  "Stade de France": "93",
  "CDG": "95",
  "Orly": "94",
};

// ── OPP / FRIC / COST scores ──

function computeScores(signal: FlowSignal) {
  const demandBonus = signal.demand_level === "very_high" ? 15
    : signal.demand_level === "high" ? 8
    : signal.demand_level === "moderate" ? 3 : 0;
  const opp = Math.min(99, Math.round(signal.confidence * 85) + demandBonus);

  let fric = 20;
  if (signal.concurrence === "forte") fric += 30;
  else if (signal.concurrence === "moderee") fric += 15;
  if (signal.forced_wave) {
    fric += Math.round((100 - signal.forced_wave.transport_weakness_score) * 0.3);
  }
  fric = Math.min(95, Math.max(5, fric));

  const cost = Math.min(85, Math.max(3, Math.round(signal.proximity_minutes * 3.5)));

  return { opp, fric, cost };
}

// ── Countdown timer from window end ──

function useWindowCountdown(signal: FlowSignal | null): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!signal) return "00:00";

  const today = new Date().toISOString().slice(0, 10);
  const [h, m] = signal.time_window.end.split(":").map(Number);
  const d = new Date(`${today}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
  if (d.getTime() < now - 12 * 3600000) d.setDate(d.getDate() + 1);

  const remaining = Math.max(0, d.getTime() - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// ── Wave Phase Indicator ──

const WAVE_PHASES = ["CALME", "MONTEE", "PIC", "DISPERSION"] as const;

function wavePhaseIndex(phase?: FlowSignal["wave_phase"]): number {
  switch (phase) {
    case "FORMATION": return 1;
    case "ACTIVE": return 2;
    case "DECAY": return 3;
    default: return 0;
  }
}

function WavePhaseBar({ phase }: { phase?: FlowSignal["wave_phase"] }) {
  const activeIdx = wavePhaseIndex(phase);

  return (
    <div className="flex items-center gap-0 w-full">
      {WAVE_PHASES.map((p, i) => {
        const isActive = i === activeIdx;
        const isPast = i < activeIdx;
        const phaseColor = isActive
          ? (i === 2 ? C.green : i === 1 ? C.amber : i === 3 ? C.textDim : C.textGhost)
          : isPast ? C.textDim : C.textGhost;

        return (
          <div key={p} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-center">
              {i > 0 && (
                <div className="flex-1 h-[2px]" style={{
                  backgroundColor: isPast || isActive ? C.textDim : `${C.textGhost}40`,
                }} />
              )}
              <div
                style={{
                  width: isActive ? 8 : 5,
                  height: isActive ? 8 : 5,
                  borderRadius: "50%",
                  backgroundColor: isActive ? phaseColor : isPast ? C.textDim : `${C.textGhost}40`,
                  border: isActive ? `1px solid ${phaseColor}60` : "none",
                  flexShrink: 0,
                }}
              />
              {i < WAVE_PHASES.length - 1 && (
                <div className="flex-1 h-[2px]" style={{
                  backgroundColor: isPast ? C.textDim : `${C.textGhost}40`,
                }} />
              )}
            </div>
            <span
              className="uppercase tracking-[0.1em]"
              style={{ ...mono, fontSize: "0.28rem", color: isActive ? phaseColor : C.textGhost }}
            >
              {p}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Score Box ──

function ScoreBox({ label: lbl, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex-1 flex flex-col items-center gap-0.5 py-2"
      style={{ border: `1px solid ${color}25`, borderRadius: 3 }}
    >
      <span
        className="uppercase tracking-[0.15em]"
        style={{ ...mono, fontSize: "0.3rem", color: C.textGhost }}
      >
        {lbl}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 400,
          fontSize: "1rem",
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Corridor Bar ──

function CorridorBar({ corridors }: { corridors: CorridorStatus[] }) {
  function statusColor(s: CorridorStatus["status"]): string {
    switch (s) {
      case "fluide": return C.textDim;
      case "dense": return C.amber;
      case "plein": return C.red;
    }
  }

  return (
    <div className="flex items-center gap-3">
      {corridors.map((c) => (
        <div key={c.direction} className="flex items-center gap-1">
          <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: statusColor(c.status) }} />
          <span
            className="uppercase tracking-[0.12em]"
            style={{ ...mono, fontSize: "0.35rem", color: statusColor(c.status) }}
          >
            {c.direction}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── EUR/h Estimate ──

function estimateEurPerHour(signal: FlowSignal): { low: number; high: number } {
  const base = signal.estimated_value ? parseInt(signal.estimated_value, 10) : 25;
  const modifier = signal.demand_level === "very_high" ? 1.5
    : signal.demand_level === "high" ? 1.2
    : signal.demand_level === "moderate" ? 1.0 : 0.8;
  const low = Math.round(base * modifier * 0.75);
  const high = Math.round(base * modifier * 1.3);
  return { low, high };
}

// ── Command Panel ──

function CommandPanel({ signal, flow }: { signal: FlowSignal; flow: FlowState }) {
  const countdown = useWindowCountdown(signal);
  const scores = computeScores(signal);
  const cause = causeLabel(signal.venue_type);
  const venueName = signal.venue_name ?? signal.zone;
  const arr = ZONE_ARR[signal.zone] ?? "";
  const navUrl = wazeUrl(signal.lat, signal.lng);
  const eurRange = estimateEurPerHour(signal);
  const rideHint = rideLabelShort(signal.ride_profile);

  const handleNav = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (navUrl) window.open(navUrl, "_blank");
  }, [navUrl]);

  // Remaining minutes
  const today = new Date().toISOString().slice(0, 10);
  const [eh, em] = signal.time_window.end.split(":").map(Number);
  const endTime = new Date(`${today}T${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}:00`);
  const remainMin = Math.max(0, Math.round((endTime.getTime() - Date.now()) / 60000));

  // Distance estimate
  const distKm = (signal.proximity_minutes * 0.36).toFixed(1);

  // Score colors
  const oppColor = scores.opp >= 70 ? C.green : scores.opp >= 45 ? C.amber : C.textDim;
  const fricColor = scores.fric >= 60 ? C.red : scores.fric >= 35 ? C.amber : C.green;
  const costColor = scores.cost >= 50 ? C.red : scores.cost >= 25 ? C.amber : C.green;

  return (
    <div className="flex flex-col overflow-y-auto" style={{ backgroundColor: C.bg }}>
      {/* FENETRE ACTIVE + countdown */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: C.green }}
          />
          <span
            className="uppercase tracking-[0.2em]"
            style={{ ...mono, fontSize: "0.35rem", color: C.green }}
          >
            FENETRE ACTIVE
          </span>
        </div>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "clamp(1rem, 4vw, 1.4rem)",
            color: remainMin <= 3 ? C.red : C.green,
            fontWeight: 400,
            letterSpacing: "0.05em",
          }}
        >
          {countdown}
        </span>
      </div>

      {/* ACTION — the dominant word */}
      <div className="px-4 pt-1">
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: "clamp(1.5rem, 6vw, 2.2rem)",
            color: C.green,
            lineHeight: 1.0,
            letterSpacing: "-0.02em",
            textTransform: "uppercase" as const,
          }}
        >
          {signal.action}
        </span>
      </div>

      {/* ZONE + arrondissement */}
      <div className="flex items-baseline gap-2 px-4 pt-0.5">
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: "clamp(1rem, 4vw, 1.5rem)",
            color: C.textBright,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            textTransform: "uppercase" as const,
          }}
        >
          {venueName}
        </span>
        {arr && (
          <span style={{ ...mono, fontSize: "0.55rem", color: C.textDim }}>
            {arr}
          </span>
        )}
      </div>

      {/* Distance + Time */}
      <div className="flex items-center gap-3 px-4 pt-2">
        <span style={{ ...label, fontSize: "0.6rem", color: C.textMid }}>
          {distKm} km
        </span>
        <span style={{ ...label, fontSize: "0.6rem", color: C.textMid }}>
          {signal.proximity_minutes} min
        </span>
        {rideHint && (
          <span style={{ ...mono, fontSize: "0.4rem", color: C.textDim }}>
            {rideHint}
          </span>
        )}
      </div>

      {/* Fenetre + Entry point */}
      <div className="flex items-center gap-3 px-4 pt-1.5 flex-wrap">
        <div className="flex items-center gap-1">
          <span style={{ ...mono, fontSize: "0.4rem", color: C.textGhost }}>
            Fenetre:
          </span>
          <span
            style={{
              ...mono,
              fontSize: "0.4rem",
              color: C.text,
              padding: "1px 5px",
              border: `1px solid ${C.border}`,
              borderRadius: 2,
            }}
          >
            {signal.time_window.start}{"\u2013"}{signal.time_window.end}
          </span>
        </div>
        {signal.entry_point && (
          <div className="flex items-center gap-1">
            <span style={{ ...mono, fontSize: "0.4rem", color: C.textGhost }}>
              Entree:
            </span>
            <span style={{ ...mono, fontSize: "0.4rem", color: C.textMid }}>
              {signal.entry_point}
            </span>
          </div>
        )}
      </div>

      {/* OPP / FRIC / COST */}
      <div className="flex items-center gap-2 px-4 pt-3">
        <ScoreBox label="OPP" value={scores.opp} color={oppColor} />
        <ScoreBox label="FRIC" value={scores.fric} color={fricColor} />
        <ScoreBox label="COST" value={scores.cost} color={costColor} />
      </div>

      {/* Context sentence */}
      <div className="px-4 pt-2.5">
        <span style={{ ...label, fontSize: "0.5rem", color: C.textMid, lineHeight: 1.4 }}>
          Position {flow.corridors.find(c => c.status !== "fluide")?.direction?.toUpperCase() ?? "CENTRE"}.
          {" "}{venueName} {signal.wave_phase === "FORMATION" ? "en formation" : signal.wave_phase === "ACTIVE" ? "actif" : "en observation"}.
        </span>
      </div>

      {/* NAVIGUER button */}
      {navUrl && (
        <div className="px-4 pt-3">
          <button
            onClick={handleNav}
            className="w-full flex items-center justify-center gap-3 py-3"
            style={{
              backgroundColor: C.green,
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            <span
              className="uppercase tracking-[0.2em]"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: "0.75rem",
                color: C.bg,
                letterSpacing: "0.15em",
              }}
            >
              NAVIGUER
            </span>
            <span style={{ color: C.bg, fontSize: "0.85rem" }}>{"\u2192"}</span>
          </button>
        </div>
      )}

      {/* Separator */}
      <div className="mx-4 mt-3" style={{ height: 1, backgroundColor: C.border }} />

      {/* FRICTION section */}
      <div className="px-4 pt-2.5 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span
            className="uppercase tracking-[0.2em]"
            style={{ ...mono, fontSize: "0.3rem", color: C.textGhost }}
          >
            FRICTION
          </span>
          {signal.demand_level && (
            <span
              style={{
                ...mono,
                fontSize: "0.35rem",
                color: signal.demand_level === "very_high" || signal.demand_level === "high"
                  ? C.green : C.textDim,
              }}
            >
              {signal.demand_level === "very_high" ? "Demande accrue centre"
                : signal.demand_level === "high" ? "Demande forte secteur"
                : signal.demand_level === "moderate" ? "Demande moderee"
                : "Demande faible"}
            </span>
          )}
        </div>
        {signal.forced_wave && (
          <span style={{ ...label, fontSize: "0.5rem", color: C.textMid }}>
            {signal.forced_wave.factors.slice(0, 2).join(" + ")}
          </span>
        )}
        {signal.concurrence && (
          <span style={{ ...mono, fontSize: "0.4rem", color: signal.concurrence === "forte" ? C.red : C.textDim }}>
            Concurrence {signal.concurrence}
          </span>
        )}
      </div>

      {/* Fenetre ouverte — X min restantes */}
      <div className="px-4 pt-2">
        <span style={{ ...label, fontSize: "0.45rem", color: C.textDim }}>
          Fenetre ouverte {"\u2014"} {remainMin} min restante{remainMin > 1 ? "s" : ""}.
        </span>
      </div>

      {/* EUR/h estime */}
      <div className="flex items-center justify-between px-4 pt-2">
        <span style={{ ...mono, fontSize: "0.4rem", color: C.textGhost }}>
          EUR/h estime
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "0.7rem",
            color: C.green,
            fontWeight: 400,
          }}
        >
          {eurRange.low}{"\u2192"}{eurRange.high}
        </span>
      </div>

      {/* Why-factors */}
      {signal.why_factors && signal.why_factors.length > 0 && (
        <div className="flex flex-col gap-0.5 px-4 pt-2">
          {signal.why_factors.map((f, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span style={{ ...mono, fontSize: "0.35rem", color: C.amber, marginTop: 1 }}>
                {"\u2022"}
              </span>
              <span style={{ ...label, fontSize: "0.45rem", color: C.textMid }}>
                {f}
              </span>
            </div>
          ))}
        </div>
      )}
      {(!signal.why_factors || signal.why_factors.length === 0) && cause && (
        <div className="flex items-start gap-1.5 px-4 pt-2">
          <span style={{ ...mono, fontSize: "0.35rem", color: C.amber, marginTop: 1 }}>
            {"\u2022"}
          </span>
          <span style={{ ...label, fontSize: "0.45rem", color: C.textMid }}>
            {cause} {signal.zone}
          </span>
        </div>
      )}

      {/* Wave Phase */}
      <div className="px-4 pt-3 pb-4">
        <WavePhaseBar phase={signal.wave_phase} />
      </div>
    </div>
  );
}

// ── CALME empty state ──

function CalmeState({ flow }: { flow: FlowState }) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-3"
      style={{ backgroundColor: C.bg }}
    >
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          fontSize: "clamp(1.8rem, 6vw, 2.5rem)",
          color: C.textGhost,
          lineHeight: 0.9,
          textTransform: "uppercase" as const,
        }}
      >
        CALME
      </span>
      <span style={{ ...mono, fontSize: "0.5rem", color: C.textDim }}>
        Aucune fenetre active
      </span>
      <div className="mt-2">
        <CorridorBar corridors={flow.corridors} />
      </div>
    </div>
  );
}

// ── Secondary Signal Card ──

function SecondarySignalCard({ signal }: { signal: FlowSignal }) {
  const scores = computeScores(signal);
  const cause = causeLabel(signal.venue_type);
  const venueName = signal.venue_name ?? signal.zone;
  const arr = ZONE_ARR[signal.zone] ?? "";
  const oppColor = scores.opp >= 70 ? C.green : scores.opp >= 45 ? C.amber : C.textDim;
  const distKm = (signal.proximity_minutes * 0.36).toFixed(1);

  return (
    <div
      className="flex flex-col gap-1 px-3 py-2.5"
      style={{
        backgroundColor: C.surface,
        borderLeft: `2px solid ${oppColor}`,
        borderRadius: 2,
      }}
    >
      {/* Row 1: Action + Zone */}
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: "0.7rem",
              color: oppColor,
              lineHeight: 1.2,
              textTransform: "uppercase" as const,
            }}
          >
            {signal.action}
          </span>
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
              fontSize: "0.6rem",
              color: C.textBright,
              lineHeight: 1.2,
              textTransform: "uppercase" as const,
            }}
          >
            {venueName}
          </span>
          {arr && (
            <span style={{ ...mono, fontSize: "0.35rem", color: C.textDim }}>
              {arr}
            </span>
          )}
        </div>
        <span style={{ ...mono, fontSize: "0.5rem", color: oppColor, flexShrink: 0 }}>
          {scores.opp}
        </span>
      </div>

      {/* Row 2: Distance + time window + ride hint */}
      <div className="flex items-center gap-2">
        <span style={{ ...mono, fontSize: "0.4rem", color: C.textMid }}>
          {distKm} km
        </span>
        <span style={{ ...mono, fontSize: "0.4rem", color: C.textMid }}>
          {signal.proximity_minutes} min
        </span>
        <span style={{ ...mono, fontSize: "0.35rem", color: C.textDim }}>
          {signal.time_window.start}{"\u2013"}{signal.time_window.end}
        </span>
        {signal.wave_phase && (
          <span
            className="uppercase tracking-[0.08em]"
            style={{
              ...mono,
              fontSize: "0.25rem",
              color: signal.wave_phase === "ACTIVE" ? C.green : signal.wave_phase === "FORMATION" ? C.amber : C.textDim,
              padding: "1px 3px",
              border: `1px solid ${C.border}`,
              borderRadius: 2,
            }}
          >
            {signal.wave_phase === "FORMATION" ? "MONTEE" : signal.wave_phase === "ACTIVE" ? "PIC" : "DISP"}
          </span>
        )}
      </div>

      {/* Row 3: Cause / reason */}
      {(cause || signal.reason) && (
        <span style={{ ...label, fontSize: "0.4rem", color: C.textDim, lineHeight: 1.3 }}>
          {cause || signal.reason}
        </span>
      )}
    </div>
  );
}

// ── Lat/Lng to percent position on map ──

function geoToPercent(lat: number, lng: number): { x: number; y: number } {
  // Based on FlowMap viewBox: "155 95 690 555"
  // Bounds: lng 2.224–2.420, lat 48.815–48.902
  const x = ((lng - 2.224) / (2.420 - 2.224)) * 100;
  const y = ((48.902 - lat) / (48.902 - 48.815)) * 100;
  return { x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) };
}

// ── POI Utilities (WC, Food, Epicerie 24/7) ──

type PoiCategory = "wc" | "food" | "epicerie";

interface PoiPoint {
  id: string;
  name: string;
  category: PoiCategory;
  lat: number;
  lng: number;
  hours?: string;
}

const POI_GLYPHS: Record<PoiCategory, string> = {
  wc: "\u25AB",       // small white square
  food: "\u25C6",     // diamond
  epicerie: "\u25A0", // filled square
};

const POI_COLORS: Record<PoiCategory, string> = {
  wc: "#5a7a9a",
  food: "#8a7a5a",
  epicerie: "#6a8a6a",
};

const POI_LABELS: Record<PoiCategory, string> = {
  wc: "WC",
  food: "FOOD",
  epicerie: "24/7",
};

const PARIS_POIS: PoiPoint[] = [
  // WC publics
  { id: "wc-chatelet", name: "WC Chatelet", category: "wc", lat: 48.8588, lng: 2.3475 },
  { id: "wc-bastille", name: "WC Bastille", category: "wc", lat: 48.8533, lng: 2.3692 },
  { id: "wc-opera", name: "WC Opera", category: "wc", lat: 48.8713, lng: 2.3316 },
  { id: "wc-gdn", name: "WC Gare du Nord", category: "wc", lat: 48.8800, lng: 2.3548 },
  { id: "wc-gdl", name: "WC Gare de Lyon", category: "wc", lat: 48.8448, lng: 2.3738 },
  { id: "wc-trocadero", name: "WC Trocadero", category: "wc", lat: 48.8616, lng: 2.2886 },
  { id: "wc-republique", name: "WC Republique", category: "wc", lat: 48.8676, lng: 2.3637 },
  // Food (ouvert tard)
  { id: "food-halles", name: "Kebab Les Halles", category: "food", lat: 48.8611, lng: 2.3454, hours: "24h" },
  { id: "food-pigalle", name: "Snack Pigalle", category: "food", lat: 48.8822, lng: 2.3379, hours: "02h" },
  { id: "food-bastille", name: "Pizza Bastille", category: "food", lat: 48.8531, lng: 2.3706, hours: "03h" },
  { id: "food-oberkampf", name: "Tacos Oberkampf", category: "food", lat: 48.8647, lng: 2.3684, hours: "04h" },
  { id: "food-montmartre", name: "Crepe Montmartre", category: "food", lat: 48.8853, lng: 2.3417, hours: "01h" },
  { id: "food-chatelet", name: "Burger Chatelet", category: "food", lat: 48.8583, lng: 2.3482, hours: "24h" },
  // Epiceries 24/7
  { id: "epi-marais", name: "Franprix Marais", category: "epicerie", lat: 48.8577, lng: 2.3580, hours: "24h" },
  { id: "epi-opera", name: "Carrefour Opera", category: "epicerie", lat: 48.8703, lng: 2.3329, hours: "23h" },
  { id: "epi-gdn", name: "Monop Gare du Nord", category: "epicerie", lat: 48.8794, lng: 2.3560, hours: "24h" },
  { id: "epi-nation", name: "Franprix Nation", category: "epicerie", lat: 48.8484, lng: 2.3960, hours: "23h" },
  { id: "epi-bastille", name: "Carrefour Bastille", category: "epicerie", lat: 48.8527, lng: 2.3685, hours: "24h" },
  { id: "epi-belleville", name: "Tang Freres", category: "epicerie", lat: 48.8709, lng: 2.3767, hours: "22h" },
];

// ── Main Component ──

interface CartePageProps {
  flow: FlowState;
  signals: FlowSignal[];
  banlieueHubs: Record<string, BanlieueHubState>;
  breathPhase: number;
  driverPosition: { lat: number; lng: number } | null;
  driverCorridor: string;
}

export function CartePage({
  flow,
  signals,
  banlieueHubs,
  breathPhase,
  driverPosition,
  driverCorridor,
}: CartePageProps) {
  const primary = signals.length > 0 ? signals[0] : null;
  const secondaries = signals.slice(1, 4);
  const anchors = signals.slice(0, 4); // Max 4 glowing zones on map
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(null);
  const selectedAnchor = anchors.find(s => s.id === selectedAnchorId) ?? null;
  const [showPoi, setShowPoi] = useState(false);
  const [poiFilter, setPoiFilter] = useState<PoiCategory | null>(null);

  const visiblePois = showPoi
    ? (poiFilter ? PARIS_POIS.filter(p => p.category === poiFilter) : PARIS_POIS)
    : [];

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden" style={{ backgroundColor: C.bg }}>
      {/* Map Section */}
      <div className="relative h-[45vh] lg:h-full lg:flex-1 min-h-0 shrink-0">
        <FlowMap
          zoneHeat={flow.map.zoneHeat}
          zoneStates={flow.map.zoneStates}
          zoneSaturation={{}}
          favoredZoneIds={[]}
          breathPhase={breathPhase}
          windowState="active"
          driverPosition={driverPosition}
          driverCorridor={driverCorridor}
          banlieueHubs={banlieueHubs}
        />

        {/* Event anchors on map */}
        {anchors.map((sig, i) => {
          if (!sig.lat || !sig.lng) return null;
          const pos = geoToPercent(sig.lat, sig.lng);
          const isSelected = selectedAnchorId === sig.id;
          const score = Math.round(sig.confidence * 100);
          const anchorColor = score >= 70 ? C.green : score >= 50 ? C.amber : C.textDim;
          const vName = (sig.venue_name ?? sig.zone).split(" ").slice(0, 2).join(" ");
          return (
            <motion.div
              key={sig.id}
              className="absolute flex flex-col items-center gap-0"
              style={{
                left: `${pos.x}%`, top: `${pos.y}%`,
                transform: "translate(-50%, -50%)",
                cursor: "pointer", zIndex: isSelected ? 20 : 10 + i,
              }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08, duration: 0.2 }}
              onClick={(e) => { e.stopPropagation(); setSelectedAnchorId(isSelected ? null : sig.id); }}
            >
              <motion.div
                animate={{ scale: [1, 1.6, 1], opacity: [0.15, 0.35, 0.15] }}
                transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
                style={{ position: "absolute", width: 18, height: 18, borderRadius: "50%", backgroundColor: anchorColor }}
              />
              <div style={{
                width: isSelected ? 8 : 6, height: isSelected ? 8 : 6,
                borderRadius: "50%", backgroundColor: anchorColor,
                border: isSelected ? `2px solid ${C.textBright}` : "none",
                position: "relative", zIndex: 1,
              }} />
              <div className="flex items-center gap-1 mt-0.5 px-1" style={{
                backgroundColor: "rgba(10,10,11,0.85)", borderRadius: 2,
                position: "relative", zIndex: 1, whiteSpace: "nowrap",
              } as React.CSSProperties}>
                <span style={{ ...mono, fontSize: "0.3rem", color: C.textBright }}>{vName}</span>
                {sig.peak_time && <span style={{ ...mono, fontSize: "0.25rem", color: C.textDim }}>{sig.peak_time}</span>}
                {sig.forced_wave && (
                  <span style={{ ...mono, fontSize: "0.2rem", color: C.amber, marginLeft: 2 }}>VAGUE</span>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* POI utility markers */}
        {visiblePois.map((poi) => {
          const pos = geoToPercent(poi.lat, poi.lng);
          const color = POI_COLORS[poi.category];
          return (
            <div key={poi.id} className="absolute flex flex-col items-center" style={{
              left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)", zIndex: 5,
            }}>
              <span style={{ fontSize: "0.4rem", color, lineHeight: 1 }}>{POI_GLYPHS[poi.category]}</span>
              <span className="uppercase tracking-[0.05em]" style={{
                ...mono, fontSize: "0.2rem", color,
                backgroundColor: "rgba(10,10,11,0.8)", padding: "0 2px", borderRadius: 1, whiteSpace: "nowrap",
              }}>
                {poi.name.split(" ").slice(-1)[0]}{poi.hours ? ` ${poi.hours}` : ""}
              </span>
            </div>
          );
        })}

        {/* Overlay: corridor status */}
        <div className="absolute top-3 left-3 px-2.5 py-1.5" style={{
          backgroundColor: "rgba(10, 10, 11, 0.9)", border: `1px solid ${C.border}`, borderRadius: 3,
        }}>
          <CorridorBar corridors={flow.corridors} />
        </div>

        {/* Overlay: signal count + confidence */}
        {primary && (
          <div className="absolute top-3 right-3 flex items-center gap-2 px-2.5 py-1.5" style={{
            backgroundColor: "rgba(10, 10, 11, 0.9)", border: `1px solid ${C.border}`, borderRadius: 3,
          }}>
            <span style={{ ...mono, fontSize: "0.4rem", color: C.textDim }}>{Math.round(primary.confidence * 100)}%</span>
            <SignalIntensity value={primary.confidence} size={3} />
            <span style={{ ...mono, fontSize: "0.4rem", color: C.green }}>
              {signals.length} {primary.estimated_value ? `${"\u20AC"}${primary.estimated_value}` : ""}
            </span>
          </div>
        )}

        {/* POI layer toggle */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1" style={{ zIndex: 25 }}>
          <button
            onClick={() => { setShowPoi(!showPoi); if (showPoi) setPoiFilter(null); }}
            className="uppercase tracking-[0.15em] px-2 py-1"
            style={{
              ...mono, fontSize: "0.3rem",
              color: showPoi ? C.textBright : C.textDim,
              backgroundColor: "rgba(10,10,11,0.9)",
              border: `1px solid ${showPoi ? C.textDim : C.border}`,
              borderRadius: 2, cursor: "pointer",
            }}
          >
            POI
          </button>
          {showPoi && (["wc", "food", "epicerie"] as PoiCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setPoiFilter(poiFilter === cat ? null : cat)}
              className="uppercase tracking-[0.1em] px-1.5 py-1"
              style={{
                ...mono, fontSize: "0.25rem",
                color: poiFilter === cat ? POI_COLORS[cat] : C.textDim,
                backgroundColor: "rgba(10,10,11,0.9)",
                border: `1px solid ${poiFilter === cat ? POI_COLORS[cat] + "60" : C.border}`,
                borderRadius: 2, cursor: "pointer",
              }}
            >
              {POI_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Mobile bottom sheet */}
        <AnimatePresence>
          {selectedAnchor && (
            <motion.div
              className="absolute bottom-0 left-0 right-0 lg:hidden"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                backgroundColor: "rgba(10, 10, 11, 0.95)",
                borderTop: `1px solid ${C.border}`, borderRadius: "8px 8px 0 0", zIndex: 30,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-1.5 pb-1">
                <div style={{ width: 24, height: 2, backgroundColor: C.textGhost, borderRadius: 1 }} />
              </div>
              <div className="px-4 pb-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span style={{
                    fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: "0.85rem",
                    color: C.textBright, textTransform: "uppercase" as const,
                  }}>
                    {selectedAnchor.venue_name ?? selectedAnchor.zone}
                  </span>
                  <span style={{ ...mono, fontSize: "0.7rem",
                    color: Math.round(selectedAnchor.confidence * 100) >= 70 ? C.green : C.amber,
                  }}>
                    {Math.round(selectedAnchor.confidence * 100)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span style={{ ...label, fontSize: "0.5rem", color: C.textMid }}>
                    {causeLabel(selectedAnchor.venue_type)}
                  </span>
                  <span style={{ ...mono, fontSize: "0.45rem", color: C.textDim }}>
                    {selectedAnchor.time_window.start}{"\u2013"}{selectedAnchor.time_window.end}
                  </span>
                  {selectedAnchor.peak_time && (
                    <span style={{ ...mono, fontSize: "0.4rem", color: C.amber }}>PIC {selectedAnchor.peak_time}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {selectedAnchor.crowd_estimate && (
                    <span style={{ ...mono, fontSize: "0.45rem", color: C.textMid }}>
                      ~{selectedAnchor.crowd_estimate >= 1000
                        ? `${Math.round(selectedAnchor.crowd_estimate / 1000)} 000`
                        : selectedAnchor.crowd_estimate} personnes
                    </span>
                  )}
                  <span style={{ ...mono, fontSize: "0.45rem", color: C.textMid }}>
                    {selectedAnchor.proximity_minutes} min
                  </span>
                  {selectedAnchor.estimated_value && (
                    <span style={{ ...mono, fontSize: "0.45rem", color: C.green }}>
                      {"\u20AC"}{selectedAnchor.estimated_value}
                    </span>
                  )}
                </div>
                {wazeUrl(selectedAnchor.lat, selectedAnchor.lng) && (
                  <button
                    onClick={() => { const url = wazeUrl(selectedAnchor.lat, selectedAnchor.lng); if (url) window.open(url, "_blank"); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 mt-1"
                    style={{ backgroundColor: C.green, border: "none", borderRadius: 4, cursor: "pointer" }}
                  >
                    <span className="uppercase tracking-[0.2em]" style={{
                      fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: "0.65rem", color: C.bg,
                    }}>NAVIGUER</span>
                    <span style={{ color: C.bg, fontSize: "0.75rem" }}>{"\u2192"}</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Command Panel */}
      <div className="flex-1 lg:w-[380px] lg:max-w-[420px] lg:flex-none overflow-y-auto min-h-0">
        {primary ? (
          <>
            <CommandPanel signal={primary} flow={flow} />
            {secondaries.length > 0 && (
              <div className="px-4 pb-4 flex flex-col gap-1.5" style={{ backgroundColor: C.bg }}>
                <div className="pt-1 pb-1">
                  <span className="uppercase tracking-[0.25em]" style={{ ...mono, fontSize: "0.3rem", color: C.textGhost }}>
                    AUTRES FENETRES
                  </span>
                </div>
                {secondaries.map((sig) => <SecondarySignalCard key={sig.id} signal={sig} />)}
              </div>
            )}
          </>
        ) : (
          <CalmeState flow={flow} />
        )}
      </div>
    </div>
  );
}