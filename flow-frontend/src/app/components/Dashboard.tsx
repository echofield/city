// FLOW — Dashboard: The Instrument
// 1 screen. 1 state. 1 action.
// Every pixel serves the chauffeur's next 30 seconds.

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import { FlowMap } from "./FlowMap";
import { DispatchPanel } from "./DispatchPanel";
import {
  type FlowState,
  type ActionType,
  type ShiftPhase,
  type WindowState,
  formatCountdown,
  zoneStateApiToDisplay,
  engineStateToApiState,
} from "../types/flow-state";
import { fetchFlowState, fetchFlowStateMock } from "../api/flow";
import { computeFlowState, computeContextSignals } from "./FlowEngine";
import { C, mono, label } from "./theme";

// ── Helpers ──

function getActionColor(action: ActionType): string {
  switch (action) {
    case "move": return C.greenBright;
    case "prepare": return C.amber;
    case "hold": return C.textMid;
    case "rest": return C.grayDim;
  }
}

function getWindowColor(ws: WindowState): string {
  switch (ws) {
    case "active": return C.green;
    case "forming": return C.amber;
    case "closing": return C.amberDim;
    case "stable": return C.grayDim;
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
}

/** Map confidence (0–100) to certainty tone: no numbers, instrument grammar. */
function getCertaintyTone(confidence: number): "Clair" | "En formation" | "Instable" | "Retrait" {
  if (confidence >= 70) return "Clair";
  if (confidence >= 45) return "En formation";
  if (confidence >= 25) return "Instable";
  return "Retrait";
}

/** Derive single highest-confidence "tonight" line from FlowState (peaks > upcoming > signals). */
function getTonightAnchor(state: FlowState): string | null {
  const peaks = state.peaks ?? [];
  if (peaks.length > 0) {
    const best = peaks.reduce((a, b) => (a.score >= b.score ? a : b));
    const condition = best.time || best.reason || "";
    return condition ? `Ce soir — ${best.zone} · ${condition}` : `Ce soir — ${best.zone}`;
  }
  const upcoming = state.upcoming ?? [];
  if (upcoming.length > 0) {
    const best = upcoming.reduce((a, b) => (a.saturation >= b.saturation ? a : b));
    return `Ce soir — ${best.zone} · ${best.time}`;
  }
  const signals = state.signals ?? [];
  if (signals.length > 0) {
    const first = signals[0];
    return first?.text ? `Ce soir — ${first.text}` : null;
  }
  return null;
}

type TabId = "maintenant" | "prochain" | "cesoir" | "complet";

// ── Shift Arc ──

function ShiftArc({ phase, progress }: { phase: ShiftPhase; progress: number }) {
  const phases: { id: ShiftPhase; label: string }[] = [
    { id: "calme", label: "CALME" },
    { id: "montee", label: "MONTEE" },
    { id: "pic", label: "PIC" },
    { id: "dispersion", label: "DISPERSION" },
  ];
  const idx = phases.findIndex((p) => p.id === phase);
  const starts = [0, 0.2, 0.5, 0.75];
  const ends = [0.2, 0.5, 0.75, 1.0];
  const inPhase = idx >= 0 ? Math.min(1, (progress - starts[idx]) / (ends[idx] - starts[idx])) : 0;

  return (
    <div className="flex items-center w-full gap-1">
      {phases.map((p, i) => {
        const isCurrent = i === idx;
        const isPast = i < idx;
        const color = isCurrent
          ? (phase === "pic" ? C.green : C.amber)
          : isPast ? C.grayDim : C.textGhost;

        return (
          <div key={p.id} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center" style={{ minWidth: 8 }}>
              <div
                style={{
                  width: isCurrent ? 8 : 5,
                  height: isCurrent ? 8 : 5,
                  borderRadius: "50%",
                  backgroundColor: color,
                  transition: "all 0.5s ease",
                }}
              />
            </div>
            <span
              className="uppercase tracking-[0.15em] hidden sm:inline"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "0.55rem",
                fontWeight: 400,
                color,
                transition: "color 0.5s ease",
              }}
            >
              {p.label}
            </span>
            {i < phases.length - 1 && (
              <div className="flex-1 relative" style={{ height: 1, backgroundColor: C.textGhost }}>
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    height: 1,
                    backgroundColor: isPast ? C.grayDim : isCurrent ? color : "transparent",
                    width: isPast ? "100%" : isCurrent ? `${inPhase * 100}%` : "0%",
                    transition: "width 1s ease",
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Saturation Bar ──

function SatBar({ value }: { value: number }) {
  const blocks = 4;
  const filled = Math.round((value / 100) * blocks);
  const color = value > 70 ? C.red : value > 45 ? C.amber : C.green;
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: blocks }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 10,
            backgroundColor: i < filled ? color : C.textGhost,
            borderRadius: 1,
            transition: "background-color 0.3s ease",
          }}
        />
      ))}
      <span
        style={{
          ...mono,
          fontSize: "0.6rem",
          fontWeight: 300,
          color: C.textDim,
          marginLeft: 4,
        }}
      >
        {value}%
      </span>
    </div>
  );
}

