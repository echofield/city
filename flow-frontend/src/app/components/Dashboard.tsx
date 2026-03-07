// FLOW v2 — Dashboard: 3-screen architecture
// [LIVE] [CARTE] [SEMAINE] — bottom nav, always visible
// Dispatch moves to secondary menu.
// Signal model normalizes all intelligence before rendering.

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import { LiveFeed } from "./LiveFeed";
import { CartePage } from "./CartePage";
import { SemainePage } from "./SemainePage";
import { RadarPage } from "./RadarPage";
import { DispatchModal } from "./DispatchModal";
import { GlanceMode } from "./GlanceMode";
import {
  computeFlowState,
  computeBanlieueHubStates,
  buildSignals,
  buildWeekSignals,
  ANCHOR_OPTIONS,
  type FlowState,
  type FlowSignal,
  type WeekSignal,
  type DriverAnchor,
  type BanlieueHubState,
} from "./FlowEngine";
import { fetchTrainWaves, type TrainWave, type SncfDataSource } from "./SncfService";
import { computeForcedMobilityWaves, type ForcedMobilitySnapshot } from "./ForcedMobilityEngine";
import { C, label, mono } from "./theme";
import { CONFIG } from "../../config";
import { useFlowApi } from "../../hooks/useFlowApi";

// ── Types ──

type Screen = "live" | "radar" | "carte" | "semaine";

/** Data source status for UI feedback */
interface DataStatus {
  source: 'local' | 'api';
  loading: boolean;
  error: string | null;
  stale: boolean;
  lastUpdated: Date | null;
}

// ── Helpers ──

function getSessionStart(): number {
  try {
    const raw = sessionStorage.getItem("flow-prefs");
    if (raw) {
      const prefs = JSON.parse(raw);
      if (prefs.startedAt) return prefs.startedAt;
    }
  } catch { /* ignore */ }
  return Date.now();
}

function getAnchor(): DriverAnchor {
  try {
    const raw = sessionStorage.getItem("flow-prefs");
    if (raw) {
      const prefs = JSON.parse(raw);
      if (prefs.anchorId) {
        const found = ANCHOR_OPTIONS.find((a) => a.id === prefs.anchorId);
        if (found) return found;
      }
    }
  } catch { /* ignore */ }
  return ANCHOR_OPTIONS[2]; // Chatelet
}

// ── Data Status Overlay ──
// Shows loading spinner, stale warning, or error message

