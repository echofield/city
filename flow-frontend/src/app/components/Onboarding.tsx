// FLOW — 15-Second Onboarding
// 4 questions. Tap tap tap tap. LIVE.
// Driver feels immediately understood.
// Map stays visible in background — city reading starts immediately.

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import { C, label, mono } from "./theme";
import { FlowMap } from "./FlowMap";

// ── Types ──

type TimePreference = "jour" | "soir" | "nuit_profonde";
type DrivingStyle = "attendre" | "chasser" | "equilibre";
type SessionGoal = "100" | "200" | "300" | "max";
type Corridor = "centre" | "nord" | "ouest" | "est" | "sud";
type Hub = "cdg" | "orly" | "defense" | "gare_nord" | "montparnasse";

interface OnboardingState {
  step: number; // 1-4, then 5 = confirmation
  zones: Corridor[];
  hubs: Hub[];
  timePreference: TimePreference | null;
  style: DrivingStyle | null;
  goal: SessionGoal | null;
}

// ── Constants ──

const CORRIDORS: { id: Corridor; label: string }[] = [
  { id: "centre", label: "Centre" },
  { id: "nord", label: "Nord" },
  { id: "ouest", label: "Ouest" },
  { id: "est", label: "Est" },
  { id: "sud", label: "Sud" },
];

const HUBS: { id: Hub; label: string }[] = [
  { id: "cdg", label: "CDG" },
  { id: "orly", label: "Orly" },
  { id: "defense", label: "La Defense" },
  { id: "gare_nord", label: "Gare du Nord" },
  { id: "montparnasse", label: "Montparnasse" },
];

const TIME_OPTIONS: { id: TimePreference; label: string; sub: string; desc: string }[] = [
  { id: "jour", label: "JOUR", sub: "06h – 18h", desc: "Aeroports, gares, affaires" },
  { id: "soir", label: "SOIR", sub: "18h – 00h", desc: "Restaurants, concerts" },
  { id: "nuit_profonde", label: "NUIT PROFONDE", sub: "00h – 06h", desc: "Clubs, sorties tardives" },
];

const STYLE_OPTIONS: { id: DrivingStyle; label: string; desc: string }[] = [
  { id: "attendre", label: "ATTENDRE", desc: "Position fixe. Courses longues." },
  { id: "chasser", label: "CHASSER", desc: "Bouger souvent. Suivre les pics." },
  { id: "equilibre", label: "EQUILIBRE", desc: "Attente + mouvement." },
];

const GOAL_OPTIONS: { id: SessionGoal; label: string }[] = [
  { id: "100", label: "100 EUR" },
  { id: "200", label: "200 EUR" },
  { id: "300", label: "300 EUR" },
  { id: "max", label: "Maximiser la nuit" },
];

// ── Main Component ──

