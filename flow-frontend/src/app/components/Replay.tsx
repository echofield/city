// FLOW — Shift Replay (Night Review)
// "The system learns WITH me."
// Trust loop: see what happened, understand the pattern.
// Every replay builds confidence for the next shift.

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { FlowMap } from "./FlowMap";
import { TERRITORIES } from "./parisData";
import { C, mono, label, heading } from "./theme";
import type { ZoneState } from "./FlowEngine";

// -- Simulated shift replay data --

interface ReplayWindow {
  time: string;
  zone: string;
  zoneId: string;
  captured: boolean;
  earnings: number;
  duration: number;
  confidence: number;    // 0-100 signal score
}

interface ReplayStats {
  shiftDuration: string;
  totalEarnings: number;
  windowsCaptured: number;
  windowsTotal: number;
  alignment: number;
  bestZone: string;
  bestHour: string;
  avgEarningsPerH: number;
  avgConfidence: number;  // average signal score
  precisionRate: number;  // % of high-confidence signals that were captured
}

function generateReplayData(): { windows: ReplayWindow[]; stats: ReplayStats } {
  const now = new Date();
  const hours = now.getHours();
  const zones = [
    { name: "Bastille", id: "11" },
    { name: "Marais", id: "4" },
    { name: "Opera", id: "9" },
    { name: "Montmartre", id: "18" },
    { name: "Chatelet", id: "1" },
    { name: "Republique", id: "3" },
    { name: "Pigalle", id: "9" },
    { name: "Trocadero", id: "16" },
  ];

  const windows: ReplayWindow[] = [];
  let captured = 0;
  let totalEarnings = 0;
  let totalConfidence = 0;
  let highConfidenceCaptured = 0;

  for (let i = 7; i >= 0; i--) {
    const wHour = (hours - i + 24) % 24;
    const wMin = Math.round(Math.random() * 50 + 5);
    const zone = zones[i % zones.length];
    const wasCaptured = Math.random() > 0.35;
    const earn = wasCaptured
      ? Math.round(15 + Math.random() * 30)
      : Math.round(Math.random() * 8);
    const conf = Math.round(Math.random() * 100);

    windows.push({
      time: `${String(wHour).padStart(2, "0")}:${String(wMin).padStart(2, "0")}`,
      zone: zone.name,
      zoneId: zone.id,
      captured: wasCaptured,
      earnings: earn,
      duration: Math.round(4 + Math.random() * 12),
      confidence: conf,
    });

    if (wasCaptured) captured++;
    totalEarnings += earn;
    totalConfidence += conf;
    if (conf > 70 && wasCaptured) highConfidenceCaptured++;
  }

  const alignment = Math.round((captured / windows.length) * 100);
  const shiftHours = Math.floor(windows.length * 0.7);
  const shiftMins = Math.round(Math.random() * 50);
  const avgConfidence = totalConfidence / windows.length;
  const precisionRate = captured > 0 ? Math.round((highConfidenceCaptured / captured) * 100) : 0;

  return {
    windows,
    stats: {
      shiftDuration: `${shiftHours}h${String(shiftMins).padStart(2, "0")}`,
      totalEarnings,
      windowsCaptured: captured,
      windowsTotal: windows.length,
      alignment,
      bestZone: "Bastille",
      bestHour: `${String((hours - 3 + 24) % 24).padStart(2, "0")}h`,
      avgEarningsPerH: shiftHours > 0 ? Math.round(totalEarnings / shiftHours) : 0,
      avgConfidence,
      precisionRate,
    },
  };
}

function buildReplayMapData(windows: ReplayWindow[]): {
  zoneHeat: Record<string, number>;
  zoneStates: Record<string, ZoneState>;
  zoneSaturation: Record<string, number>;
} {
  const zoneHeat: Record<string, number> = {};
  const zoneStates: Record<string, ZoneState> = {};
  const zoneSaturation: Record<string, number> = {};

  const captureCount: Record<string, number> = {};
  const visitCount: Record<string, number> = {};
  for (const w of windows) {
    visitCount[w.zoneId] = (visitCount[w.zoneId] ?? 0) + 1;
    if (w.captured) {
      captureCount[w.zoneId] = (captureCount[w.zoneId] ?? 0) + 1;
    }
  }

  for (const t of TERRITORIES) {
    const visits = visitCount[t.id] ?? 0;
    const captures = captureCount[t.id] ?? 0;

    zoneHeat[t.id] = visits > 0 ? Math.min(1, 0.2 + captures * 0.25) : 0.02;
    zoneStates[t.id] = captures > 0 ? "active" : visits > 0 ? "fading" : "dormant";
    zoneSaturation[t.id] = 0;
  }

  return { zoneHeat, zoneStates, zoneSaturation };
}

// -- Component --

