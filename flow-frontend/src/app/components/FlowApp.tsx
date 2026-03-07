// FLOW — Main App Container
// 3 screens: LIVE | CARTE | SEMAINE
// Dispatch is secondary (accessible via menu)

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import { BottomNav, type ScreenId } from "./BottomNav";
import { LiveScreen } from "./LiveScreen";
import { CarteScreen } from "./CarteScreen";
import { SemaineScreen } from "./SemaineScreen";
import { DispatchPanel } from "./DispatchPanel";
import { AroundYouPanel } from "./AroundYouPanel";
import type { FlowState } from "../types/flow-state";
import type { SignalFeed, WeekCalendar } from "../types/signal";
import { fetchFlowState, fetchFlowStateMock } from "../api/flow";
import { computeFlowState, computeContextSignals, computeRestaurantSignals, computeSpecialEventSignals } from "./FlowEngine";
import { engineStateToApiState } from "../types/flow-state";
import { useDriverPosition, computeProximityMinutes } from "../hooks/useDriverPosition";
import { computeAroundYouSignals, type AroundYouResult } from "../lib/around-you";
import { C, mono, label } from "./theme";

// ── Types ──

interface FlowStateWithSignals extends FlowState {
  signalFeed?: SignalFeed;
  weekCalendar?: WeekCalendar;
}

// ── Helpers ──

function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ── FlowApp ──

