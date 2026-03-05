// FLOW — Quiet Landing Hero
// Live map background, no explanation. Entrer → demo.

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useNavigate, useSearchParams } from "react-router";
import { FlowMap } from "./FlowMap";
import { TERRITORIES } from "./parisData";
import { fetchFlowStateMock } from "../api/flow";
import type { FlowState } from "../types/flow-state";
import { zoneStateApiToDisplay } from "../types/flow-state";
import { C, label } from "./theme";

const HERO_POLL_MS = 18_000;

function getMinimalMapState(breathPhase: number) {
  const ids = TERRITORIES.map((t) => t.id);
  const zoneHeat: Record<string, number> = {};
  const zoneStates: Record<string, "dormant" | "forming" | "active" | "peak" | "fading"> = {};
  const zoneSaturation: Record<string, number> = {};
  for (const id of ids) {
    zoneHeat[id] = breathPhase * 0.04;
    zoneStates[id] = "dormant";
    zoneSaturation[id] = 0;
  }
  return {
    zoneHeat,
    zoneStates,
    zoneSaturation,
    favoredZoneIds: [] as string[],
    windowState: "stable" as const,
  };
}

export function LandingHero() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [flowState, setFlowState] = useState<FlowState | null>(null);
  const [breathPhase, setBreathPhase] = useState(0);
  const [exiting, setExiting] = useState(false);
  const breathRef = useRef(0);

  // Optional: capture ?ref= for affiliate
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) localStorage.setItem("flow_ref", ref);
  }, [searchParams]);

  // Sans connexion → direct sur le système (/demo)
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!navigator.onLine) {
      navigate("/demo", { replace: true });
      return;
    }
    const onOffline = () => navigate("/demo", { replace: true });
    window.addEventListener("offline", onOffline);
    return () => window.removeEventListener("offline", onOffline);
  }, [navigate]);

  // Poll API every 15–20s; fallback to minimal static state if fetch fails
  useEffect(() => {
    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        const state = (await fetchFlowStateMock()) as FlowState;
        if (active) setFlowState(state);
      } catch {
        if (active) setFlowState(null);
      }
    };
    poll();
    const id = setInterval(poll, HERO_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Local breath phase (slow)
  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      breathRef.current += 0.006;
      setBreathPhase(Math.sin(breathRef.current) * 0.5 + 0.5);
      requestAnimationFrame(tick);
    };
    const frame = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, []);

  const mapState = flowState
    ? {
        zoneHeat: flowState.zoneHeat ?? {},
        zoneStates: zoneStateApiToDisplay(flowState.zoneState),
        zoneSaturation: flowState.zoneSaturation ?? {},
        favoredZoneIds: flowState.favoredZoneIds ?? [],
        windowState: flowState.windowState,
      }
    : getMinimalMapState(breathPhase);

  const handleEnter = () => {
    setExiting(true);
    setTimeout(() => navigate("/demo"), 500);
  };

  return (
    <motion.div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{ backgroundColor: C.bg }}
      initial={false}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Map background ~85% */}
      <div className="absolute inset-0">
        <FlowMap
          zoneHeat={mapState.zoneHeat}
          zoneStates={mapState.zoneStates}
          zoneSaturation={mapState.zoneSaturation}
          favoredZoneIds={mapState.favoredZoneIds}
          breathPhase={breathPhase}
          windowState={mapState.windowState}
        />
      </div>

      {/* Dark overlay 10–15% */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.12)" }}
      />

      {/* Centered copy */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="pointer-events-auto flex flex-col items-center text-center px-6">
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-serif tracking-tight"
            style={{
              color: C.text,
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 300,
              lineHeight: 1.15,
              marginBottom: "0.5rem",
            }}
          >
            Conduis avec le rythme de la ville.
          </h1>
          <p
            className="text-sm sm:text-base mb-10"
            style={{ ...label, color: C.textDim, opacity: 0.6 }}
          >
            Flow indique quand attendre, quand bouger.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <button
              type="button"
              onClick={() => {
                setExiting(true);
                setTimeout(() => navigate("/onboarding"), 500);
              }}
              className="uppercase tracking-[0.2em] text-sm font-medium px-8 py-3 transition-all hover:opacity-90"
              style={{
                color: C.text,
                backgroundColor: "rgba(0, 177, 79, 0.15)",
                border: `1px solid ${C.green}`,
                borderRadius: "3px",
                cursor: "pointer",
              }}
            >
              Simuler
            </button>
            <button
              type="button"
              onClick={() => {
                setExiting(true);
                setTimeout(() => navigate("/activate"), 500);
              }}
              className="uppercase tracking-[0.2em] text-sm font-medium px-8 py-3 transition-all hover:opacity-90"
              style={{
                color: "#0a0a0b",
                backgroundColor: C.green,
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
              }}
            >
              Activer LIVE
            </button>
          </div>
        </div>
      </div>

      {/* Logo small bottom-left */}
      <div
        className="absolute bottom-4 left-4"
        style={{ ...label, fontSize: "0.65rem", color: C.textGhost, letterSpacing: "0.15em" }}
      >
        FLOW
      </div>
    </motion.div>
  );
}
