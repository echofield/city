// FLOW — Shift Replay (Night Review)
// "The system learns WITH me."
// Trust loop: see what happened, understand the pattern.

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { FlowMap } from "./FlowMap";
import { TERRITORIES } from "./parisData";
import { C, mono, label } from "./theme";
import type { ZoneState } from "./FlowEngine";

// ── Simulated shift replay data ──

interface ReplayWindow {
  time: string;
  zone: string;
  zoneId: string;
  captured: boolean;
  earnings: number;
  duration: number; // minutes the window lasted
}

interface ReplayStats {
  shiftDuration: string;
  totalEarnings: number;
  windowsCaptured: number;
  windowsTotal: number;
  alignment: number; // 0-100
  bestZone: string;
  bestHour: string;
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

  for (let i = 7; i >= 0; i--) {
    const wHour = (hours - i + 24) % 24;
    const wMin = Math.round(Math.random() * 50 + 5);
    const zone = zones[i % zones.length];
    const wasCaptured = Math.random() > 0.35;
    const earn = wasCaptured
      ? Math.round(15 + Math.random() * 30)
      : Math.round(Math.random() * 8);

    windows.push({
      time: `${String(wHour).padStart(2, "0")}:${String(wMin).padStart(2, "0")}`,
      zone: zone.name,
      zoneId: zone.id,
      captured: wasCaptured,
      earnings: earn,
      duration: Math.round(4 + Math.random() * 12),
    });

    if (wasCaptured) captured++;
    totalEarnings += earn;
  }

  const alignment = Math.round((captured / windows.length) * 100);

  return {
    windows,
    stats: {
      shiftDuration: `${Math.floor(windows.length * 0.7)}h${String(Math.round(Math.random() * 50)).padStart(2, "0")}`,
      totalEarnings,
      windowsCaptured: captured,
      windowsTotal: windows.length,
      alignment,
      bestZone: "Bastille",
      bestHour: `${String((hours - 3 + 24) % 24).padStart(2, "0")}h`,
    },
  };
}

// ── Replay map state — highlight visited zones ──