// ── Stat Card ──

function StatCard({
  cardLabel,
  value,
  highlight,
}: {
  cardLabel: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1 px-3 py-2.5"
      style={{
        backgroundColor: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 3,
      }}
    >
      <span style={{ ...label, color: C.textDim, fontSize: "0.6rem" }}>
        {cardLabel}
      </span>
      <span
        style={{
          ...mono,
          fontSize: "clamp(0.85rem, 2vw, 1.1rem)",
          fontWeight: 500,
          color: highlight ? C.green : C.text,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Dashboard ──

export type DataSource = "live" | "live_stale" | "simulated";

const STALE_THRESHOLD_MS = 30_000;

export function Dashboard(props: {
  demoMode?: boolean;
  pollIntervalMs?: number;
  showActivationOverlayAfterMs?: number;
}) {
  const {
    demoMode = false,
    pollIntervalMs = 2000,
    showActivationOverlayAfterMs,
  } = props;
  const navigate = useNavigate();
  const [flowState, setFlowState] = useState<FlowState | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>("simulated");
  const [breathPhase, setBreathPhase] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [entered, setEntered] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("maintenant");
  const [showActivationOverlay, setShowActivationOverlay] = useState(false);
  const [showDispatch, setShowDispatch] = useState(false);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const sessionStartRef = useRef(Date.now());
  const animFrameRef = useRef(0);
  const hasEverSucceededRef = useRef(false);
  const staleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoMountedRef = useRef(0);
  const hasInteractedRef = useRef(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const onOffline = () => setIsOffline(true);
    const onOnline = () => setIsOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  useEffect(() => {
    // Check if user went through onboarding
    const prefs = sessionStorage.getItem("flow-prefs");
    if (prefs) {
      try {
        const parsed = JSON.parse(prefs);
        if (parsed.startedAt) {
          sessionStartRef.current = parsed.startedAt;
        }
      } catch { /* use default */ }
    }
  }, []);

  useEffect(() => {
    let active = true;

    const fallbackToSimulated = () => {
      setFlowState(engineStateToApiState(computeFlowState(sessionStartRef.current)));
      setDataSource("simulated");
      setCurrentTime(new Date());
    };

    const poll = async () => {
      if (!active) return;
      try {
        const state = (await (demoMode ? fetchFlowStateMock(sessionStartRef.current) : fetchFlowState(sessionStartRef.current))) as FlowState;
        if (!active) return;
        if (staleTimeoutRef.current) {
          clearTimeout(staleTimeoutRef.current);
          staleTimeoutRef.current = null;
        }
        hasEverSucceededRef.current = true;
        // Merge locally-computed signals (metro status) with API signals
        const localSignals = computeContextSignals();
        const mergedSignals = [...localSignals, ...(state.signals ?? [])];
        setFlowState({ ...state, signals: mergedSignals });
        setDataSource("live");
        setCurrentTime(new Date());
      } catch {
        if (!active) return;
        if (hasEverSucceededRef.current) {
          setDataSource("live_stale");
          if (!staleTimeoutRef.current) {
            staleTimeoutRef.current = setTimeout(() => {
              staleTimeoutRef.current = null;
              fallbackToSimulated();
            }, STALE_THRESHOLD_MS);
          }
        } else {
          fallbackToSimulated();
        }
      }
    };

    poll();
    const id = setInterval(poll, pollIntervalMs);
    const t = setTimeout(() => setEntered(true), 80);
    return () => {
      active = false;
      clearInterval(id);
      clearTimeout(t);
      if (staleTimeoutRef.current) clearTimeout(staleTimeoutRef.current);
    };
  }, []);

  // Demo: activation overlay after 75s OR 35s + engagement (scroll/click/tap)
  useEffect(() => {
    if (!showActivationOverlayAfterMs || showActivationOverlay) return;
    demoMountedRef.current = Date.now();
    const onInteract = () => { hasInteractedRef.current = true; };
    window.addEventListener("click", onInteract, { once: true });
    window.addEventListener("touchstart", onInteract, { once: true });
    window.addEventListener("scroll", onInteract, { once: true, passive: true });
    const id = setInterval(() => {
      const elapsed = Date.now() - demoMountedRef.current;
      if (elapsed >= showActivationOverlayAfterMs || (elapsed >= 35000 && hasInteractedRef.current)) {
        setShowActivationOverlay(true);
        clearInterval(id);
      }
    }, 1000);
    return () => {
      clearInterval(id);
      window.removeEventListener("click", onInteract);
      window.removeEventListener("touchstart", onInteract);
      window.removeEventListener("scroll", onInteract);
    };
  }, [showActivationOverlayAfterMs, showActivationOverlay]);

  useEffect(() => {
    let active = true;
    let breathT = 0;
    const tick = () => {
      if (!active) return;
      breathT += 0.01;
      setBreathPhase(Math.sin(breathT) * 0.5 + 0.5);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const tonightAnchor = useMemo(
    () => (flowState ? getTonightAnchor(flowState) : null),
    [flowState]
  );

  if (!flowState) {
    return <div className="h-screen w-screen" style={{ backgroundColor: C.bg }} />;
  }

  const actionColor = getActionColor(flowState.action);
  const windowColor = getWindowColor(flowState.windowState);
  const fieldActive = flowState.windowState === "active" || flowState.windowState === "forming";

  const tabs: { id: TabId; label: string; full: string }[] = [
    { id: "maintenant", label: "MAINT.", full: "MAINTENANT" },
    { id: "prochain", label: "PROCH.", full: "PROCHAIN" },
    { id: "cesoir", label: "CE SOIR", full: "CE SOIR" },
    { id: "complet", label: "COMPLET", full: "COMPLET" },
  ];

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden relative"
      style={{ backgroundColor: C.bg, color: C.text }}
    >
      {/* ── Header ── */}
      <motion.div
        className="shrink-0 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3"
        style={{ borderBottom: `1px solid ${C.border}` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: entered ? 1 : 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: fieldActive ? C.green : C.grayDim,
              boxShadow: fieldActive ? `0 0 8px ${C.green}40` : "none",
              transition: "all 0.5s ease",
            }}
          />
          <span
            className="uppercase tracking-[0.2em]"
            style={{
              ...label,
              fontSize: "clamp(0.6rem, 1.5vw, 0.75rem)",
              fontWeight: 500,
              color: fieldActive ? C.text : C.textDim,
            }}
          >
            CHAMP {fieldActive ? "CONFIRME" : "EN LECTURE"}
          </span>
          <span
            style={{
              ...label,
              fontSize: "clamp(0.55rem, 1.3vw, 0.7rem)",
              color: C.textDim,
              letterSpacing: "0.08em",
            }}
          >
            {getCertaintyTone(flowState.confidence)}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {isOffline ? (
            <span
              className="uppercase tracking-[0.1em]"
              style={{
                ...label,
                fontSize: "0.5rem",
                color: C.textGhost,
                letterSpacing: "0.08em",
              }}
            >
              Sans connexion — mode système
            </span>
          ) : demoMode ? (
            <span
              className="uppercase tracking-[0.12em]"
              style={{
                ...label,
                fontSize: "0.5rem",
                color: C.textGhost,
                letterSpacing: "0.1em",
              }}
            >
              MODE APERÇU
            </span>
          ) : (
            <span
              className="flex items-center gap-1.5"
              style={{
                ...label,
                fontSize: "0.55rem",
                color: C.textDim,
                letterSpacing: "0.08em",
              }}
              title={dataSource === "live" ? "Données temps réel" : dataSource === "live_stale" ? "Dernière donnée reçue, reconnexion…" : "Mode démo local"}
            >
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  backgroundColor:
                    dataSource === "live" ? C.green
                    : dataSource === "live_stale" ? C.amber
                    : C.grayDim,
                  flexShrink: 0,
                }}
              />
              {dataSource === "live" ? "LIVE" : dataSource === "live_stale" ? "LIVE (stale)" : "SIMULATED"}
            </span>
          )}
          <span
            style={{
              ...mono,
              fontSize: "clamp(1rem, 2.5vw, 1.4rem)",
              color: C.textMid,
              letterSpacing: "0.05em",
            }}
          >
            {formatTime(currentTime)}
          </span>
          <button
            onClick={() => setShowDispatch(true)}
            className="uppercase tracking-[0.15em]"
            style={{
              ...label,
              fontSize: "0.55rem",
              color: C.textDim,
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 3,
              padding: "4px 10px",
              cursor: "pointer",
              transition: "border-color 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.grayDim)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
          >
            DISPATCH
          </button>
          <button
            onClick={() => navigate("/replay")}
            className="uppercase tracking-[0.15em]"
            style={{
              ...label,
              fontSize: "0.55rem",
              color: C.textDim,
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 3,
              padding: "4px 10px",
              cursor: "pointer",
              transition: "border-color 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.grayDim)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
          >
            FIN SHIFT
          </button>
        </div>
      </motion.div>

      {/* ── Shift arc + Tonight Anchor ── */}
      <motion.div
        className="shrink-0 px-4 sm:px-6 lg:px-8 py-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: entered ? 1 : 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <ShiftArc phase={flowState.shiftPhase} progress={flowState.shiftProgress} />
        <AnimatePresence>
          {tonightAnchor && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="mt-1.5 truncate"
              style={{
                ...label,
                fontSize: "0.6rem",
                color: C.textDim,
                letterSpacing: "0.06em",
              }}
            >
              {tonightAnchor}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Map */}
        <motion.div
          className="h-[38vh] sm:h-[42vh] lg:h-full lg:flex-[1.1] shrink-0 lg:shrink"
          initial={{ opacity: 0 }}
          animate={{ opacity: entered ? 1 : 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <FlowMap
            zoneHeat={flowState.zoneHeat}
            zoneStates={zoneStateApiToDisplay(flowState.zoneState)}
            zoneSaturation={flowState.zoneSaturation}
            favoredZoneIds={flowState.favoredZoneIds}
            breathPhase={breathPhase}
            windowState={flowState.windowState}
            banlieueHubs={flowState.banlieueHubs}
          />
        </motion.div>

        {/* Panel */}
        <motion.div
          className="flex-1 flex flex-col min-h-0 lg:max-w-[480px] lg:border-l overflow-hidden"
          style={{ borderColor: C.border }}
          initial={{ opacity: 0 }}
          animate={{ opacity: entered ? 1 : 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
            <AnimatePresence mode="wait">
              {/* ── MAINTENANT ── */}
              {activeTab === "maintenant" && (
                <motion.div
                  key="maintenant"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-5"
                >
                  {/* Window state */}
                  <div className="flex items-center gap-2.5">
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: windowColor,
                        boxShadow: fieldActive ? `0 0 10px ${windowColor}50` : "none",
                      }}
                    />
                    <span
                      className="uppercase tracking-[0.2em]"
                      style={{
                        ...label,
                        fontSize: "clamp(0.55rem, 1.3vw, 0.7rem)",
                        color: windowColor,
                      }}
                    >
                      {flowState.windowLabel}
                    </span>
                  </div>

                  {/* Countdown */}
                  <span
                    style={{
                      ...mono,
                      fontSize: "clamp(2.8rem, 9vw, 4.5rem)",
                      color: actionColor,
                      lineHeight: 1,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {formatCountdown(flowState.windowCountdownSec)}
                  </span>
                  {/* Countdown target label */}
                  {flowState.countdownTargetLabel && (
                    <span
                      style={{
                        ...label,
                        fontSize: "0.7rem",
                        color: C.textDim,
                        letterSpacing: "0.05em",
                        marginTop: 4,
                      }}
                    >
                      {flowState.countdownTargetLabel}
                    </span>
                  )}

                  {/* Action word */}
                  <h1
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: "clamp(2rem, 6vw, 3.5rem)",
                      fontWeight: 300,
                      lineHeight: 1,
                      color: actionColor,
                      margin: 0,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {flowState.actionLabel}
                  </h1>

                  {/* Target zone + earnings */}
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span
                        style={{
                          ...label,
                          fontSize: "clamp(0.95rem, 2.5vw, 1.2rem)",
                          color: C.text,
                        }}
                      >
                        {flowState.targetZone}
                        <span style={{ color: C.textDim, marginLeft: 6 }}>
                          {flowState.targetZoneArr}
                        </span>
                      </span>
                      <span
                        style={{ ...label, fontSize: "clamp(0.7rem, 1.8vw, 0.85rem)", fontWeight: 300, color: C.textDim }}
                      >
                        {flowState.fieldMessage}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span
                        style={{
                          ...mono,
                          fontSize: "clamp(1rem, 2.5vw, 1.3rem)",
                          fontWeight: 500,
                          color:
                            (flowState.earningsIntensity ?? "MODERE") === "FORT"
                              ? C.green
                              : (flowState.earningsIntensity ?? "MODERE") === "MODERE"
                                ? C.amber
                                : C.textDim,
                        }}
                      >
                        {flowState.earningsIntensity ?? "MODERE"}
                      </span>
                      <span style={{ ...label, fontSize: "0.6rem", fontWeight: 300, color: C.textDim }}>
                        Intensite
                      </span>
                    </div>
                  </div>

                  {/* Navigate */}
                  <button
                    className="w-full py-3 px-4 flex items-center justify-center gap-2 uppercase tracking-[0.2em]"
                    style={{
                      ...label,
                      fontSize: "clamp(0.7rem, 1.6vw, 0.85rem)",
                      fontWeight: 500,
                      color: flowState.action === "move" ? C.bg : C.textDim,
                      backgroundColor: flowState.action === "move" ? C.green : C.surface,
                      border: `1px solid ${flowState.action === "move" ? C.green : C.border}`,
                      borderRadius: 3,
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                    }}
                  >
                    NAVIGUER
                    <span style={{ fontSize: "0.9em" }}>&#8594;</span>
                  </button>

                  {/* Temporal message */}
                  <p style={{ ...label, fontSize: "clamp(0.75rem, 1.8vw, 0.9rem)", fontWeight: 300, color: C.textDim, margin: 0 }}>
                    {flowState.temporalMessage}
                  </p>

                  {/* Alternatives */}
                  {flowState.alternatives && flowState.alternatives.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ ...label, fontSize: "0.65rem", color: C.textDim }}>Alt:</span>
                      {flowState.alternatives.map((alt) => (
                        <span
                          key={alt}
                          className="px-2 py-0.5"
                          style={{
                            ...label,
                            fontSize: "0.6rem",
                            color: C.textMid,
                            backgroundColor: C.surface,
                            border: `1px solid ${C.border}`,
                            borderRadius: 2,
                          }}
                        >
                          {alt}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Context signals */}
                  {flowState.signals && flowState.signals.length > 0 && (
                    <div className="flex flex-col gap-1.5 pt-1" style={{ borderTop: `1px solid ${C.border}` }}>
                      {flowState.signals.map((sig, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div
                            style={{
                              width: 4,
                              height: 4,
                              borderRadius: "50%",
                              backgroundColor:
                                sig.type === "surge" ? C.green
                                : sig.type === "event" ? C.amber
                                : sig.type === "weather" ? C.textDim
                                : C.grayDim,
                            }}
                          />
                          <span style={{ ...label, fontSize: "clamp(0.6rem, 1.4vw, 0.75rem)", fontWeight: 300, color: C.textDim }}>
                            {sig.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── PROCHAIN ── */}
              {activeTab === "prochain" && (
                <motion.div
                  key="prochain"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-5"
                >
                  <span className="uppercase tracking-[0.15em]" style={{ ...label, fontSize: "0.65rem", color: C.textDim }}>
                    TRANSITIONS A VENIR
                  </span>

                  <div
                    className="px-4 py-3"
                    style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 3 }}
                  >
                    <span style={{ ...label, fontSize: "clamp(0.8rem, 2vw, 1rem)", color: C.amber }}>
                      {flowState.temporalMessage}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
                      <span className="w-14" style={{ ...mono, color: C.textDim, fontSize: "0.55rem" }}>HEURE</span>
                      <span className="flex-1" style={{ ...label, color: C.textDim, fontSize: "0.55rem" }}>ZONE</span>
                      <span className="w-20" style={{ ...label, color: C.textDim, fontSize: "0.55rem" }}>SAT.</span>
                      <span className="w-16 text-right" style={{ ...mono, color: C.textDim, fontSize: "0.55rem" }}>INT.</span>
                    </div>
                    {flowState.upcoming.map((slot, i) => {
                      const slotIntensity = slot.earnings >= 30 ? "FORT" : slot.earnings >= 20 ? "MODERE" : "FAIBLE";
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 px-3 py-2.5"
                          style={{ borderBottom: `1px solid ${C.border}` }}
                        >
                          <span className="w-14" style={{ ...mono, color: C.textMid }}>{slot.time}</span>
                          <span className="flex-1" style={{ ...label, color: C.text }}>{slot.zone}</span>
                          <span className="w-20"><SatBar value={slot.saturation} /></span>
                          <span
                            className="w-16 text-right"
                            style={{
                              ...mono,
                              fontSize: "0.7rem",
                              color: slotIntensity === "FORT" ? C.green : slotIntensity === "MODERE" ? C.amber : C.textDim,
                            }}
                          >
                            {slotIntensity}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ── CE SOIR ── */}
              {activeTab === "cesoir" && (
                <motion.div
                  key="cesoir"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-5"
                >
                  <span className="uppercase tracking-[0.15em]" style={{ ...label, fontSize: "0.65rem", color: C.textDim }}>
                    PICS ATTENDUS
                  </span>

                  {flowState.peaks.map((peak, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-3"
                      style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 3 }}
                    >
                      <div className="flex items-center gap-3">
                        <span style={{ ...mono, color: C.textMid, fontSize: "0.85rem" }}>{peak.time}</span>
                        <div className="flex flex-col">
                          <span style={{ ...label, color: C.text, fontSize: "0.9rem" }}>{peak.zone}</span>
                          <span style={{ ...label, color: C.textDim, fontSize: "0.65rem" }}>{peak.reason}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: C.textGhost, overflow: "hidden" }}>
                          <div style={{ width: `${peak.score}%`, height: "100%", backgroundColor: peak.score > 75 ? C.green : C.amber, borderRadius: 2 }} />
                        </div>
                        <span style={{ ...mono, color: C.textDim, fontSize: "0.6rem" }}>{peak.score}</span>
                      </div>
                    </div>
                  ))}

                  <div className="pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                    <span className="uppercase tracking-[0.15em]" style={{ ...label, color: C.textDim, fontSize: "0.6rem" }}>
                      SIGNAUX
                    </span>
                    <div className="flex flex-col gap-2 mt-3">
                      {flowState.signals.map((sig, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div
                            style={{
                              width: 4, height: 4, borderRadius: "50%",
                              backgroundColor: sig.type === "surge" ? C.green : sig.type === "event" ? C.amber : C.textDim,
                            }}
                          />
                          <span style={{ ...label, color: C.textMid, fontSize: "0.75rem" }}>{sig.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── COMPLET ── */}
              {activeTab === "complet" && (
                <motion.div
                  key="complet"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-5"
                >
                  <span className="uppercase tracking-[0.15em]" style={{ ...label, color: C.textDim, fontSize: "0.65rem" }}>
                    SESSION
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <StatCard cardLabel="Shift en cours" value={formatDuration(Date.now() - sessionStartRef.current)} />
                    <StatCard cardLabel="Estimation" value={`~${flowState.sessionEarnings} EUR`} highlight />
                    <StatCard cardLabel="Confiance" value={`${flowState.confidence}%`} />
                    <StatCard cardLabel="Phase" value={flowState.shiftPhase.toUpperCase()} />
                  </div>

                  <div className="pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                    <span className="uppercase tracking-[0.15em]" style={{ ...label, color: C.textDim, fontSize: "0.6rem" }}>
                      DERNIERES FENETRES
                    </span>
                    <div className="flex flex-col mt-3">
                      {(flowState.memory ?? []).map((mem, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 px-3 py-2.5"
                          style={{ borderBottom: `1px solid ${C.border}` }}
                        >
                          <span style={{ ...mono, color: C.textDim }}>{mem.time}</span>
                          <span className="flex-1" style={{ ...label, color: C.text }}>{mem.zone}</span>
                          <div
                            className="px-2 py-0.5"
                            style={{
                              ...label,
                              fontSize: "0.55rem",
                              color: mem.captured ? C.green : C.textDim,
                              backgroundColor: mem.captured ? `${C.green}15` : C.surface,
                              border: `1px solid ${mem.captured ? C.greenDim : C.border}`,
                              borderRadius: 2,
                            }}
                          >
                            {mem.captured ? "capturee" : "manquee"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Tab navigation ── */}
          <div className="shrink-0 flex items-center" style={{ borderTop: `1px solid ${C.border}` }}>
            {tabs.map((tab) => {
              const isTabActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex-1 py-3 sm:py-3.5 uppercase tracking-[0.12em] text-center"
                  style={{
                    ...label,
                    fontSize: "clamp(0.55rem, 1.2vw, 0.7rem)",
                    fontWeight: isTabActive ? 500 : 400,
                    color: isTabActive ? C.text : C.textDim,
                    backgroundColor: isTabActive ? C.surface : "transparent",
                    border: "none",
                    borderTop: `2px solid ${isTabActive ? C.green : "transparent"}`,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span className="hidden sm:inline">{tab.full}</span>
                  <span className="sm:hidden">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Dispatch Panel */}
      <AnimatePresence>
        {showDispatch && (
          <DispatchPanel
            flowState={flowState}
            sessionStartTime={sessionStartRef.current}
            onClose={() => setShowDispatch(false)}
          />
        )}
      </AnimatePresence>

      {/* Demo activation overlay */}
      {showActivationOverlay && (
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center z-50 px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            backgroundColor: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div className="flex flex-col items-center text-center max-w-sm gap-6">
            <p
              className="text-lg"
              style={{ ...label, color: C.text, fontWeight: 400, lineHeight: 1.4 }}
            >
              Le champ reste actif pendant ta session.
            </p>
            <p
              style={{ ...label, color: C.textDim, fontSize: "0.9rem" }}
            >
              Active ton accès pour continuer.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
              <button
                type="button"
                onClick={() => navigate("/activate")}
                className="uppercase tracking-[0.2em] py-3 px-6 font-medium transition-opacity hover:opacity-90"
                style={{
                  ...label,
                  fontSize: "0.75rem",
                  color: C.bg,
                  backgroundColor: C.green,
                  border: "none",
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                Activer Flow
              </button>
              <button
                type="button"
                onClick={() => setShowActivationOverlay(false)}
                className="uppercase tracking-[0.15em] py-2.5 px-4 font-medium transition-opacity hover:opacity-80"
                style={{
                  ...label,
                  fontSize: "0.7rem",
                  color: C.textDim,
                  backgroundColor: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                Mode aperçu
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