export function FlowApp(props: {
  demoMode?: boolean;
  pollIntervalMs?: number;
}) {
  const { demoMode = false, pollIntervalMs = 2000 } = props;
  const navigate = useNavigate();

  const [activeScreen, setActiveScreen] = useState<ScreenId>("live");
  const [flowState, setFlowState] = useState<FlowStateWithSignals | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showDispatch, setShowDispatch] = useState(false);
  const [breathPhase, setBreathPhase] = useState(0);
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [aroundYouResult, setAroundYouResult] = useState<AroundYouResult | null>(null);
  const [showAroundYou, setShowAroundYou] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const sessionStartRef = useRef(Date.now());
  const animFrameRef = useRef(0);
  const hasEverSucceededRef = useRef(false);
  const pollFnRef = useRef<(() => Promise<void>) | null>(null);

  // Driver GPS position
  const { position: driverPosition, status: gpsStatus } = useDriverPosition(!demoMode);

  // Stabilize driverPosition reference for useEffect dependencies
  // Only update when lat/lng actually change (not on every object creation)
  const driverPosRef = useRef<{ lat: number; lng: number } | null>(null);
  if (driverPosition) {
    if (
      !driverPosRef.current ||
      driverPosRef.current.lat !== driverPosition.lat ||
      driverPosRef.current.lng !== driverPosition.lng
    ) {
      driverPosRef.current = { lat: driverPosition.lat, lng: driverPosition.lng };
    }
  } else {
    driverPosRef.current = null;
  }
  const stableDriverPos = driverPosRef.current;

  // Offline detection
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

  // Load session start from storage
  useEffect(() => {
    const prefs = sessionStorage.getItem("flow-prefs");
    if (prefs) {
      try {
        const parsed = JSON.parse(prefs);
        if (parsed.startedAt) {
          sessionStartRef.current = parsed.startedAt;
        }
      } catch {
        /* use default */
      }
    }
  }, []);

  // Poll for flow state
  useEffect(() => {
    let active = true;

    const fallbackToSimulated = () => {
      setFlowState(
        engineStateToApiState(computeFlowState(sessionStartRef.current)) as FlowStateWithSignals
      );
      setCurrentTime(new Date());
    };

    // Enrich signals with client-side proximity if backend didn't compute it
    const enrichWithProximity = (state: FlowStateWithSignals): FlowStateWithSignals => {
      // Use stable ref to avoid closure over stale driverPosition
      const currentPos = driverPosRef.current;
      if (!currentPos) return state;

      const signalFeed = state.signalFeed;
      if (!signalFeed?.signals) return state;

      const enrichedSignals = signalFeed.signals.map((signal) => {
        // Skip if backend already computed proximity
        if (signal.proximity_minutes !== undefined) return signal;

        // Compute client-side
        const proximity = computeProximityMinutes(
          currentPos.lat,
          currentPos.lng,
          signal.zone || "",
          signal.arrondissement
        );

        return proximity !== null
          ? { ...signal, proximity_minutes: proximity }
          : signal;
      });

      return {
        ...state,
        signalFeed: { ...signalFeed, signals: enrichedSignals },
      };
    };

    const poll = async () => {
      if (!active) return;
      try {
        // Pass driver position to API for backend proximity computation
        // Use stable ref to avoid closure over stale driverPosition
        const currentPos = driverPosRef.current;

        const state = (await (demoMode
          ? fetchFlowStateMock(sessionStartRef.current)
          : fetchFlowState(sessionStartRef.current, currentPos))) as FlowStateWithSignals;
        if (!active) return;
        hasEverSucceededRef.current = true;

        // Merge locally-computed signals
        const localSignals = computeContextSignals();
        const mergedSignals = [...localSignals, ...(state.signals ?? [])];

        // Merge restaurant and special event signals into signalFeed
        const restaurantSignals = computeRestaurantSignals(new Date());
        const specialEventSignals = computeSpecialEventSignals(new Date());
        const existingFeedSignals = state.signalFeed?.signals ?? [];
        const mergedFeedSignals = [...specialEventSignals, ...existingFeedSignals, ...restaurantSignals];

        // Update signalFeed with merged signals
        const updatedSignalFeed = state.signalFeed
          ? { ...state.signalFeed, signals: mergedFeedSignals, total_count: mergedFeedSignals.length }
          : { signals: mergedFeedSignals, generated_at: new Date().toISOString(), total_count: mergedFeedSignals.length, live_count: 0, nearby_count: 0, alert_count: 0 };

        // Enrich with proximity if needed
        const enrichedState = enrichWithProximity({ ...state, signals: mergedSignals, signalFeed: updatedSignalFeed });

        setFlowState(enrichedState);
        setCurrentTime(new Date());
      } catch {
        if (!active) return;
        if (!hasEverSucceededRef.current) {
          fallbackToSimulated();
        }
      }
    };

    // Store poll function for manual refresh
    pollFnRef.current = poll;

    poll();
    const id = setInterval(poll, pollIntervalMs);
    return () => {
      active = false;
      clearInterval(id);
      pollFnRef.current = null;
    };
    // driverPosition is read from driverPosRef.current inside poll()
    // so we don't need it in the dependency array (avoids re-polling on every GPS update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, pollIntervalMs]);

  // Manual refresh handler with Around You scan
  const handleRefresh = useCallback(async () => {
    if (isRefreshing || !pollFnRef.current) return;
    setIsRefreshing(true);
    setIsScanning(true);
    setShowAroundYou(true);

    try {
      await pollFnRef.current();

      // Compute Around You if we have position and signals
      if (driverPosition && flowState?.signalFeed?.signals) {
        const result = computeAroundYouSignals(
          driverPosition.lat,
          driverPosition.lng,
          flowState.signalFeed.signals,
          5
        );
        setAroundYouResult(result);
      }
    } finally {
      // End scanning animation
      setTimeout(() => {
        setIsScanning(false);
        setIsRefreshing(false);
      }, 600);

      // Auto-dismiss Around You after 5 seconds
      setTimeout(() => {
        setShowAroundYou(false);
      }, 5000);
    }
  }, [isRefreshing, driverPosition, flowState]);

  // Breathing animation
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

  // Derived values
  const signalFeed = flowState?.signalFeed ?? null;
  const weekCalendar = flowState?.weekCalendar ?? null;
  const liveCount = signalFeed?.live_count ?? 0;

  // Compute Around You when position or signals change (for CARTE)
  const computedAroundYou = useMemo(() => {
    if (!driverPosition || !signalFeed?.signals) return null;
    return computeAroundYouSignals(
      driverPosition.lat,
      driverPosition.lng,
      signalFeed.signals,
      5
    );
  }, [driverPosition, signalFeed?.signals]);

  // Use manual refresh result if available, otherwise computed
  const effectiveAroundYou = aroundYouResult ?? computedAroundYou;

  // Loading state
  if (!flowState) {
    return (
      <div
        className="h-screen w-screen flex items-center justify-center"
        style={{ backgroundColor: C.bg }}
      >
        <span
          className="uppercase tracking-[0.2em]"
          style={{
            ...label,
            fontSize: "0.8rem",
            color: C.textGhost,
          }}
        >
          FLOW
        </span>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: C.bg, color: C.text }}
    >
      {/* Header - minimal */}
      <header
        className="shrink-0 flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="uppercase tracking-[0.15em]"
            style={{
              ...label,
              fontSize: "0.65rem",
              fontWeight: 500,
              color: C.textDim,
            }}
          >
            FLOW
          </span>
          {isOffline && (
            <span
              className="px-1.5 py-0.5 uppercase tracking-[0.08em]"
              style={{
                ...label,
                fontSize: "0.45rem",
                color: C.amber,
                backgroundColor: `${C.amber}15`,
                borderRadius: 2,
              }}
            >
              OFFLINE
            </span>
          )}
          {/* GPS status indicator */}
          {!demoMode && (
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor:
                  gpsStatus === "locked" ? C.green :
                  gpsStatus === "warming" ? C.amber :
                  gpsStatus === "error" ? C.red : C.textGhost,
                boxShadow: gpsStatus === "locked" ? `0 0 4px ${C.green}60` : "none",
              }}
              title={
                gpsStatus === "locked" ? "GPS actif" :
                gpsStatus === "warming" ? "GPS en cours..." :
                gpsStatus === "error" ? "GPS erreur" : "GPS inactif"
              }
            />
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 3,
              cursor: isRefreshing ? "default" : "pointer",
              opacity: isRefreshing ? 0.6 : 1,
            }}
            title="Actualiser"
          >
            <motion.span
              animate={{ rotate: isRefreshing ? 360 : 0 }}
              transition={{
                duration: 0.6,
                ease: "linear",
                repeat: isRefreshing ? Infinity : 0,
              }}
              style={{
                display: "inline-block",
                fontSize: "0.85rem",
                color: C.textDim,
                lineHeight: 1,
              }}
            >
              ⟳
            </motion.span>
          </button>
          <span
            style={{
              ...mono,
              fontSize: "1rem",
              color: C.textMid,
              letterSpacing: "0.03em",
            }}
          >
            {formatTime(currentTime)}
          </span>
          <button
            onClick={() => setShowDispatch(true)}
            className="px-2 py-1"
            style={{
              ...label,
              fontSize: "0.55rem",
              color: C.textDim,
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 2,
              cursor: "pointer",
            }}
          >
            DISPATCH
          </button>
          <button
            onClick={() => navigate("/replay")}
            className="px-2 py-1"
            style={{
              ...label,
              fontSize: "0.55rem",
              color: C.textDim,
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 2,
              cursor: "pointer",
            }}
          >
            FIN
          </button>
        </div>
      </header>

      {/* Screen content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeScreen === "live" && (
            <motion.div
              key="live"
              className="flex-1 flex flex-col min-h-0"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
            >
              <LiveScreen
                signalFeed={signalFeed}
                flowState={flowState}
                onOpenDispatch={() => setShowDispatch(true)}
              />
            </motion.div>
          )}

          {activeScreen === "carte" && (
            <motion.div
              key="carte"
              className="flex-1 flex flex-col min-h-0"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
            >
              <CarteScreen
                signalFeed={signalFeed}
                flowState={flowState}
                breathPhase={breathPhase}
                driverPosition={driverPosition}
                aroundYouResult={effectiveAroundYou}
              />
            </motion.div>
          )}

          {activeScreen === "semaine" && (
            <motion.div
              key="semaine"
              className="flex-1 flex flex-col min-h-0"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
            >
              <SemaineScreen weekCalendar={weekCalendar} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom nav */}
      <BottomNav
        active={activeScreen}
        onNavigate={setActiveScreen}
        liveCount={liveCount}
      />

      {/* Around You overlay (on refresh) */}
      <AnimatePresence>
        {showAroundYou && activeScreen === "live" && (
          <AroundYouPanel
            result={aroundYouResult}
            isScanning={isScanning}
            variant="overlay"
            onClose={() => setShowAroundYou(false)}
          />
        )}
      </AnimatePresence>

      {/* Dispatch panel (secondary) */}
      <AnimatePresence>
        {showDispatch && (
          <DispatchPanel
            flowState={flowState}
            sessionStartTime={sessionStartRef.current}
            onClose={() => setShowDispatch(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
