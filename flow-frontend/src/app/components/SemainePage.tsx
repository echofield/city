import { useMemo } from "react";
import { motion } from "motion/react";
import { C, mono, label } from "./theme";
import type { WeekSignal, WeekBriefing } from "./FlowEngine";
import { buildWeekBriefing } from "./FlowEngine";
import { SectionHeader } from "./FlowUI";
import { SignalIntensity } from "./SignalIntensity";

// ── Demand visual ──

function demandColor(demand?: WeekSignal["demand_level"]): string {
  switch (demand) {
    case "very_high": return C.green;
    case "high": return C.greenDim;
    case "moderate": return C.amber;
    case "low": return C.textDim;
    default: return C.textDim;
  }
}

function demandText(demand?: WeekSignal["demand_level"]): string {
  switch (demand) {
    case "very_high": return "TRES FORTE";
    case "high": return "FORTE";
    case "moderate": return "MODEREE";
    case "low": return "FAIBLE";
    default: return "";
  }
}

// ── Macro Pulse — Week character and summary ──

function MacroPulse({ briefing }: { briefing: WeekBriefing }) {
  const charColor = briefing.weekIntensity >= 0.78 ? C.green
    : briefing.weekIntensity >= 0.62 ? C.amber
    : C.textDim;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col gap-3 px-5 py-5"
      style={{
        backgroundColor: C.surface,
        borderLeft: `3px solid ${charColor}`,
        borderRadius: 3,
      }}
    >
      {/* Week character — the big word */}
      <div className="flex items-baseline justify-between">
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: "clamp(1.1rem, 3.5vw, 1.5rem)",
            color: C.textBright,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
          }}
        >
          {briefing.weekCharacter}
        </span>
        <div className="flex items-center gap-1">
          <span style={{ ...mono, fontSize: "0.4rem", color: charColor }}>
            {"\u25CF"}
          </span>
          <span style={{ ...mono, fontSize: "0.7rem", color: charColor }}>
            {Math.round(briefing.weekIntensity * 100)}
          </span>
        </div>
      </div>

      {/* Summary — the field reading */}
      <div className="flex flex-col gap-2">
        <span style={{ ...label, fontSize: "0.6rem", color: C.textMid, lineHeight: 1.5 }}>
          {briefing.briefingParagraph1}
        </span>
        <span style={{ ...label, fontSize: "0.6rem", color: C.textDim, lineHeight: 1.5 }}>
          {briefing.briefingParagraph2}
        </span>
      </div>

      {/* Briefing confidence */}
      <div className="flex items-center justify-between pt-1" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0">
            <span
              className="uppercase tracking-[0.15em]"
              style={{ ...mono, fontSize: "0.3rem", color: C.textGhost }}
            >
              MEILLEURE NUIT
            </span>
            <span style={{ ...label, fontSize: "0.6rem", color: C.textBright }}>
              {briefing.bestNight}
            </span>
          </div>
          <div className="flex flex-col gap-0">
            <span
              className="uppercase tracking-[0.15em]"
              style={{ ...mono, fontSize: "0.3rem", color: C.textGhost }}
            >
              MEILLEUR JOUR
            </span>
            <span style={{ ...label, fontSize: "0.6rem", color: C.textBright }}>
              {briefing.bestDay}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span style={{ ...mono, fontSize: "0.4rem", color: C.textDim }}>
            CONFIDENCE
          </span>
          <span
            className="uppercase tracking-[0.1em]"
            style={{
              ...mono,
              fontSize: "0.45rem",
              color: briefing.briefingConfidence === "HIGH" ? C.green
                : briefing.briefingConfidence === "MODERATE" ? C.amber
                : C.textDim,
            }}
          >
            {briefing.briefingConfidence}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── City Rhythm — ASCII weekly demand map ──

const DAY_LABELS = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];

