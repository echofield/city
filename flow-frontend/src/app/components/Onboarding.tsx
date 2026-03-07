// FLOW v1.6 — Reactive Onboarding
// The system is alive from the first tap.
// 2 steps: Shift type + Anchor pick. Map reacts immediately.
// Anchor model replaces arrondissement selection.
// No "champ", no system words.

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import { FlowMap } from "./FlowMap";
import { TERRITORIES } from "./parisData";
import { ANCHOR_OPTIONS, type DriverAnchor } from "./FlowEngine";
import { C, label, mono, heading } from "./theme";
import type { ZoneState } from "./FlowEngine";

// -- Types --

type ShiftType = "jour" | "nuit" | "nuit_profonde";

interface OnboardingState {
  step: number; // 0, 1
  shiftType: ShiftType | null;
  anchor: DriverAnchor | null;
}

// -- Simulated map state based on onboarding choices --

const CORRIDOR_ZONES: Record<string, string[]> = {
  nord: ["9", "10", "17", "18", "19"],
  est: ["3", "4", "11", "12", "20"],
  sud: ["5", "6", "13", "14"],
  ouest: ["7", "8", "15", "16"],
  centre: ["1", "2", "cite", "stlouis"],
};

function buildOnboardingHeat(
  shiftType: ShiftType | null,
  anchor: DriverAnchor | null,
  breathPhase: number
): {
  zoneHeat: Record<string, number>;
  zoneStates: Record<string, ZoneState>;
  zoneSaturation: Record<string, number>;
  favoredZoneIds: string[];
} {
  const zoneHeat: Record<string, number> = {};
  const zoneStates: Record<string, ZoneState> = {};
  const zoneSaturation: Record<string, number> = {};

  const nightZones = new Set(["11", "18", "9", "10", "3", "4", "20"]);
  const dayZones = new Set(["8", "16", "1", "7", "6", "2", "9"]);
  const deepNightZones = new Set(["18", "11", "20", "10", "19", "3"]);

  const activeSet =
    shiftType === "nuit_profonde"
      ? deepNightZones
      : shiftType === "nuit"
        ? nightZones
        : shiftType === "jour"
          ? dayZones
          : new Set<string>();

  // Anchor corridor zones get boosted
  const anchorZones = new Set(anchor ? (CORRIDOR_ZONES[anchor.corridor] ?? []) : []);

  const favoredZoneIds: string[] = [];

  for (const t of TERRITORIES) {
    const isActive = activeSet.has(t.id);
    const isAnchorZone = anchorZones.has(t.id);

    let heat = 0;
    if (isAnchorZone && isActive) {
      heat = 0.55 + breathPhase * 0.15;
      favoredZoneIds.push(t.id);
    } else if (isAnchorZone) {
      heat = 0.25 + breathPhase * 0.08;
      favoredZoneIds.push(t.id);
    } else if (isActive) {
      heat = 0.12 + breathPhase * 0.06;
    } else {
      heat = 0.02;
    }

    zoneHeat[t.id] = heat;
    zoneStates[t.id] = isAnchorZone && isActive
      ? "active"
      : isAnchorZone
        ? "forming"
        : isActive
          ? "fading"
          : "dormant";
    zoneSaturation[t.id] = 0;
  }

  return { zoneHeat, zoneStates, zoneSaturation, favoredZoneIds };
}

// -- Step titles --

const STEP_TITLES = ["Quand", "Ou"];
const STEP_SUBS = [
  "FLOW s'adapte a ton rythme.",
  "Choisis ton point de depart.",
];

// -- Main component --

