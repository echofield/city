// FLOW — Reactive Onboarding
// The system is alive from the first tap.
// 3 steps: Shift type, Zones, Style. Map reacts immediately.

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import { FlowMap } from "./FlowMap";
import { TERRITORIES } from "./parisData";
import { C, label, mono } from "./theme";
import type { ZoneState } from "./FlowEngine";

// ── Types ──

type ShiftType = "jour" | "nuit" | "nuit_profonde";
type DrivingStyle = "attendre" | "chasser" | "equilibre";

interface OnboardingState {
  step: number; // 0, 1, 2
  shiftType: ShiftType | null;
  selectedZones: string[];
  style: DrivingStyle | null;
}

// ── Simulated map state based on onboarding choices ──

function buildOnboardingHeat(
  shiftType: ShiftType | null,
  selectedZones: string[],
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
  const selectedSet = new Set(selectedZones);

  // Night corridors — different zones light up based on shift type
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

  for (const t of TERRITORIES) {
    const isActive = activeSet.has(t.id);
    const isSelected = selectedSet.has(t.id);

    let heat = 0;
    if (isSelected) {
      heat = 0.55 + breathPhase * 0.15;
    } else if (isActive) {
      heat = 0.15 + breathPhase * 0.08;
    } else {
      heat = 0.02;
    }

    zoneHeat[t.id] = heat;
    zoneStates[t.id] = isSelected
      ? "active"
      : isActive
        ? "forming"
        : "dormant";
    zoneSaturation[t.id] = 0;
  }

  return {
    zoneHeat,
    zoneStates,
    zoneSaturation,
    favoredZoneIds: selectedZones,
  };
}

// ── Main component ──