function DataStatusOverlay({ status }: { status: DataStatus }) {
  // Only show overlay for significant states
  const showLoading = status.source === 'api' && status.loading && !status.lastUpdated;
  const showError = status.source === 'api' && status.error && !status.lastUpdated;
  const showStale = status.source === 'api' && status.stale && status.lastUpdated;

  if (!showLoading && !showError && !showStale) return null;

  return (
    <AnimatePresence>
      {showLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(10, 10, 11, 0.85)' }}
        >
          <div className="flex flex-col items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              style={{
                width: 24,
                height: 24,
                border: `2px solid ${C.textGhost}`,
                borderTopColor: C.green,
                borderRadius: '50%',
              }}
            />
            <span
              className="uppercase tracking-[0.3em]"
              style={{ ...mono, fontSize: '0.4rem', color: C.textDim }}
            >
              CHARGEMENT
            </span>
          </div>
        </motion.div>
      )}

      {showError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(10, 10, 11, 0.85)' }}
        >
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <span style={{ fontSize: '1.5rem', color: C.red }}>!</span>
            <span
              className="uppercase tracking-[0.2em]"
              style={{ ...mono, fontSize: '0.45rem', color: C.red }}
            >
              ERREUR API
            </span>
            <span style={{ ...label, fontSize: '0.5rem', color: C.textDim, maxWidth: 200 }}>
              {status.error}
            </span>
          </div>
        </motion.div>
      )}

      {showStale && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute top-14 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5"
          style={{
            backgroundColor: 'rgba(10, 10, 11, 0.95)',
            border: `1px solid ${C.amber}40`,
            borderRadius: 4,
          }}
        >
          <span
            className="uppercase tracking-[0.15em]"
            style={{ ...mono, fontSize: '0.35rem', color: C.amber }}
          >
            DONNEES ANCIENNES
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Debug Comparison Panel (dev-only) ──
// Shows local vs API signal summary for verification

function DebugComparisonPanel({
  localSignals,
  apiSignals,
  apiLoading,
  apiError,
}: {
  localSignals: FlowSignal[];
  apiSignals: FlowSignal[];
  apiLoading: boolean;
  apiError: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!CONFIG.DEBUG) return null;

  return (
    <div
      className="fixed bottom-16 right-2 z-50"
      style={{
        backgroundColor: 'rgba(10, 10, 11, 0.95)',
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        fontSize: '0.35rem',
        fontFamily: "'JetBrains Mono', monospace",
        maxWidth: expanded ? 320 : 80,
        transition: 'max-width 0.2s ease',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-2 py-1 text-left uppercase tracking-widest"
        style={{ color: C.textDim, cursor: 'pointer', background: 'none', border: 'none' }}
      >
        {expanded ? 'DEBUG ▼' : 'DBG'}
      </button>

      {expanded && (
        <div className="px-2 pb-2 flex flex-col gap-1">
          {/* Mode */}
          <div className="flex items-center justify-between">
            <span style={{ color: C.textGhost }}>Mode:</span>
            <span style={{ color: CONFIG.USE_API ? C.green : C.textMid }}>
              {CONFIG.USE_API ? 'API' : 'LOCAL'}
            </span>
          </div>

          {/* API Status */}
          {CONFIG.USE_API && (
            <div className="flex items-center justify-between">
              <span style={{ color: C.textGhost }}>API:</span>
              <span style={{ color: apiError ? C.red : apiLoading ? C.amber : C.green }}>
                {apiError ? 'ERR' : apiLoading ? 'LOAD' : 'OK'}
              </span>
            </div>
          )}

          {/* Signal counts */}
          <div className="flex items-center justify-between">
            <span style={{ color: C.textGhost }}>Local signals:</span>
            <span style={{ color: C.textMid }}>{localSignals.length}</span>
          </div>

          {CONFIG.USE_API && (
            <div className="flex items-center justify-between">
              <span style={{ color: C.textGhost }}>API signals:</span>
              <span style={{ color: C.textMid }}>{apiSignals.length}</span>
            </div>
          )}

          {/* Top signal comparison */}
          {localSignals.length > 0 && (
            <div className="pt-1 border-t" style={{ borderColor: C.border }}>
              <span style={{ color: C.textGhost }}>Local top:</span>
              <div style={{ color: C.textMid }}>
                {localSignals[0].zone} ({Math.round(localSignals[0].confidence * 100)})
              </div>
            </div>
          )}

          {CONFIG.USE_API && apiSignals.length > 0 && (
            <div className="pt-1">
              <span style={{ color: C.textGhost }}>API top:</span>
              <div style={{ color: C.textMid }}>
                {apiSignals[0].zone} ({Math.round(apiSignals[0].confidence * 100)})
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Component ──

export function Dashboard() {
  const navigate = useNavigate();
  const sessionStartRef = useRef(getSessionStart());
  const anchorRef = useRef(getAnchor());

  // State
  const [screen, setScreen] = useState<Screen>("carte");
  const [localFlow, setLocalFlow] = useState<FlowState>(() =>
    computeFlowState(sessionStartRef.current, anchorRef.current)
  );
  const [localBanlieueHubs, setLocalBanlieueHubs] = useState<Record<string, BanlieueHubState>>(() =>
    computeBanlieueHubStates(sessionStartRef.current)
  );
  const [localSignals, setLocalSignals] = useState<FlowSignal[]>([]);
  const [weekSignals] = useState<WeekSignal[]>(() => buildWeekSignals());
  const [breathPhase, setBreathPhase] = useState(0);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [showDispatch, setShowDispatch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showGlance, setShowGlance] = useState(false);
  const [trainWaves, setTrainWaves] = useState<TrainWave[]>([]);
  const [sncfSource, setSncfSource] = useState<SncfDataSource>("unavailable");
  const fmwRef = useRef<ForcedMobilitySnapshot | undefined>(undefined);

  const animRef = useRef(0);

  // ── API Integration (when enabled) ──
  const apiResult = useFlowApi({
    sessionStart: sessionStartRef.current,
    position: driverPos ?? undefined,
    refreshInterval: CONFIG.REFRESH_INTERVAL,
    skip: !CONFIG.USE_API,
  });

  // Determine data source: API or local computation
  const flow = CONFIG.USE_API && apiResult.flow ? apiResult.flow : localFlow;
  const signals = CONFIG.USE_API && apiResult.signals.length > 0 ? apiResult.signals : localSignals;
  const banlieueHubs = CONFIG.USE_API ? apiResult.banlieueHubs : localBanlieueHubs;
  const apiTrainWaves = CONFIG.USE_API ? apiResult.trainWaves : trainWaves;

  // Compute data status for UI feedback
  const dataStatus: DataStatus = CONFIG.USE_API
    ? {
        source: 'api',
        loading: apiResult.loading,
        error: apiResult.error,
        stale: apiResult.lastUpdated
          ? Date.now() - apiResult.lastUpdated.getTime() > CONFIG.REFRESH_INTERVAL * 2
          : false,
        lastUpdated: apiResult.lastUpdated,
      }
    : {
        source: 'local',
        loading: false,
        error: null,
        stale: false,
        lastUpdated: new Date(),
      };

  // Breath animation (60fps sin wave)
  useEffect(() => {
    let t = 0;
    const tick = () => {
      t += 0.01;
      setBreathPhase(Math.sin(t) * 0.5 + 0.5);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // SNCF train data polling (60-120s refresh) — only when using local engine
  const trainWavesRef = useRef<TrainWave[]>([]);
  useEffect(() => {
    if (CONFIG.USE_API) return; // Skip SNCF polling when API provides data

    let active = true;
    const poll = async () => {
      try {
        const snapshot = await fetchTrainWaves();
        if (active) {
          trainWavesRef.current = snapshot.waves;
          setTrainWaves(snapshot.waves);
          setSncfSource(snapshot.source);
        }
      } catch { /* degrade silently */ }
    };
    poll(); // initial
    const id = window.setInterval(poll, 90000); // 90s
    return () => { active = false; clearInterval(id); };
  }, []);

  // Flow state refresh (lazy 2s tick) — only when using local engine
  useEffect(() => {
    if (CONFIG.USE_API) return; // Skip local computation when API is enabled

    const update = () => {
      const waves = trainWavesRef.current;
      // Compute Forced Mobility Waves
      const fmw = computeForcedMobilityWaves(waves);
      fmwRef.current = fmw;
      const f = computeFlowState(sessionStartRef.current, anchorRef.current, waves, fmw);
      setLocalFlow(f);
      setLocalBanlieueHubs(computeBanlieueHubStates(sessionStartRef.current));
      setLocalSignals(buildSignals(f, anchorRef.current, waves, fmw));
    };
    update(); // initial
    const id = window.setInterval(update, 2000);
    return () => clearInterval(id);
  }, []);

  // Geolocation
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setDriverPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setDriverPos({ lat: anchorRef.current.lat, lng: anchorRef.current.lng }),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Auto-Glance Mode on landscape orientation
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape) and (max-height: 500px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setShowGlance(true);
    };
    // Don't auto-activate on first mount — only on orientation change
    mq.addEventListener("change", handler as (e: MediaQueryListEvent) => void);
    return () => mq.removeEventListener("change", handler as (e: MediaQueryListEvent) => void);
  }, []);

  // ── Screen tabs ──
  const SCREENS: { id: Screen; label: string }[] = [
    { id: "carte", label: "CARTE" },
    { id: "live", label: "LIVE" },
    { id: "radar", label: "RADAR" },
    { id: "semaine", label: "SEMAINE" },
  ];

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: C.bg, color: C.text }}
    >
      {/* ── Top bar: FLOW identifier + clock ── */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-1.5"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="uppercase tracking-[0.35em]"
            style={{ ...label, fontSize: "0.45rem", fontWeight: 500, color: C.textDim }}
          >
            FLOW
          </span>
          <div
            style={{
              width: 3,
              height: 3,
              borderRadius: "50%",
              backgroundColor: flow.shiftPhase === "pic" ? C.green : flow.shiftPhase === "montee" ? C.amber : C.textDim,
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          {flow.forcedMobility && flow.forcedMobility.activeCount > 0 && (
            <span
              className="uppercase tracking-[0.1em]"
              style={{
                ...mono,
                fontSize: "0.3rem",
                color: flow.forcedMobility.hasCompound ? C.green : C.amber,
                padding: "1px 4px",
                border: `1px solid ${flow.forcedMobility.hasCompound ? `${C.green}30` : `${C.amber}30`}`,
                borderRadius: 2,
              }}
            >
              {flow.forcedMobility.activeCount} VAGUE{flow.forcedMobility.activeCount > 1 ? "S" : ""}
            </span>
          )}
          {CONFIG.USE_API && (
            <span
              className="uppercase tracking-[0.1em]"
              style={{
                ...mono,
                fontSize: "0.3rem",
                color: apiResult.error ? C.red : apiResult.source === "live" ? C.green : C.textGhost,
                padding: "1px 4px",
                border: `1px solid ${apiResult.error ? `${C.red}30` : apiResult.source === "live" ? `${C.green}30` : C.border}`,
                borderRadius: 2,
              }}
            >
              {apiResult.loading ? "API..." : apiResult.error ? "API ERR" : apiResult.source === "live" ? "API LIVE" : "API"}
            </span>
          )}
          {!CONFIG.USE_API && sncfSource !== "unavailable" && (
            <span
              className="uppercase tracking-[0.1em]"
              style={{
                ...mono,
                fontSize: "0.3rem",
                color: sncfSource === "api" ? C.green : C.textGhost,
                padding: "1px 4px",
                border: `1px solid ${sncfSource === "api" ? `${C.green}30` : C.border}`,
                borderRadius: 2,
              }}
            >
              {sncfSource === "api" ? "SNCF LIVE" : "SNCF"}
            </span>
          )}
          <span style={{ ...mono, fontSize: "0.5rem", color: C.textDim }}>
            {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {/* ── Screen content ── */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {/* Data status overlay for loading/error/stale states */}
        <DataStatusOverlay status={dataStatus} />
        <AnimatePresence mode="wait">
          {screen === "live" && (
            <motion.div
              key="live"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.12 }}
              className="h-full"
            >
              <LiveFeed signals={signals} flow={flow} trainWaves={CONFIG.USE_API ? apiTrainWaves : trainWaves} onOpenRadar={() => setScreen("radar")} />
            </motion.div>
          )}

          {screen === "radar" && (
            <motion.div
              key="radar"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.12 }}
              className="h-full"
            >
              <RadarPage signals={signals} breathPhase={breathPhase} />
            </motion.div>
          )}

          {screen === "carte" && (
            <motion.div
              key="carte"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.12 }}
              className="h-full"
            >
              <CartePage
                flow={flow}
                signals={signals}
                banlieueHubs={banlieueHubs}
                breathPhase={breathPhase}
                driverPosition={driverPos}
                driverCorridor={anchorRef.current.corridor}
              />
            </motion.div>
          )}

          {screen === "semaine" && (
            <motion.div
              key="semaine"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.12 }}
              className="h-full"
            >
              <SemainePage signals={weekSignals} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom Navigation ── */}
      <div
        className="shrink-0 flex items-center"
        style={{
          borderTop: `1px solid ${C.border}`,
          backgroundColor: C.bg,
        }}
      >
        {/* Screen tabs */}
        {SCREENS.map((s) => {
          const isActive = screen === s.id;
          const activeColor = s.id === "live" ? C.green : s.id === "radar" ? C.blue : s.id === "carte" ? C.text : C.amber;
          return (
            <button
              key={s.id}
              onClick={() => setScreen(s.id)}
              className="flex-1 py-3.5 flex flex-col items-center gap-1 relative"
              style={{
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                minHeight: 44, // mobile tap target
              }}
            >
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="nav-dot"
                  className="absolute top-0 left-1/4 right-1/4"
                  style={{ height: 2, backgroundColor: activeColor, borderRadius: 1 }}
                  transition={{ duration: 0.2 }}
                />
              )}
              <span
                className="uppercase tracking-[0.2em]"
                style={{
                  ...label,
                  fontSize: "0.55rem",
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? activeColor : C.textDim,
                  transition: "color 0.2s",
                }}
              >
                {s.label}
              </span>
            </button>
          );
        })}

        {/* Menu button */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="px-4 py-3 flex flex-col items-center gap-1"
          style={{
            backgroundColor: "transparent",
            border: "none",
            borderLeft: `1px solid ${C.border}`,
            cursor: "pointer",
          }}
        >
          <div className="flex flex-col gap-1">
            <div style={{ width: 14, height: 1.5, backgroundColor: C.textDim, borderRadius: 1 }} />
            <div style={{ width: 10, height: 1.5, backgroundColor: C.textDim, borderRadius: 1 }} />
          </div>
        </button>
      </div>

      {/* ── Secondary Menu (slide up) ── */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0"
              style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
              onClick={() => setShowMenu(false)}
            />

            {/* Menu panel */}
            <motion.div
              className="relative w-full max-w-[400px] mx-auto"
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{
                backgroundColor: C.surface,
                borderTop: `1px solid ${C.border}`,
                borderRadius: "8px 8px 0 0",
              }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-2 pb-3">
                <div style={{ width: 32, height: 3, backgroundColor: C.textGhost, borderRadius: 2 }} />
              </div>

              {/* Menu items */}
              <div className="flex flex-col pb-6">
                {[
                  { label: "GLANCE MODE", action: () => { setShowMenu(false); setShowGlance(true); } },
                  { label: "DISPATCH", action: () => { setShowMenu(false); setShowDispatch(true); } },
                  { label: "PARAMETRES", action: () => { setShowMenu(false); } },
                  { label: "FEEDBACK", action: () => { setShowMenu(false); } },
                  { label: "FIN SHIFT", action: () => { setShowMenu(false); navigate("/replay"); } },
                ].map((item) => (
                  <motion.button
                    key={item.label}
                    onClick={item.action}
                    className="w-full text-left px-6 py-3.5 uppercase tracking-[0.15em]"
                    style={{
                      ...label,
                      fontSize: "0.6rem",
                      fontWeight: 400,
                      color: item.label === "FIN SHIFT" ? C.textDim : C.text,
                      backgroundColor: "transparent",
                      border: "none",
                      borderBottom: `1px solid ${C.border}`,
                      cursor: "pointer",
                    }}
                    whileTap={{ backgroundColor: C.surfaceHover }}
                  >
                    {item.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dispatch Modal (simplified: just corridors) ── */}
      <DispatchModal
        session={{
          duration_min: Math.round((Date.now() - sessionStartRef.current) / 60000),
          courses_count: 0,
          earnings: flow.sessionEarnings,
          target_earnings: 0,
          efficiency: 0,
        }}
        corridors={flow.corridors}
        phase={flow.shiftPhase}
        open={showDispatch}
        onClose={() => setShowDispatch(false)}
      />

      {/* ── Glance Mode (full-screen overlay) ── */}
      <AnimatePresence>
        {showGlance && (
          <GlanceMode
            signal={signals.length > 0 ? signals[0] : null}
            onExit={() => setShowGlance(false)}
          />
        )}
      </AnimatePresence>

      {/* Debug comparison panel (dev-only) */}
      <DebugComparisonPanel
        localSignals={localSignals}
        apiSignals={apiResult.signals}
        apiLoading={apiResult.loading}
        apiError={apiResult.error}
      />
    </div>
  );
}