export function Onboarding() {
  const navigate = useNavigate();
  const [state, setState] = useState<OnboardingState>({
    step: 0,
    shiftType: null,
    anchor: null,
  });
  const [breathPhase, setBreathPhase] = useState(0);
  const [entering, setEntering] = useState(true);
  const animRef = useRef(0);

  useEffect(() => {
    let t = 0;
    const tick = () => {
      t += 0.012;
      setBreathPhase(Math.sin(t) * 0.5 + 0.5);
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Intro animation
  useEffect(() => {
    const timer = setTimeout(() => setEntering(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  const mapData = buildOnboardingHeat(state.shiftType, state.anchor, breathPhase);

  const canAdvance =
    (state.step === 0 && state.shiftType !== null) ||
    (state.step === 1 && state.anchor !== null);

  const advance = () => {
    if (state.step < 1) {
      setState((prev) => ({ ...prev, step: prev.step + 1 }));
    } else {
      const prefs = {
        shiftType: state.shiftType,
        anchorId: state.anchor?.id,
        startedAt: Date.now(),
      };
      sessionStorage.setItem("flow-prefs", JSON.stringify(prefs));
      navigate("/flow");
    }
  };

  const goBack = () => {
    if (state.step > 0) {
      setState((prev) => ({ ...prev, step: prev.step - 1 }));
    }
  };

  return (
    <div
      className="h-screen w-screen flex flex-col lg:flex-row overflow-hidden relative"
      style={{ backgroundColor: C.bg, color: C.text }}
    >
      {/* Intro overlay */}
      <AnimatePresence>
        {entering && (
          <motion.div
            className="absolute inset-0 z-50 flex flex-col items-center justify-center"
            style={{ backgroundColor: C.bg }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col items-center gap-3"
            >
              <span
                className="uppercase tracking-[0.4em]"
                style={{ ...label, fontSize: "0.6rem", color: C.textDim }}
              >
                FLOW
              </span>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: 40 }}
                transition={{ duration: 1, delay: 0.6, ease: "easeOut" }}
                style={{ height: 1, backgroundColor: C.green }}
              />
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.6 }}
                style={{
                  ...label,
                  fontSize: "0.65rem",
                  color: C.textDim,
                  fontWeight: 300,
                  letterSpacing: "0.05em",
                }}
              >
                Sais ou aller. Avant les autres.
              </motion.span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map -- always visible, always alive */}
      <motion.div
        className="h-[42vh] lg:h-full lg:flex-[1.2] shrink-0 lg:shrink relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: entering ? 0.15 : 1 }}
        transition={{ duration: 0.8 }}
      >
        <FlowMap
          zoneHeat={mapData.zoneHeat}
          zoneStates={mapData.zoneStates}
          zoneSaturation={mapData.zoneSaturation}
          favoredZoneIds={mapData.favoredZoneIds}
          breathPhase={breathPhase}
          windowState="stable"
        />

        {/* Step progress */}
        <div className="absolute top-4 left-4 flex items-center gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                style={{
                  width: state.step === i ? 24 : 6,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor:
                    state.step === i ? C.green : i < state.step ? C.textDim : C.textGhost,
                  transition: "all 0.5s ease",
                }}
              />
              {state.step === i && (
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  style={{ ...mono, fontSize: "0.5rem", color: C.textDim }}
                >
                  {i + 1}/2
                </motion.span>
              )}
            </div>
          ))}
        </div>

        {/* Anchor badge on map */}
        {state.anchor && (
          <motion.div
            className="absolute top-4 right-4"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div
              className="px-2.5 py-1 flex items-center gap-1.5"
              style={{
                backgroundColor: "rgba(10, 10, 11, 0.85)",
                border: `1px solid ${C.greenDim}`,
                borderRadius: 3,
              }}
            >
              <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: C.green }} />
              <span style={{ ...label, fontSize: "0.55rem", color: C.green }}>
                {state.anchor.label}
              </span>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Panel */}
      <div
        className="flex-1 flex flex-col min-h-0 lg:max-w-[480px] lg:border-l overflow-hidden"
        style={{ borderColor: C.border }}
      >
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 sm:py-10 flex flex-col">
          <AnimatePresence mode="wait">
            {/* -- Step 0: Shift type -- */}
            {state.step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-6 flex-1"
              >
                <StepHeader title={STEP_TITLES[0]} sub={STEP_SUBS[0]} />

                <div className="flex flex-col gap-2">
                  {([
                    { id: "jour" as const, label: "JOUR", sub: "06h -- 18h", desc: "Affaires, aeroports, gares" },
                    { id: "nuit" as const, label: "NUIT", sub: "18h -- 02h", desc: "Restaurants, concerts, soirees" },
                    { id: "nuit_profonde" as const, label: "NUIT PROFONDE", sub: "22h -- 06h", desc: "Clubs, derniers metros, urgences" },
                  ] as const).map((opt) => (
                    <OptionButton
                      key={opt.id}
                      selected={state.shiftType === opt.id}
                      onClick={() => setState((prev) => ({ ...prev, shiftType: opt.id }))}
                      label={opt.label}
                      desc={opt.desc}
                      meta={opt.sub}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* -- Step 1: Anchor selection -- */}
            {state.step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-5 flex-1"
              >
                <StepHeader title={STEP_TITLES[1]} sub={STEP_SUBS[1]} />

                <div className="grid grid-cols-2 gap-2">
                  {ANCHOR_OPTIONS.map((anchor) => (
                    <motion.button
                      key={anchor.id}
                      onClick={() => setState((prev) => ({ ...prev, anchor }))}
                      className="text-left px-3 py-2.5 flex flex-col gap-0.5"
                      style={{
                        backgroundColor: state.anchor?.id === anchor.id ? `${C.green}10` : C.surface,
                        border: `1px solid ${state.anchor?.id === anchor.id ? C.greenDim : C.border}`,
                        borderRadius: 3,
                        cursor: "pointer",
                        transition: "all 0.25s ease",
                      }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <span
                        style={{
                          ...label,
                          fontSize: "0.7rem",
                          fontWeight: 500,
                          color: state.anchor?.id === anchor.id ? C.green : C.text,
                          transition: "color 0.25s ease",
                        }}
                      >
                        {anchor.label}
                      </span>
                      <span
                        className="uppercase tracking-[0.1em]"
                        style={{
                          ...mono,
                          fontSize: "0.45rem",
                          color: state.anchor?.id === anchor.id ? C.greenDim : C.textGhost,
                        }}
                      >
                        {anchor.corridor}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Spacer */}
          <div className="flex-1 min-h-4" />

          {/* Navigation */}
          <div className="flex items-center gap-3 pt-4">
            {state.step > 0 && (
              <button
                onClick={goBack}
                className="px-4 py-3 uppercase tracking-[0.15em]"
                style={{
                  ...label,
                  fontSize: "0.65rem",
                  fontWeight: 400,
                  color: C.textDim,
                  backgroundColor: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: 3,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                RETOUR
              </button>
            )}
            <button
              onClick={advance}
              disabled={!canAdvance}
              className="flex-1 py-3.5 uppercase tracking-[0.2em] text-center"
              style={{
                ...label,
                fontSize: "0.7rem",
                fontWeight: 500,
                color: canAdvance ? C.bg : C.textGhost,
                backgroundColor: canAdvance ? C.green : C.surface,
                border: `1px solid ${canAdvance ? C.green : C.border}`,
                borderRadius: 3,
                cursor: canAdvance ? "pointer" : "default",
                opacity: canAdvance ? 1 : 0.4,
                transition: "all 0.35s ease",
              }}
            >
              {state.step === 1 ? "COMMENCER" : "CONTINUER"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Sub-components --

function StepHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1
        style={{
          ...heading,
          fontSize: "clamp(2.2rem, 7vw, 3.5rem)",
          color: C.text,
          margin: 0,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h1>
      <p style={{ ...label, color: C.textDim, margin: 0, fontSize: "0.75rem" }}>
        {sub}
      </p>
    </div>
  );
}

function OptionButton({
  selected,
  onClick,
  label: optLabel,
  desc,
  meta,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  desc: string;
  meta: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      className="w-full text-left px-4 py-3.5 flex items-center justify-between"
      style={{
        backgroundColor: selected ? `${C.green}10` : C.surface,
        border: `1px solid ${selected ? C.greenDim : C.border}`,
        borderRadius: 3,
        cursor: "pointer",
        transition: "all 0.25s ease",
      }}
      whileTap={{ scale: 0.985 }}
    >
      <div className="flex flex-col gap-1">
        <span
          className="uppercase tracking-[0.2em]"
          style={{
            ...label,
            fontSize: "0.7rem",
            fontWeight: 500,
            color: selected ? C.green : C.text,
            transition: "color 0.25s ease",
          }}
        >
          {optLabel}
        </span>
        <span style={{ ...label, fontSize: "0.6rem", color: C.textDim, lineHeight: 1.5 }}>
          {desc}
        </span>
      </div>
      <span
        style={{
          ...mono,
          fontSize: "0.6rem",
          color: selected ? C.green : C.textGhost,
          transition: "color 0.25s ease",
        }}
      >
        {meta}
      </span>
    </motion.button>
  );
}