function CityRhythm({ signals }: { signals: WeekSignal[] }) {
  // Build intensity per day (0-1) from signal count + demand levels
  const dayIntensity = useMemo(() => {
    const acc: number[] = [0, 0, 0, 0, 0, 0, 0];
    const cnt: number[] = [0, 0, 0, 0, 0, 0, 0];
    for (const s of signals) {
      const idx = s.day_index;
      if (idx < 0 || idx > 6) continue;
      const w = s.demand_level === "very_high" ? 1
        : s.demand_level === "high" ? 0.75
        : s.demand_level === "moderate" ? 0.45
        : 0.2;
      acc[idx] += w;
      cnt[idx]++;
    }
    const max = Math.max(...acc, 1);
    return acc.map((v) => v / max);
  }, [signals]);

  const maxBars = 7;

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3" style={{ backgroundColor: C.surface, borderRadius: 3 }}>
      <span
        className="uppercase tracking-[0.25em]"
        style={{ ...mono, fontSize: "0.28rem", color: C.textGhost }}
      >
        RYTHME URBAIN
      </span>
      <div className="flex flex-col gap-1">
        {DAY_LABELS.map((d, i) => {
          const intensity = dayIntensity[i];
          const bars = Math.max(1, Math.round(intensity * maxBars));
          const barColor = intensity >= 0.7 ? C.green
            : intensity >= 0.4 ? C.amber
            : C.textDim;
          // Build block chars: filled blocks + empty blocks
          const filled = "\u2593".repeat(bars);
          const empty = "\u2591".repeat(maxBars - bars);

          return (
            <div key={d} className="flex items-center gap-2">
              <span style={{ ...mono, fontSize: "0.4rem", color: C.textDim, width: 22, flexShrink: 0 }}>
                {d}
              </span>
              <span style={{ ...mono, fontSize: "0.4rem", color: barColor, letterSpacing: "0.05em" }}>
                {filled}
              </span>
              <span style={{ ...mono, fontSize: "0.4rem", color: `${C.textGhost}40`, letterSpacing: "0.05em" }}>
                {empty}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Structural Rhythms — Which corridors are strong ──

function StructuralRhythms({ corridors }: { corridors: WeekBriefing["strongCorridors"] }) {
  if (corridors.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {corridors.map((c, i) => {
        const barColor = c.intensity >= 0.7 ? C.green
          : c.intensity >= 0.5 ? C.amber
          : C.textDim;
        const w = Math.max(8, Math.round(c.intensity * 100));

        return (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.15, delay: i * 0.04 }}
            className="flex items-center gap-3 px-4 py-2"
            style={{
              backgroundColor: C.surface,
              borderRadius: 3,
            }}
          >
            {/* Corridor label + bar */}
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span
                  className="uppercase tracking-[0.12em]"
                  style={{ ...mono, fontSize: "0.45rem", color: C.textMid }}
                >
                  {c.label}
                </span>
                <span style={{ ...mono, fontSize: "0.4rem", color: barColor }}>
                  {Math.round(c.intensity * 100)}
                </span>
              </div>
              <div className="h-[3px] relative" style={{ backgroundColor: `${C.textGhost}30`, borderRadius: 1 }}>
                <motion.div
                  className="h-full absolute left-0 top-0"
                  style={{ backgroundColor: barColor, borderRadius: 1 }}
                  initial={{ width: 0 }}
                  animate={{ width: `${w}%` }}
                  transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.08 }}
                />
              </div>
              {/* Reason */}
              <span style={{ ...label, fontSize: "0.4rem", color: C.textDim, lineHeight: 1.3 }}>
                {c.reason}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Event Distortions — What amplifies or distorts the field ──

function EventDistortions({ distortions }: { distortions: WeekBriefing["eventDistortions"] }) {
  if (distortions.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {distortions.map((d, i) => {
        const magColor = d.magnitude === "fort" ? C.green : C.amber;

        return (
          <motion.div
            key={`${d.day}-${d.venue}-${i}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12, delay: i * 0.04 }}
            className="flex items-start gap-3 px-4 py-2.5"
            style={{
              backgroundColor: C.surface,
              borderLeft: `2px solid ${magColor}`,
              borderRadius: 2,
            }}
          >
            {/* Day */}
            <span
              className="shrink-0 w-16"
              style={{ ...mono, fontSize: "0.5rem", color: C.textMid }}
            >
              {d.day}
            </span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span style={{ ...label, fontSize: "0.55rem", color: C.textBright, lineHeight: 1.2 }}>
                {d.venue}
              </span>
              <span style={{ ...mono, fontSize: "0.4rem", color: C.textDim, lineHeight: 1.3 }}>
                {d.effect}
              </span>
            </div>
            {/* Magnitude badge */}
            <span
              className="shrink-0 uppercase tracking-[0.1em]"
              style={{
                ...mono,
                fontSize: "0.3rem",
                color: magColor,
                padding: "1px 5px",
                border: `1px solid ${magColor}30`,
                borderRadius: 2,
              }}
            >
              {d.magnitude === "fort" ? "FORT" : "MODERE"}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ── Day Money Window — Compact card ──

function DayWindowCard({ signal, index }: { signal: WeekSignal; index: number }) {
  const dColor = demandColor(signal.demand_level);

  // Build a cause-specific reason (not generic)
  const causeReason = signal.reason;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12, delay: index * 0.03 }}
      className="flex flex-col"
      style={{
        backgroundColor: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 3,
        overflow: "hidden",
      }}
    >
      {/* Row 1: Day + time + demand */}
      <div className="flex items-center justify-between px-4 pt-2.5 pb-1">
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
              fontSize: "0.75rem",
              color: C.text,
              lineHeight: 1.2,
            }}
          >
            {signal.day}
          </span>
          <span style={{ ...mono, fontSize: "0.45rem", color: C.textDim }}>
            {signal.time_window.start} \u2013 {signal.time_window.end}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <SignalIntensity value={signal.confidence} size={3} />
          <span
            className="uppercase tracking-[0.1em]"
            style={{ ...label, fontSize: "0.35rem", color: dColor }}
          >
            {demandText(signal.demand_level)}
          </span>
        </div>
      </div>

      {/* Row 2: Cause + title */}
      <div className="px-4 pb-1.5">
        <span style={{ ...label, fontSize: "0.55rem", color: C.textMid, lineHeight: 1.3 }}>
          {causeReason}
        </span>
      </div>

      {/* Row 3: Zones */}
      {signal.zones && signal.zones.length > 0 && (
        <div className="flex items-center gap-1 px-4 pb-2">
          {signal.zones.map((z, i) => (
            <span
              key={i}
              style={{
                ...mono,
                fontSize: "0.4rem",
                color: C.textDim,
                padding: "1px 5px",
                border: `1px solid ${C.border}`,
                borderRadius: 2,
              }}
            >
              {z}
            </span>
          ))}
          {signal.ride_profile && signal.ride_profile !== "mixte" && (
            <span style={{ ...mono, fontSize: "0.4rem", color: C.textDim }}>
              {signal.ride_profile === "longues" ? "Courses longues" : "Courses courtes"}
            </span>
          )}
        </div>
      )}

      {/* Row 4: Strategy + amplifiers */}
      {(signal.strategy || (signal.amplifiers && signal.amplifiers.length > 0)) && (
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          {signal.strategy && (
            <span style={{ ...label, fontSize: "0.45rem", color: C.text, lineHeight: 1.3 }}>
              {signal.strategy}
            </span>
          )}
          {signal.amplifiers && signal.amplifiers.length > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              {signal.amplifiers.map((amp, i) => (
                <span
                  key={i}
                  className="uppercase tracking-[0.08em]"
                  style={{
                    ...mono,
                    fontSize: "0.3rem",
                    color: C.amber,
                    padding: "1px 4px",
                    border: `1px solid ${C.amberDim}`,
                    borderRadius: 2,
                  }}
                >
                  {amp}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Main Component ──

interface SemainePageProps {
  signals: WeekSignal[];
}

export function SemainePage({ signals }: SemainePageProps) {
  const briefing = useMemo(() => buildWeekBriefing(signals), [signals]);

  // Group signals by day
  const byDay = useMemo(() => {
    const map = new Map<string, WeekSignal[]>();
    for (const s of signals) {
      const existing = map.get(s.day) ?? [];
      existing.push(s);
      map.set(s.day, existing);
    }
    return map;
  }, [signals]);

  // Ordered days
  const orderedDays = useMemo(() => {
    const dayOrder = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
    return dayOrder.filter(d => byDay.has(d));
  }, [byDay]);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: C.bg }}>
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-3"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <span
          className="uppercase tracking-[0.3em]"
          style={{ ...label, fontSize: "0.6rem", fontWeight: 500, color: C.text }}
        >
          SEMAINE
        </span>
        <span style={{ ...mono, fontSize: "0.5rem", color: C.textDim }}>
          {signals.length} fenetres
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0 px-3 sm:px-4 py-3">
          {/* ── MACRO PULSE ── */}
          <MacroPulse briefing={briefing} />

          {/* ── RYTHME URBAIN ── */}
          {signals.length > 0 && (
            <div className="mt-2">
              <CityRhythm signals={signals} />
            </div>
          )}

          {/* ── RYTHMES STRUCTURELS ── */}
          {briefing.strongCorridors.length > 0 && (
            <>
              <SectionHeader text="RYTHMES STRUCTURELS" />
              <StructuralRhythms corridors={briefing.strongCorridors} />
            </>
          )}

          {/* ── DISTORSIONS EVENEMENTIELLES ── */}
          {briefing.eventDistortions.length > 0 && (
            <>
              <SectionHeader text="DISTORSIONS" />
              <EventDistortions distortions={briefing.eventDistortions} />
            </>
          )}

          {/* ── MEILLEURES FENETRES ── */}
          {briefing.bestWindows && briefing.bestWindows.length > 0 && (
            <>
              <SectionHeader text="MEILLEURES FENETRES" />
              <div className="flex flex-col gap-1">
                {briefing.bestWindows.map((w, i) => {
                  const rideColor = w.rideProfile === "LONG" ? C.green : w.rideProfile === "COURT" ? C.textDim : C.amber;
                  return (
                    <motion.div
                      key={`bw-${i}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.12, delay: i * 0.04 }}
                      className="flex items-center gap-3 px-4 py-2.5"
                      style={{
                        backgroundColor: C.surface,
                        borderLeft: `2px solid ${rideColor}`,
                        borderRadius: 2,
                      }}
                    >
                      {/* Day + time */}
                      <div className="flex flex-col gap-0 shrink-0 w-20">
                        <span style={{ ...label, fontSize: "0.55rem", color: C.textBright }}>
                          {w.day}
                        </span>
                        <span style={{ ...mono, fontSize: "0.4rem", color: C.textDim }}>
                          {w.time}
                        </span>
                      </div>
                      {/* Venue + cause */}
                      <div className="flex flex-col gap-0 flex-1 min-w-0">
                        <span style={{ ...label, fontSize: "0.5rem", color: C.text, lineHeight: 1.3 }}>
                          {w.venue}
                        </span>
                        <span style={{ ...mono, fontSize: "0.35rem", color: C.textDim, lineHeight: 1.3 }}>
                          {w.cause}
                        </span>
                      </div>
                      {/* Ride profile + value */}
                      <div className="flex flex-col items-end gap-0 shrink-0">
                        <span
                          className="uppercase tracking-[0.08em]"
                          style={{ ...mono, fontSize: "0.35rem", color: rideColor }}
                        >
                          {w.rideProfile}
                        </span>
                        <span style={{ ...mono, fontSize: "0.4rem", color: C.green }}>
                          {"\u20AC"}{w.estimatedValue}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── ZONES A RISQUE ── */}
          {briefing.riskZones && briefing.riskZones.length > 0 && (
            <>
              <SectionHeader text="ZONES A RISQUE" />
              <div className="flex flex-col gap-1">
                {briefing.riskZones.map((r, i) => (
                  <div
                    key={`risk-${i}`}
                    className="flex items-center justify-between px-4 py-2"
                    style={{
                      backgroundColor: C.surface,
                      borderLeft: `2px solid ${C.red}`,
                      borderRadius: 2,
                    }}
                  >
                    <div className="flex flex-col gap-0">
                      <span style={{ ...label, fontSize: "0.5rem", color: C.text }}>
                        {r.zone}
                      </span>
                      <span style={{ ...mono, fontSize: "0.35rem", color: C.textDim }}>
                        {r.reason}
                      </span>
                    </div>
                    <span
                      className="uppercase tracking-[0.08em]"
                      style={{ ...mono, fontSize: "0.35rem", color: C.red }}
                    >
                      {r.time}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── FENETRES PAR JOUR ── */}
          <SectionHeader text="FENETRES" />
          <div className="flex flex-col gap-1.5">
            {orderedDays.map(day => {
              const daySignals = byDay.get(day) ?? [];
              return daySignals.map((signal, i) => (
                <DayWindowCard
                  key={signal.id}
                  signal={signal}
                  index={i}
                />
              ));
            })}
          </div>

          {signals.length === 0 && (
            <div className="flex flex-col items-center py-16 gap-3">
              <span style={{ ...label, fontSize: "0.7rem", color: C.textDim }}>
                Pas de fenetres identifiees cette semaine
              </span>
            </div>
          )}

          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}