export function Onboarding() {
  const navigate = useNavigate();
  const [state, setState] = useState<OnboardingState>({
    step: 0,
    shiftType: null,
    selectedZones: [],
    style: null,
  });
  const [breathPhase, setBreathPhase] = useState(0);
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

  const mapData = buildOnboardingHeat(
    state.shiftType,
    state.selectedZones,
    breathPhase
  );

  const handleZoneTap = useCallback(
    (id: string) => {
      if (state.step !== 1) return;
      setState((prev) => {
        const zones = prev.selectedZones.includes(id)
          ? prev.selectedZones.filter((z) => z !== id)
          : prev.selectedZones.length < 5
            ? [...prev.selectedZones, id]
            : prev.selectedZones;
        return { ...prev, selectedZones: zones };
      });
    },
    [state.step]
  );

  const canAdvance =
    (state.step === 0 && state.shiftType !== null) ||
    (state.step === 1 && state.selectedZones.length >= 1) ||
    (state.step === 2 && state.style !== null);

  const advance = () => {
    if (state.step < 2) {
      setState((prev) => ({ ...prev, step: prev.step + 1 }));
    } else {
      // Save preferences and navigate to dashboard
      const prefs = {
        shiftType: state.shiftType,
        zones: state.selectedZones,
        style: state.style,
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
      className="h-screen w-screen flex flex-col lg:flex-row overflow-hidden"
      style={{ backgroundColor: C.bg, color: C.text }}
    >
      {/* Map — always visible, always alive */}
      <motion.div
        className="h-[45vh] lg:h-full lg:flex-[1.2] shrink-0 lg:shrink relative"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <FlowMap
          zoneHeat={mapData.zoneHeat}
          zoneStates={mapData.zoneStates}
          zoneSaturation={mapData.zoneSaturation}
          favoredZoneIds={mapData.favoredZoneIds}
          breathPhase={breathPhase}
          windowState="stable"
          selectedZoneIds={state.selectedZones}
          onZoneTap={state.step === 1 ? handleZoneTap : undefined}
        />

        {/* Step indicator on map */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: state.step === i ? 20 : 6,
                height: 3,
                borderRadius: 2,
                backgroundColor:
                  state.step === i ? C.green : i < state.step ? C.grayDim : C.textGhost,
                transition: "all 0.4s ease",
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* Panel */}
      <div
        className="flex-1 flex flex-col min-h-0 lg:max-w-[480px] lg:border-l overflow-hidden"
        style={{ borderColor: C.border }}
      >
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 sm:py-10 flex flex-col">
          <AnimatePresence mode="wait">
            {/* ── Step 0: Shift type ── */}
            {state.step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-6 flex-1"
              >
                <div className="flex flex-col gap-2">
                  <h1
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: "clamp(2rem, 6vw, 3rem)",
                      fontWeight: 300,
                      lineHeight: 1.1,
                      color: C.text,
                      margin: 0,
                    }}
                  >
                    Quand
                  </h1>
                  <p style={{ ...label, color: C.textDim, margin: 0 }}>
                    Le champ s'adapte a ton rythme.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {(
                    [
                      { id: "jour" as const, label: "JOUR", sub: "06h — 18h", desc: "Affaires, aeroports, gares" },
                      { id: "nuit" as const, label: "NUIT", sub: "18h — 02h", desc: "Restaurants, concerts, soirees" },
                      { id: "nuit_profonde" as const, label: "NUIT PROFONDE", sub: "22h — 06h", desc: "Clubs, derniers metros, urgences" },
                    ] as const
                  ).map((opt) => {
                    const selected = state.shiftType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() =>
                          setState((prev) => ({ ...prev, shiftType: opt.id }))
                        }
                        className="w-full text-left px-4 py-3.5 flex items-center justify-between"
                        style={{
                          backgroundColor: selected ? `${C.green}12` : C.surface,
                          border: `1px solid ${selected ? C.greenDim : C.border}`,
                          borderRadius: 3,
                          cursor: "pointer",
                          transition: "all 0.25s ease",
                        }}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span
                            className="uppercase tracking-[0.2em]"
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

            {/* ── Step 1: Zone selection ── */}
            {state.step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-6 flex-1"
              >
                <div className="flex flex-col gap-2">
                  <h1
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: "clamp(2rem, 6vw, 3rem)",
                      fontWeight: 300,
                      lineHeight: 1.1,
                      color: C.text,
                      margin: 0,
                    }}
                  >
                    Ou
                  </h1>
                  <p style={{ ...label, color: C.textDim, margin: 0 }}>
                    Selectionne tes zones sur la carte. Maximum 5.
                  </p>
                </div>

                {/* Selected zones display */}
                <div className="flex flex-wrap gap-2">
                  {state.selectedZones.length === 0 ? (
                    <span style={{ ...label, fontSize: "0.7rem", color: C.textGhost }}>
                      Touche une zone sur la carte...
                    </span>
                  ) : (
                    state.selectedZones.map((zid) => {
                      const t = TERRITORIES.find((x) => x.id === zid);
                      return (
                        <motion.button
                          key={zid}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          className="flex items-center gap-2 px-3 py-1.5"
                          style={{
                            backgroundColor: `${C.green}15`,
                            border: `1px solid ${C.greenDim}`,
                            borderRadius: 3,
                            cursor: "pointer",
                          }}
                          onClick={() => handleZoneTap(zid)}
                        >
                          <span style={{ ...label, fontSize: "0.7rem", color: C.green }}>
                            {t?.name ?? zid}
                          </span>
                          <span style={{ ...mono, fontSize: "0.55rem", color: C.textDim }}>
                            {t?.subtitle?.split(" · ")[0] ?? ""}
                          </span>
                          <span style={{ color: C.textDim, fontSize: "0.6rem" }}>x</span>
                        </motion.button>
                      );
                    })
                  )}
                </div>

                <div
                  className="px-4 py-3"
                  style={{
                    backgroundColor: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 3,
                  }}
                >
                  <span style={{ ...label, fontSize: "0.7rem", color: C.textDim }}>
                    {state.selectedZones.length}/5 zones selectionnees.
                    Le systeme ajuste le champ autour de tes positions preferees.
                  </span>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Driving style ── */}
            {state.step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-6 flex-1"
              >
                <div className="flex flex-col gap-2">
                  <h1
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontSize: "clamp(2rem, 6vw, 3rem)",
                      fontWeight: 300,
                      lineHeight: 1.1,
                      color: C.text,
                      margin: 0,
                    }}
                  >
                    Comment
                  </h1>
                  <p style={{ ...label, color: C.textDim, margin: 0 }}>
                    Ton style calibre la lecture du champ.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {(
                    [
                      {
                        id: "attendre" as const,
                        label: "ATTENDRE",
                        desc: "Position fixe, laisser venir. Fenetres longues.",
                        icon: "—",
                      },
                      {
                        id: "chasser" as const,
                        label: "CHASSER",
                        desc: "Mouvement constant, suivre les pics. Fenetres courtes.",
                        icon: ">>",
                      },
                      {
                        id: "equilibre" as const,
                        label: "EQUILIBRE",
                        desc: "Alterner positions et mouvements. Adaptatif.",
                        icon: "<>",
                      },
                    ] as const
                  ).map((opt) => {
                    const selected = state.style === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() =>
                          setState((prev) => ({ ...prev, style: opt.id }))
                        }
                        className="w-full text-left px-4 py-3.5 flex items-center justify-between"
                        style={{
                          backgroundColor: selected ? `${C.green}12` : C.surface,
                          border: `1px solid ${selected ? C.greenDim : C.border}`,
                          borderRadius: 3,
                          cursor: "pointer",
                          transition: "all 0.25s ease",
                        }}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span
                            className="uppercase tracking-[0.2em]"
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
                        <span
                          style={{
                            ...mono,
                            fontSize: "0.8rem",
                            color: selected ? C.green : C.textGhost,
                          }}
                        >
                          {opt.icon}
                        </span>
                      </button>
                    );
                  })}
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
                  fontSize: "0.7rem",
                  fontWeight: 400,
                  color: C.textDim,
                  backgroundColor: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                RETOUR
              </button>
            )}
            <button
              onClick={advance}
              disabled={!canAdvance}
              className="flex-1 py-3 uppercase tracking-[0.2em] text-center"
              style={{
                ...label,
                fontSize: "0.75rem",
                fontWeight: 500,
                color: canAdvance ? C.bg : C.textGhost,
                backgroundColor: canAdvance ? C.green : C.surface,
                border: `1px solid ${canAdvance ? C.green : C.border}`,
                borderRadius: 3,
                cursor: canAdvance ? "pointer" : "default",
                opacity: canAdvance ? 1 : 0.5,
                transition: "all 0.3s ease",
              }}
            >
              {state.step === 2 ? "LANCER LE CHAMP" : "CONTINUER"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