export function Onboarding() {
  const navigate = useNavigate();
  const [state, setState] = useState<OnboardingState>({
    step: 1,
    zones: [],
    hubs: [],
    timePreference: null,
    style: null,
    goal: null,
  });
  const [showIntro, setShowIntro] = useState(true);

  // Intro splash (1.5s)
  useEffect(() => {
    if (showIntro) {
      const timer = setTimeout(() => setShowIntro(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [showIntro]);

  // Toggle zone selection
  const toggleZone = (zone: Corridor) => {
    setState((prev) => ({
      ...prev,
      zones: prev.zones.includes(zone)
        ? prev.zones.filter((z) => z !== zone)
        : [...prev.zones, zone],
    }));
  };

  // Toggle hub selection
  const toggleHub = (hub: Hub) => {
    setState((prev) => ({
      ...prev,
      hubs: prev.hubs.includes(hub)
        ? prev.hubs.filter((h) => h !== hub)
        : [...prev.hubs, hub],
    }));
  };

  // Can advance to next step?
  const canAdvance =
    (state.step === 1 && state.zones.length > 0) ||
    (state.step === 2 && state.timePreference !== null) ||
    (state.step === 3 && state.style !== null) ||
    (state.step === 4 && state.goal !== null) ||
    state.step === 5;

  // Advance to next step
  const advance = () => {
    if (state.step < 5) {
      setState((prev) => ({ ...prev, step: prev.step + 1 }));
    } else {
      // Save preferences and navigate to LIVE
      const prefs = {
        zones: state.zones,
        hubs: state.hubs,
        timePreference: state.timePreference,
        style: state.style,
        goal: state.goal,
        startedAt: Date.now(),
      };
      sessionStorage.setItem("flow-prefs", JSON.stringify(prefs));
      navigate("/flow");
    }
  };

  // ── Intro Splash ──
  if (showIntro) {
    return (
      <motion.div
        className="h-screen w-screen flex flex-col items-center justify-center"
        style={{ backgroundColor: C.bg }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <h1
            className="uppercase tracking-[0.5em] text-xl"
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 300,
              color: C.text,
            }}
          >
            FLOW
          </h1>
          <p
            style={{
              ...label,
              fontSize: "0.85rem",
              color: C.textDim,
            }}
          >
            Calibration rapide
          </p>
        </motion.div>
      </motion.div>
    );
  }

  // ── Confirmation Screen (Step 5) ──
  if (state.step === 5) {
    return (
      <div
        className="h-screen w-screen relative overflow-hidden"
        style={{ backgroundColor: C.bg }}
      >
        {/* Background Map — more visible on confirmation */}
        <div className="absolute inset-0 opacity-40">
          <FlowMap
            zoneHeat={{}}
            zoneStates={{}}
            zoneSaturation={{}}
            favoredZoneIds={state.zones}
            breathPhase={0}
            windowState="stable"
          />
        </div>

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, ${C.bg}dd 0%, ${C.bg}cc 50%, ${C.bg}ee 100%)`,
          }}
        />

        <motion.div
          className="relative z-10 h-full flex flex-col items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="flex flex-col items-center gap-6 max-w-sm w-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.8rem",
              fontWeight: 300,
              color: C.text,
              textAlign: "center",
            }}
          >
            Flow calibre pour :
          </h1>

          {/* Calibration summary */}
          <div className="flex flex-col gap-2 w-full">
            {/* Time */}
            <div className="flex items-center gap-2">
              <span style={{ color: C.green, fontSize: "0.9rem" }}>✓</span>
              <span style={{ ...label, fontSize: "0.85rem", color: C.text }}>
                {state.timePreference === "jour" ? "Jour" :
                 state.timePreference === "soir" ? "Soir" : "Nuit profonde"}
              </span>
            </div>
            {/* Style */}
            <div className="flex items-center gap-2">
              <span style={{ color: C.green, fontSize: "0.9rem" }}>✓</span>
              <span style={{ ...label, fontSize: "0.85rem", color: C.text }}>
                Style : {state.style === "attendre" ? "Attendre" :
                        state.style === "chasser" ? "Chasser" : "Equilibre"}
              </span>
            </div>
            {/* Zones */}
            <div className="flex items-center gap-2">
              <span style={{ color: C.green, fontSize: "0.9rem" }}>✓</span>
              <span style={{ ...label, fontSize: "0.85rem", color: C.text }}>
                Zones : {[...state.zones.map(z => z.charAt(0).toUpperCase() + z.slice(1)),
                          ...state.hubs.map(h => HUBS.find(x => x.id === h)?.label || h)].join(" / ")}
              </span>
            </div>
            {/* Goal */}
            <div className="flex items-center gap-2">
              <span style={{ color: C.green, fontSize: "0.9rem" }}>✓</span>
              <span style={{ ...label, fontSize: "0.85rem", color: C.text }}>
                Objectif : {state.goal === "max" ? "Maximiser" : `${state.goal} EUR`}
              </span>
            </div>
          </div>

          {/* Launch button */}
          <button
            onClick={advance}
            className="w-full py-4 uppercase tracking-[0.2em] mt-4"
            style={{
              ...label,
              fontSize: "0.8rem",
              fontWeight: 500,
              color: C.bg,
              backgroundColor: C.green,
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            LANCER FLOW
          </button>

          <p
            style={{
              ...label,
              fontSize: "0.7rem",
              color: C.textGhost,
              textAlign: "center",
            }}
          >
            Lecture du champ en cours...
          </p>
        </motion.div>
        </motion.div>
      </div>
    );
  }

  // ── Question Screens (Steps 1-4) ──
  return (
    <div
      className="h-screen w-screen relative overflow-hidden"
      style={{ backgroundColor: C.bg, color: C.text }}
    >
      {/* Background Map — city visible while answering */}
      <div className="absolute inset-0 opacity-30">
        <FlowMap
          zoneHeat={{}}
          zoneStates={{}}
          zoneSaturation={{}}
          favoredZoneIds={state.zones}
          breathPhase={0}
          windowState="stable"
        />
      </div>

      {/* Gradient overlay for readability */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, ${C.bg}ee 0%, ${C.bg}dd 40%, ${C.bg}cc 100%)`,
        }}
      />

      {/* Questions overlay */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6">
        <div className="flex flex-col gap-6 max-w-sm w-full">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          <span
            style={{
              ...mono,
              fontSize: "0.7rem",
              color: C.textDim,
            }}
          >
            {state.step} / 4
          </span>
        </div>

        <AnimatePresence mode="wait">
          {/* ── Q1: Où travailles-tu ? ── */}
          {state.step === 1 && (
            <motion.div
              key="q1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col gap-1 text-center">
                <h1
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "1.6rem",
                    fontWeight: 300,
                    color: C.text,
                    margin: 0,
                  }}
                >
                  Ou travailles-tu le plus ?
                </h1>
                <p style={{ ...label, fontSize: "0.7rem", color: C.textDim }}>
                  Selectionne tes zones principales.
                </p>
              </div>

              {/* Corridors - main zones */}
              <div className="flex flex-wrap gap-2 justify-center">
                {CORRIDORS.map((corridor) => {
                  const selected = state.zones.includes(corridor.id);
                  return (
                    <button
                      key={corridor.id}
                      onClick={() => toggleZone(corridor.id)}
                      className="px-4 py-2.5"
                      style={{
                        backgroundColor: selected ? `${C.green}15` : C.surface,
                        border: `1px solid ${selected ? C.green : C.border}`,
                        borderRadius: 4,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span
                        style={{
                          ...label,
                          fontSize: "0.8rem",
                          fontWeight: selected ? 500 : 400,
                          color: selected ? C.green : C.text,
                        }}
                      >
                        {corridor.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Hubs - optional */}
              <div className="flex flex-col gap-2">
                <span
                  style={{
                    ...label,
                    fontSize: "0.6rem",
                    color: C.textGhost,
                    textAlign: "center",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                  }}
                >
                  Optionnel
                </span>
                <div className="flex flex-wrap gap-2 justify-center">
                  {HUBS.map((hub) => {
                    const selected = state.hubs.includes(hub.id);
                    return (
                      <button
                        key={hub.id}
                        onClick={() => toggleHub(hub.id)}
                        className="px-3 py-1.5"
                        style={{
                          backgroundColor: selected ? `${C.green}12` : "transparent",
                          border: `1px solid ${selected ? C.greenDim : C.border}`,
                          borderRadius: 3,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span
                          style={{
                            ...label,
                            fontSize: "0.65rem",
                            color: selected ? C.green : C.textDim,
                          }}
                        >
                          {hub.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Q2: Quand conduis-tu ? ── */}
          {state.step === 2 && (
            <motion.div
              key="q2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col gap-1 text-center">
                <h1
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "1.6rem",
                    fontWeight: 300,
                    color: C.text,
                    margin: 0,
                  }}
                >
                  Quand conduis-tu le plus ?
                </h1>
              </div>

              <div className="flex flex-col gap-2">
                {TIME_OPTIONS.map((opt) => {
                  const selected = state.timePreference === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setState((prev) => ({ ...prev, timePreference: opt.id }))}
                      className="w-full text-left px-4 py-3 flex items-center justify-between"
                      style={{
                        backgroundColor: selected ? `${C.green}12` : C.surface,
                        border: `1px solid ${selected ? C.green : C.border}`,
                        borderRadius: 4,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span
                          className="uppercase tracking-[0.15em]"
                          style={{
                            ...label,
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            color: selected ? C.green : C.text,
                          }}
                        >
                          {opt.label}
                        </span>
                        <span style={{ ...label, fontSize: "0.65rem", color: C.textDim }}>
                          {opt.desc}
                        </span>
                      </div>
                      <span style={{ ...mono, fontSize: "0.6rem", color: C.textDim }}>
                        {opt.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Q3: Comment travailles-tu ? ── */}
          {state.step === 3 && (
            <motion.div
              key="q3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col gap-1 text-center">
                <h1
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "1.6rem",
                    fontWeight: 300,
                    color: C.text,
                    margin: 0,
                  }}
                >
                  Comment travailles-tu ?
                </h1>
                <p style={{ ...label, fontSize: "0.7rem", color: C.textDim }}>
                  Ton style aide Flow a proposer les bons signaux.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {STYLE_OPTIONS.map((opt) => {
                  const selected = state.style === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setState((prev) => ({ ...prev, style: opt.id }))}
                      className="w-full text-left px-4 py-3"
                      style={{
                        backgroundColor: selected ? `${C.green}12` : C.surface,
                        border: `1px solid ${selected ? C.green : C.border}`,
                        borderRadius: 4,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span
                        className="uppercase tracking-[0.15em]"
                        style={{
                          ...label,
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          color: selected ? C.green : C.text,
                        }}
                      >
                        {opt.label}
                      </span>
                      <span
                        style={{
                          ...label,
                          fontSize: "0.7rem",
                          color: C.textDim,
                          marginLeft: 8,
                        }}
                      >
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Q4: Objectif de session ? ── */}
          {state.step === 4 && (
            <motion.div
              key="q4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-5"
            >
              <div className="flex flex-col gap-1 text-center">
                <h1
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "1.6rem",
                    fontWeight: 300,
                    color: C.text,
                    margin: 0,
                  }}
                >
                  Objectif de la session ?
                </h1>
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                {GOAL_OPTIONS.map((opt) => {
                  const selected = state.goal === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setState((prev) => ({ ...prev, goal: opt.id }))}
                      className="px-5 py-3"
                      style={{
                        backgroundColor: selected ? `${C.green}15` : C.surface,
                        border: `1px solid ${selected ? C.green : C.border}`,
                        borderRadius: 4,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        minWidth: opt.id === "max" ? "100%" : "auto",
                      }}
                    >
                      <span
                        style={{
                          ...mono,
                          fontSize: opt.id === "max" ? "0.8rem" : "1rem",
                          fontWeight: selected ? 600 : 400,
                          color: selected ? C.green : C.text,
                        }}
                      >
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Continue button */}
        <button
          onClick={advance}
          disabled={!canAdvance}
          className="w-full py-3.5 uppercase tracking-[0.2em] mt-2"
          style={{
            ...label,
            fontSize: "0.75rem",
            fontWeight: 500,
            color: canAdvance ? C.bg : C.textGhost,
            backgroundColor: canAdvance ? C.green : C.surface,
            border: `1px solid ${canAdvance ? C.green : C.border}`,
            borderRadius: 4,
            cursor: canAdvance ? "pointer" : "default",
            opacity: canAdvance ? 1 : 0.5,
            transition: "all 0.2s ease",
          }}
        >
          CONTINUER
        </button>
        </div>
      </div>
    </div>
  );
}