export function Replay() {
  const navigate = useNavigate();
  const [breathPhase, setBreathPhase] = useState(0);
  const [data] = useState(generateReplayData);
  const animRef = useRef(0);

  useEffect(() => {
    let t = 0;
    const tick = () => {
      t += 0.006;
      setBreathPhase(Math.sin(t) * 0.5 + 0.5);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const mapData = buildReplayMapData(data.windows);
  const capturedZoneIds = [...new Set(data.windows.filter((w) => w.captured).map((w) => w.zoneId))];
  const { stats, windows } = data;

  const alignmentColor = stats.alignment > 65 ? C.green : stats.alignment > 40 ? C.amber : C.textDim;

  return (
    <div
      className="h-screen w-screen flex flex-col lg:flex-row overflow-hidden"
      style={{ backgroundColor: C.bg, color: C.text }}
    >
      {/* Map */}
      <motion.div
        className="h-[32vh] lg:h-full lg:flex-[1.1] shrink-0 lg:shrink relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <FlowMap
          zoneHeat={mapData.zoneHeat}
          zoneStates={mapData.zoneStates}
          zoneSaturation={mapData.zoneSaturation}
          favoredZoneIds={capturedZoneIds}
          breathPhase={breathPhase}
          windowState="stable"
          selectedZoneIds={capturedZoneIds}
        />

        {/* Overlay: shift summary on map */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div
            className="px-2.5 py-1.5"
            style={{
              backgroundColor: "rgba(10, 10, 11, 0.85)",
              border: `1px solid ${C.border}`,
              borderRadius: 3,
            }}
          >
            <span style={{ ...mono, fontSize: "0.5rem", color: C.textDim }}>
              {capturedZoneIds.length} zones visitees
            </span>
          </div>
          <div
            className="px-2.5 py-1.5"
            style={{
              backgroundColor: "rgba(10, 10, 11, 0.85)",
              border: `1px solid ${C.border}`,
              borderRadius: 3,
            }}
          >
            <span style={{ ...mono, fontSize: "0.55rem", color: alignmentColor }}>
              {stats.alignment}% alignement
            </span>
          </div>
        </div>
      </motion.div>

      {/* Panel */}
      <div
        className="flex-1 flex flex-col min-h-0 lg:max-w-[480px] lg:border-l overflow-hidden"
        style={{ borderColor: C.border }}
      >
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 sm:py-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-5"
          >
            {/* Title */}
            <div className="flex flex-col gap-1">
              <h1
                style={{
                  ...heading,
                  fontSize: "clamp(2rem, 6vw, 3rem)",
                  color: C.text,
                  margin: 0,
                  letterSpacing: "-0.02em",
                }}
              >
                Termine
              </h1>
              <span style={{ ...label, fontSize: "0.65rem", color: C.textDim }}>
                Revue de session
              </span>
            </div>

            {/* Hero stats: earnings + duration */}
            <div className="flex items-end justify-between py-2">
              <div className="flex flex-col gap-0.5">
                <span style={{ ...label, fontSize: "0.5rem", color: C.textDim }}>GAINS</span>
                <span
                  style={{
                    ...mono,
                    fontSize: "clamp(1.6rem, 5vw, 2.4rem)",
                    fontWeight: 500,
                    color: C.green,
                    lineHeight: 1,
                  }}
                >
                  ~{stats.totalEarnings}
                </span>
                <span style={{ ...label, fontSize: "0.5rem", color: C.textDim }}>EUR</span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span style={{ ...label, fontSize: "0.5rem", color: C.textDim }}>DUREE</span>
                <span
                  style={{
                    ...mono,
                    fontSize: "clamp(1rem, 3vw, 1.4rem)",
                    color: C.text,
                    lineHeight: 1,
                  }}
                >
                  {stats.shiftDuration}
                </span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="FENETRES" value={`${stats.windowsCaptured}/${stats.windowsTotal}`} />
              <StatCard label="EUR/H" value={`~${stats.avgEarningsPerH}`} highlight />
              <StatCard
                label="ALIGNEMENT"
                value={`${stats.alignment}%`}
                highlight={stats.alignment > 55}
                color={alignmentColor}
              />
            </div>

            {/* Precision row */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                label="PRECISION FLOW"
                value={`${Math.round(stats.avgConfidence)}`}
                highlight={stats.avgConfidence > 65}
                color={stats.avgConfidence > 70 ? C.green : stats.avgConfidence > 50 ? C.amber : C.textDim}
              />
              <StatCard
                label="SIGNAUX FORTS CAPTES"
                value={`${stats.precisionRate}%`}
                highlight={stats.precisionRate > 60}
                color={stats.precisionRate > 60 ? C.green : C.amber}
              />
            </div>

            {/* Alignment bar */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span
                  className="uppercase tracking-[0.15em]"
                  style={{ ...label, fontSize: "0.5rem", color: C.textDim }}
                >
                  ALIGNEMENT
                </span>
              </div>
              <div style={{ width: "100%", height: 3, borderRadius: 2, backgroundColor: C.textGhost }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.alignment}%` }}
                  transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
                  style={{
                    height: "100%",
                    borderRadius: 2,
                    backgroundColor: alignmentColor,
                  }}
                />
              </div>
              <span style={{ ...label, fontSize: "0.6rem", color: C.textDim, lineHeight: 1.5 }}>
                {stats.alignment > 70
                  ? "Excellente synchronisation avec FLOW."
                  : stats.alignment > 45
                    ? "Bonne lecture. Marge de progression sur le timing."
                    : "Session difficile. FLOW apprend de ce shift."}
              </span>
            </div>

            {/* Best insights */}
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 3 }}
            >
              <div className="flex flex-col gap-0.5">
                <span style={{ ...label, fontSize: "0.5rem", color: C.textDim }}>MEILLEURE ZONE</span>
                <span style={{ ...label, fontSize: "0.8rem", color: C.text }}>{stats.bestZone}</span>
              </div>
              <div style={{ width: 1, height: 24, backgroundColor: C.border }} />
              <div className="flex flex-col items-end gap-0.5">
                <span style={{ ...label, fontSize: "0.5rem", color: C.textDim }}>MEILLEURE HEURE</span>
                <span style={{ ...mono, fontSize: "0.8rem", color: C.green }}>{stats.bestHour}</span>
              </div>
            </div>

            {/* Window timeline */}
            <div className="flex flex-col gap-0">
              <span
                className="uppercase tracking-[0.15em] mb-3"
                style={{ ...label, fontSize: "0.5rem", color: C.textDim }}
              >
                FENETRES DU SHIFT
              </span>
              {windows.map((w, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: 0.04 * i }}
                  className="flex items-center gap-3 px-3 py-2"
                  style={{ borderBottom: `1px solid ${C.border}` }}
                >
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center" style={{ width: 10 }}>
                    <div
                      style={{
                        width: w.captured ? 6 : 4,
                        height: w.captured ? 6 : 4,
                        borderRadius: "50%",
                        backgroundColor: w.captured ? C.green : C.textGhost,
                        boxShadow: w.captured ? `0 0 6px ${C.green}40` : "none",
                      }}
                    />
                  </div>
                  <span className="w-11" style={{ ...mono, fontSize: "0.6rem", color: C.textDim }}>
                    {w.time}
                  </span>
                  <span
                    className="flex-1"
                    style={{
                      ...label,
                      fontSize: "0.7rem",
                      color: w.captured ? C.text : C.textDim,
                    }}
                  >
                    {w.zone}
                  </span>
                  {/* Confidence score */}
                  <span
                    style={{
                      ...mono,
                      fontSize: "0.5rem",
                      color: w.confidence >= 70 ? C.green : w.confidence >= 50 ? C.amber : C.textGhost,
                      minWidth: 20,
                      textAlign: "right",
                    }}
                  >
                    {w.confidence}
                  </span>
                  <span style={{ ...mono, fontSize: "0.5rem", color: C.textDim }}>
                    {w.duration}min
                  </span>
                  <span
                    style={{
                      ...mono,
                      fontSize: "0.65rem",
                      color: w.captured ? C.green : C.textGhost,
                      minWidth: 36,
                      textAlign: "right",
                    }}
                  >
                    {w.earnings > 0 ? `+${w.earnings}` : "--"}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom nav */}
        <div
          className="shrink-0 flex items-center gap-2 px-5 sm:px-8 py-3"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          <motion.button
            onClick={() => navigate("/")}
            className="flex-1 py-3 uppercase tracking-[0.2em] text-center"
            style={{
              ...label,
              fontSize: "0.6rem",
              fontWeight: 400,
              color: C.textDim,
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 3,
              cursor: "pointer",
            }}
            whileTap={{ scale: 0.97 }}
          >
            NOUVEAU SHIFT
          </motion.button>
          <motion.button
            onClick={() => navigate("/flow")}
            className="flex-1 py-3 uppercase tracking-[0.2em] text-center"
            style={{
              ...label,
              fontSize: "0.6rem",
              fontWeight: 500,
              color: C.bg,
              backgroundColor: C.green,
              border: `1px solid ${C.green}`,
              borderRadius: 3,
              cursor: "pointer",
            }}
            whileTap={{ scale: 0.97 }}
          >
            REPRENDRE
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// -- Stat card --

function StatCard({
  label: l,
  value,
  highlight,
  color,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div
      className="flex flex-col gap-1 px-3 py-2.5"
      style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 3 }}
    >
      <span style={{ ...label, color: C.textDim, fontSize: "0.5rem" }}>{l}</span>
      <span
        style={{
          ...mono,
          fontSize: "clamp(0.8rem, 2vw, 1rem)",
          fontWeight: 500,
          color: color ?? (highlight ? C.green : C.text),
        }}
      >
        {value}
      </span>
    </div>
  );
}