function buildReplayMapData(windows: ReplayWindow[]): {
  zoneHeat: Record<string, number>;
  zoneStates: Record<string, ZoneState>;
  zoneSaturation: Record<string, number>;
} {
  const zoneHeat: Record<string, number> = {};
  const zoneStates: Record<string, ZoneState> = {};
  const zoneSaturation: Record<string, number> = {};

  // Count captures per zone
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

// ── Component ──

export function Replay() {
  const navigate = useNavigate();
  const [breathPhase, setBreathPhase] = useState(0);
  const [data] = useState(generateReplayData);
  const animRef = useRef(0);

  useEffect(() => {
    let t = 0;
    const tick = () => {
      t += 0.008;
      setBreathPhase(Math.sin(t) * 0.5 + 0.5);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const mapData = buildReplayMapData(data.windows);
  const capturedZoneIds = [...new Set(data.windows.filter((w) => w.captured).map((w) => w.zoneId))];
  const { stats, windows } = data;

  return (
    <div
      className="h-screen w-screen flex flex-col lg:flex-row overflow-hidden"
      style={{ backgroundColor: C.bg, color: C.text }}
    >
      {/* Map */}
      <motion.div
        className="h-[35vh] lg:h-full lg:flex-[1.1] shrink-0 lg:shrink relative"
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
      </motion.div>

      {/* Panel */}
      <div
        className="flex-1 flex flex-col min-h-0 lg:max-w-[500px] lg:border-l overflow-hidden"
        style={{ borderColor: C.border }}
      >
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 sm:py-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col gap-6"
          >
            {/* Title */}
            <div className="flex flex-col gap-1">
              <h1
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
                  fontWeight: 300,
                  lineHeight: 1.1,
                  color: C.text,
                  margin: 0,
                }}
              >
                Shift termine
              </h1>
              <span style={{ ...label, fontSize: "0.7rem", color: C.textDim }}>
                Revue de session
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <ReplayStat label="Duree" value={stats.shiftDuration} />
              <ReplayStat label="Estimation" value={`~${stats.totalEarnings} EUR`} highlight />
              <ReplayStat label="Fenetres" value={`${stats.windowsCaptured}/${stats.windowsTotal}`} />
              <ReplayStat label="Alignement" value={`${stats.alignment}%`} highlight={stats.alignment > 60} />
            </div>

            {/* Alignment bar */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-[0.15em]" style={{ ...label, fontSize: "0.6rem", color: C.textDim }}>
                  ALIGNEMENT CHAMP
                </span>
                <span style={{ ...mono, fontSize: "0.7rem", color: stats.alignment > 60 ? C.green : C.amber }}>
                  {stats.alignment}%
                </span>
              </div>
              <div style={{ width: "100%", height: 4, borderRadius: 2, backgroundColor: C.textGhost }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.alignment}%` }}
                  transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                  style={{
                    height: "100%",
                    borderRadius: 2,
                    backgroundColor: stats.alignment > 60 ? C.green : C.amber,
                  }}
                />
              </div>
              <span style={{ ...label, fontSize: "0.65rem", color: C.textDim }}>
                {stats.alignment > 70
                  ? "Excellente synchronisation avec le champ."
                  : stats.alignment > 45
                    ? "Bonne lecture. Marge de progression sur le timing."
                    : "Session difficile. Le champ apprend de ce shift."}
              </span>
            </div>

            {/* Best insights */}
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 3 }}
            >
              <div className="flex flex-col gap-0.5">
                <span style={{ ...label, fontSize: "0.6rem", color: C.textDim }}>MEILLEURE ZONE</span>
                <span style={{ ...label, fontSize: "0.85rem", color: C.text }}>{stats.bestZone}</span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span style={{ ...label, fontSize: "0.6rem", color: C.textDim }}>MEILLEURE HEURE</span>
                <span style={{ ...mono, fontSize: "0.85rem", color: C.green }}>{stats.bestHour}</span>
              </div>
            </div>

            {/* Window timeline */}
            <div className="flex flex-col gap-0">
              <span className="uppercase tracking-[0.15em] mb-3" style={{ ...label, fontSize: "0.6rem", color: C.textDim }}>
                FENETRES DU SHIFT
              </span>
              {windows.map((w, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: 0.05 * i }}
                  className="flex items-center gap-3 px-3 py-2.5"
                  style={{ borderBottom: `1px solid ${C.border}` }}
                >
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center" style={{ width: 12 }}>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: w.captured ? C.green : C.textGhost,
                        boxShadow: w.captured ? `0 0 6px ${C.green}40` : "none",
                      }}
                    />
                  </div>
                  <span className="w-12" style={{ ...mono, fontSize: "0.7rem", color: C.textDim }}>
                    {w.time}
                  </span>
                  <span className="flex-1" style={{ ...label, fontSize: "0.8rem", color: w.captured ? C.text : C.textDim }}>
                    {w.zone}
                  </span>
                  <span style={{ ...mono, fontSize: "0.6rem", color: C.textDim }}>
                    {w.duration}min
                  </span>
                  <span
                    style={{
                      ...mono,
                      fontSize: "0.7rem",
                      color: w.captured ? C.green : C.textGhost,
                      minWidth: 40,
                      textAlign: "right",
                    }}
                  >
                    {w.earnings > 0 ? `+${w.earnings}` : "—"}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom nav */}
        <div
          className="shrink-0 flex items-center gap-3 px-5 sm:px-8 py-4"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          <button
            onClick={() => navigate("/")}
            className="flex-1 py-3 uppercase tracking-[0.2em] text-center"
            style={{
              ...label,
              fontSize: "0.7rem",
              fontWeight: 400,
              color: C.textDim,
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            NOUVEAU SHIFT
          </button>
          <button
            onClick={() => navigate("/flow")}
            className="flex-1 py-3 uppercase tracking-[0.2em] text-center"
            style={{
              ...label,
              fontSize: "0.7rem",
              fontWeight: 500,
              color: C.bg,
              backgroundColor: C.green,
              border: `1px solid ${C.green}`,
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            REPRENDRE
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stat card ──

function ReplayStat({
  label: l,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1 px-3 py-2.5"
      style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 3 }}
    >
      <span style={{ ...label, color: C.textDim, fontSize: "0.6rem" }}>{l}</span>
      <span style={{ ...mono, fontSize: "clamp(0.85rem, 2vw, 1.1rem)", fontWeight: 500, color: highlight ? C.green : C.text }}>
        {value}
      </span>
    </div>
  );
}
