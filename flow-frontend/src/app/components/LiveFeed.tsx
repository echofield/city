import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { getNextSkeletonMinutes, computeFieldState } from "./FlowEngine";
import { motion, AnimatePresence } from "motion/react";
import { C, mono, label } from "./theme";
import type { FlowSignal, FlowState, VenueType } from "./FlowEngine";
import type { TrainWave } from "./SncfService";

// ── Helpers ──

function causeLabel(venueType?: VenueType): string {
  switch (venueType) {
    case "theatre": return "Sortie theatre";
    case "concert": return "Sortie concert";
    case "club": return "Fermeture club";
    case "station": return "Arrivees trains";
    case "airport": return "Departs / arrivees";
    case "bar_area": return "Bars pleins";
    case "stadium": return "Sortie match";
    case "office": return "Sortie bureaux";
    case "restaurant": return "Fermeture restos";
    case "metro": return "Derniers metros";
    default: return "";
  }
}

function rideBadge(profile?: FlowSignal["ride_profile"]): string {
  switch (profile) {
    case "longues": return "L";
    case "courtes": return "C";
    case "mixte": return "M";
    default: return "";
  }
}

function wazeUrl(lat?: number, lng?: number): string | null {
  if (!lat || !lng) return null;
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

// ── Direction arrow from driver position to signal ──

function directionArrow(driverLat?: number, driverLng?: number, sigLat?: number, sigLng?: number): string {
  if (!driverLat || !driverLng || !sigLat || !sigLng) return "\u2192"; // default →
  const dLat = sigLat - driverLat;
  const dLng = sigLng - driverLng;
  const angle = Math.atan2(dLat, dLng) * (180 / Math.PI);
  // 8 directions
  if (angle >= -22.5 && angle < 22.5) return "\u2192";   // → east
  if (angle >= 22.5 && angle < 67.5) return "\u2197";    // ↗ northeast
  if (angle >= 67.5 && angle < 112.5) return "\u2191";   // ↑ north
  if (angle >= 112.5 && angle < 157.5) return "\u2196";  // ↖ northwest
  if (angle >= 157.5 || angle < -157.5) return "\u2190"; // ← west
  if (angle >= -157.5 && angle < -112.5) return "\u2199"; // ↙ southwest
  if (angle >= -112.5 && angle < -67.5) return "\u2193";  // ↓ south
  return "\u2198"; // ↘ southeast
}

// ── Window countdown as "Fenetre ferme dans X min" ──

function useWindowCountdownMin(signal: FlowSignal | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  if (!signal) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const [h, m] = signal.time_window.end.split(":").map(Number);
  const d = new Date(`${today}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
  if (d.getTime() < now - 12 * 3600000) d.setDate(d.getDate() + 1);
  return Math.max(0, Math.round((d.getTime() - now) / 60000));
}

// ── Confidence field label ──

function fieldConfidenceLabel(signal: FlowSignal): { text: string; color: string } {
  if (signal.confidence >= 0.85) return { text: "Bonne fenetre", color: C.green };
  if (signal.confidence >= 0.72) return { text: "Moment interessant", color: C.green };
  if (signal.confidence >= 0.60) return { text: "Ca se forme", color: C.amber };
  return { text: "Calme", color: C.textDim };
}

// ── Trace Entry (captured opportunity) ──

interface TraceEntry {
  id: string;
  time: string;
  action: string;
  zone: string;
  cause: string;
}

// ── Main Component ──

interface LiveFeedProps {
  signals: FlowSignal[];
  flow: FlowState;
  trainWaves?: TrainWave[];
  onOpenRadar?: () => void;
}

export function LiveFeed({ signals, flow, trainWaves, onOpenRadar }: LiveFeedProps) {
  const hasSignals = signals.length > 0;
  const fieldState = computeFieldState(signals);
  const fieldColor = fieldState.active ? C.green : C.textDim;

  const principal = useMemo(() => signals.length > 0 ? signals[0] : null, [signals]);
  const secondaries = useMemo(() => signals.slice(1, 3), [signals]);
  const windowMin = useWindowCountdownMin(principal);
  const [expandedSecondaryId, setExpandedSecondaryId] = useState<string | null>(null);

  // Track past signals for TRACE
  const traceRef = useRef<TraceEntry[]>([]);
  const prevPrincipalRef = useRef<string | null>(null);

  useEffect(() => {
    if (principal && principal.id !== prevPrincipalRef.current) {
      // When a new principal appears, record the previous one as captured
      if (prevPrincipalRef.current && traceRef.current.length < 10) {
        // Already recorded
      }
      prevPrincipalRef.current = principal.id;

      // Add current to trace after a delay (when the window passes)
      const entry: TraceEntry = {
        id: principal.id,
        time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        action: principal.action,
        zone: principal.venue_name ?? principal.zone,
        cause: causeLabel(principal.venue_type) + " " + principal.zone,
      };

      // Only add if not already in trace
      if (!traceRef.current.find(t => t.id === entry.id)) {
        traceRef.current = [entry, ...traceRef.current].slice(0, 8);
      }
    }
  }, [principal]);

  // Signal metadata
  const cause = principal ? causeLabel(principal.venue_type) : "";
  const venueName = principal ? (principal.venue_name ?? principal.zone) : "";
  const actionColor = principal
    ? (principal.type === "signal_fort" ? C.green
      : principal.type === "bientot" ? C.amber
      : principal.type === "alerte" ? C.red
      : C.green)
    : C.textGhost;
  const confField = principal ? fieldConfidenceLabel(principal) : { text: "Calme", color: C.textDim };
  const confScore = principal ? Math.round(principal.confidence * 100) : 0;
  const confScoreColor = confScore >= 90 ? C.green : confScore >= 70 ? C.green : confScore >= 50 ? C.amber : C.textDim;
  const rBadge = principal ? rideBadge(principal.ride_profile) : "";
  const distKm = principal ? (principal.proximity_minutes * 0.36).toFixed(1) : "0";
  const navUrl = principal ? wazeUrl(principal.lat, principal.lng) : null;

  // Session EUR
  const sessionEur = Math.round(flow.sessionEarnings);

  // Last update timestamp
  const updateTime = flow.meta.compiledAt
    ? new Date(flow.meta.compiledAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : "--:--";

  const handleNav = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (navUrl) window.open(navUrl, "_blank");
  }, [navUrl]);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: C.bg }}>
      {/* ── Top Bar: Phase Pulse + EUR ── */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={fieldState.active ? {
              opacity: [0.4, 1, 0.4],
            } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              backgroundColor: fieldColor,
            }}
          />
          <span
            className="uppercase tracking-[0.15em]"
            style={{ ...mono, fontSize: "0.45rem", color: fieldColor }}
          >
            {fieldState.label}
          </span>
        </div>
        <span style={{ ...mono, fontSize: "0.5rem", color: C.green }}>
          {sessionEur} EUR
        </span>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-y-auto">
        {hasSignals && principal ? (
          <div className="flex flex-col min-h-full">
            {/* ── Command Area — huge breathing space ── */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
              {/* Window countdown */}
              <span
                className="tracking-[0.08em]"
                style={{
                  ...label,
                  fontSize: "0.55rem",
                  color: windowMin <= 5 ? C.red : C.amber,
                  lineHeight: 1,
                }}
              >
                Fenetre ferme dans {windowMin} min
              </span>

              {/* ACTION — dominant */}
              <div className="mt-5">
                <span
                  className="uppercase"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: "clamp(1.4rem, 6vw, 2rem)",
                    color: actionColor,
                    lineHeight: 0.95,
                    letterSpacing: "-0.02em",
                    display: "block",
                    textAlign: "center",
                  }}
                >
                  {principal.action}
                </span>
              </div>

              {/* ZONE — slightly smaller than action */}
              <div className="mt-1.5">
                <span
                  className="uppercase"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: "clamp(0.75rem, 3vw, 1.05rem)",
                    color: C.textBright,
                    lineHeight: 1.1,
                    letterSpacing: "0.02em",
                    display: "block",
                    textAlign: "center",
                  }}
                >
                  {venueName}
                </span>
              </div>

              {/* Direction indicator: ↗ 7 min · 1.2 km */}
              <div className="flex items-center gap-1.5 mt-3">
                <span style={{ ...mono, fontSize: "0.55rem", color: C.textMid }}>
                  {directionArrow(undefined, undefined, principal.lat, principal.lng)}
                </span>
                <span style={{ ...mono, fontSize: "0.5rem", color: C.textMid }}>
                  {principal.proximity_minutes} min
                </span>
                <span style={{ ...mono, fontSize: "0.4rem", color: C.textDim }}>
                  {"\u00B7"}
                </span>
                <span style={{ ...mono, fontSize: "0.5rem", color: C.textMid }}>
                  {distKm} km
                </span>
              </div>

              {/* Cause + Ride badges */}
              <div className="flex items-center gap-2 mt-3">
                {cause && (
                  <span style={{ ...label, fontSize: "0.55rem", color: C.textMid }}>
                    {cause} {venueName !== principal.zone ? principal.zone : ""}
                  </span>
                )}
                {rBadge && (
                  <span
                    className="uppercase"
                    style={{
                      ...mono,
                      fontSize: "0.35rem",
                      color: C.textDim,
                      padding: "1px 5px",
                      border: `1px solid ${C.border}`,
                      borderRadius: 2,
                    }}
                  >
                    {rBadge}
                  </span>
                )}
                {principal.ride_profile === "mixte" && (
                  <span
                    className="uppercase"
                    style={{
                      ...mono,
                      fontSize: "0.35rem",
                      color: C.textDim,
                      padding: "1px 5px",
                      border: `1px solid ${C.border}`,
                      borderRadius: 2,
                    }}
                  >
                    M
                  </span>
                )}
              </div>

              {/* Estimated value + peak time */}
              <div className="flex items-center gap-2 mt-2">
                {principal.estimated_value && (
                  <span style={{ ...mono, fontSize: "0.5rem", color: C.green }}>
                    {"\u20AC"}{principal.estimated_value}
                  </span>
                )}
                <span style={{ ...mono, fontSize: "0.5rem", color: C.textMid }}>
                  {principal.time_window.start} {"\u2013"} {principal.time_window.end}
                </span>
                {principal.peak_time && (
                  <span style={{ ...mono, fontSize: "0.45rem", color: C.amber }}>
                    PIC {principal.peak_time}
                  </span>
                )}
              </div>

              {/* Strategy / entry point */}
              {(principal.entry_point || principal.strategy) && (
                <div className="mt-1">
                  <span style={{ ...label, fontSize: "0.45rem", color: C.textDim }}>
                    {principal.strategy ?? principal.entry_point}
                  </span>
                </div>
              )}

              {/* Confidence score + sources + CONFIRMER */}
              <div className="flex flex-col items-center gap-2 mt-6">
                {/* Score line: 88 · Bonne fenetre */}
                <div className="flex items-center gap-2">
                  <span style={{ ...mono, fontSize: "0.7rem", color: confScoreColor }}>
                    {confScore}
                  </span>
                  <span style={{ ...mono, fontSize: "0.35rem", color: C.textGhost }}>
                    {"\u00B7"}
                  </span>
                  <span style={{ ...label, fontSize: "0.45rem", color: confField.color }}>
                    {confField.text}
                  </span>
                </div>
                {/* Sources */}
                {principal.confidence_sources && principal.confidence_sources.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {principal.confidence_sources.map((src, i) => (
                      <span
                        key={i}
                        style={{ ...mono, fontSize: "0.3rem", color: C.textGhost }}
                      >
                        {src}{i < principal.confidence_sources!.length - 1 ? " \u00B7" : ""}
                      </span>
                    ))}
                  </div>
                )}
                {/* CONFIRMER */}
                {navUrl && (
                  <div className="flex items-center gap-3 mt-4 w-full" style={{ maxWidth: 280 }}>
                    <button
                      onClick={handleNav}
                      className="flex-1 py-2.5 uppercase tracking-[0.35em]"
                      style={{
                        ...mono,
                        fontSize: "0.45rem",
                        color: actionColor,
                        backgroundColor: "transparent",
                        border: `1px solid ${actionColor}`,
                        borderRadius: 0,
                        cursor: "pointer",
                        letterSpacing: "0.35em",
                      }}
                    >
                      NAVIGUER {"\u2192"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Separator + Last update ── */}
            <div
              className="mx-4"
              style={{ height: 1, backgroundColor: C.border }}
            />
            <div className="flex items-center justify-center py-2">
              <span style={{ ...mono, fontSize: "0.35rem", color: C.textGhost }}>
                Mise a jour {updateTime}
              </span>
            </div>

            {/* ── AUTRES FENETRES — 2 secondary signals, clickable ── */}
            {secondaries.length > 0 && (
              <div className="px-4 pb-3">
                <span
                  className="uppercase tracking-[0.25em]"
                  style={{ ...mono, fontSize: "0.3rem", color: C.textGhost }}
                >
                  AUTRES FENETRES
                </span>
                <div className="flex flex-col gap-1.5 mt-2">
                  {secondaries.map((sig) => {
                    const sCause = causeLabel(sig.venue_type);
                    const sName = sig.venue_name ?? sig.zone;
                    const sColor = sig.type === "signal_fort" ? C.green
                      : sig.type === "bientot" ? C.amber
                      : sig.type === "alerte" ? C.red
                      : C.green;
                    const sConf = fieldConfidenceLabel(sig);
                    const sScore = Math.round(sig.confidence * 100);
                    const sScoreColor = sScore >= 90 ? C.green : sScore >= 70 ? C.green : sScore >= 50 ? C.amber : C.textDim;
                    const isExpanded = expandedSecondaryId === sig.id;
                    const sNavUrl = wazeUrl(sig.lat, sig.lng);
                    const crowdLabel = sig.crowd_estimate
                      ? sig.crowd_estimate >= 1000
                        ? `~${Math.round(sig.crowd_estimate / 1000)} 000`
                        : `~${sig.crowd_estimate}`
                      : null;

                    return (
                      <div
                        key={sig.id}
                        className="flex flex-col px-3 py-2.5"
                        style={{
                          backgroundColor: C.surface,
                          borderLeft: `2px solid ${sColor}${isExpanded ? "" : "30"}`,
                          borderRadius: 2,
                          cursor: "pointer",
                        }}
                        onClick={() => setExpandedSecondaryId(isExpanded ? null : sig.id)}
                      >
                        {/* Collapsed: Venue + Score + Action */}
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-baseline gap-1.5 min-w-0">
                            <span
                              style={{
                                fontFamily: "'Inter', sans-serif",
                                fontWeight: 600,
                                fontSize: "0.6rem",
                                color: C.textBright,
                                lineHeight: 1.2,
                              }}
                            >
                              {sName}
                            </span>
                            <span style={{ ...mono, fontSize: "0.45rem", color: sScoreColor }}>
                              {sScore}
                            </span>
                          </div>
                          <span
                            className="uppercase"
                            style={{
                              fontFamily: "'Inter', sans-serif",
                              fontWeight: 600,
                              fontSize: "0.5rem",
                              color: sColor,
                              lineHeight: 1.2,
                              flexShrink: 0,
                            }}
                          >
                            {sig.action}
                          </span>
                        </div>
                        {/* Collapsed: Cause + EUR + Phase */}
                        <div className="flex items-center gap-2 mt-0.5">
                          {sCause && (
                            <span style={{ ...label, fontSize: "0.4rem", color: C.textDim }}>
                              {sCause}
                            </span>
                          )}
                          {sig.estimated_value && (
                            <span style={{ ...mono, fontSize: "0.4rem", color: C.green }}>
                              {"\u20AC"}{sig.estimated_value}
                            </span>
                          )}
                          {sig.peak_time && (
                            <span style={{ ...mono, fontSize: "0.35rem", color: C.amber }}>
                              PIC {sig.peak_time}
                            </span>
                          )}
                          <span style={{ ...label, fontSize: "0.35rem", color: sConf.color, marginLeft: "auto" }}>
                            {sConf.text.toUpperCase()}
                          </span>
                        </div>

                        {/* Expanded detail */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              style={{ overflow: "hidden" }}
                            >
                              <div
                                className="flex flex-col gap-1.5 pt-2.5 mt-2"
                                style={{ borderTop: `1px solid ${C.border}` }}
                              >
                                {/* Crowd + Clientele */}
                                <div className="flex items-center gap-3">
                                  {crowdLabel && (
                                    <div className="flex flex-col gap-0">
                                      <span className="uppercase tracking-[0.15em]" style={{ ...mono, fontSize: "0.28rem", color: C.textGhost }}>
                                        AFFLUENCE
                                      </span>
                                      <span style={{ ...mono, fontSize: "0.5rem", color: C.textMid }}>
                                        {crowdLabel} personnes
                                      </span>
                                    </div>
                                  )}
                                  {sig.clientele && sig.clientele.length > 0 && (
                                    <div className="flex flex-col gap-0">
                                      <span className="uppercase tracking-[0.15em]" style={{ ...mono, fontSize: "0.28rem", color: C.textGhost }}>
                                        CLIENTELE
                                      </span>
                                      <div className="flex items-center gap-1">
                                        {sig.clientele.map((c, i) => (
                                          <span
                                            key={i}
                                            className="uppercase tracking-[0.06em]"
                                            style={{
                                              ...mono,
                                              fontSize: "0.3rem",
                                              color: C.textDim,
                                              padding: "1px 4px",
                                              border: `1px solid ${C.border}`,
                                              borderRadius: 2,
                                            }}
                                          >
                                            {c}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Time window */}
                                <div className="flex items-center gap-2">
                                  <span style={{ ...mono, fontSize: "0.45rem", color: C.textMid }}>
                                    {sig.time_window.start} {"\u2013"} {sig.time_window.end}
                                  </span>
                                  {sig.ride_profile && (
                                    <span style={{ ...label, fontSize: "0.4rem", color: C.textDim }}>
                                      {sig.ride_profile === "longues" ? "Courses longues" : sig.ride_profile === "courtes" ? "Courses courtes" : "Courses mixtes"}
                                    </span>
                                  )}
                                </div>

                                {/* NAVIGUER */}
                                {sNavUrl && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(sNavUrl, "_blank");
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-1.5 mt-0.5"
                                    style={{
                                      backgroundColor: "transparent",
                                      border: `1px solid ${sColor}30`,
                                      borderRadius: 2,
                                      cursor: "pointer",
                                    }}
                                  >
                                    <span
                                      className="uppercase tracking-[0.25em]"
                                      style={{ ...mono, fontSize: "0.4rem", color: sColor }}
                                    >
                                      NAVIGUER
                                    </span>
                                    <span style={{ color: sColor, fontSize: "0.5rem" }}>{"\u2192"}</span>
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── TRACE — captured opportunities ── */}
            {traceRef.current.length > 0 && (
              <div className="px-4 pb-4">
                <span
                  className="uppercase tracking-[0.25em]"
                  style={{ ...mono, fontSize: "0.3rem", color: C.textGhost }}
                >
                  TRACE
                </span>
                <div className="flex flex-col gap-1 mt-2">
                  {traceRef.current.map((t) => (
                    <div key={t.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <motion.div
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: "50%",
                            backgroundColor: C.textDim,
                          }}
                        />
                        <span style={{ ...mono, fontSize: "0.4rem", color: C.textDim }}>
                          {t.time}
                        </span>
                        <span
                          className="uppercase"
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontWeight: 600,
                            fontSize: "0.45rem",
                            color: C.green,
                          }}
                        >
                          {t.action}
                        </span>
                        <span style={{ ...label, fontSize: "0.45rem", color: C.textBright }}>
                          {t.zone}
                        </span>
                      </div>
                      <span style={{ ...label, fontSize: "0.35rem", color: C.textDim }}>
                        {t.cause}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Spacer ── */}
            <div className="flex-1 min-h-8" />

            {/* ── OUVRIR RADAR ── */}
            <div className="px-4 pb-6">
              <button
                onClick={() => onOpenRadar?.()}
                className="w-full py-2.5 uppercase tracking-[0.35em]"
                style={{
                  ...mono,
                  fontSize: "0.4rem",
                  color: C.textDim,
                  backgroundColor: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: 0,
                  cursor: "pointer",
                  letterSpacing: "0.35em",
                }}
              >
                OUVRIR RADAR
              </button>
            </div>
          </div>
        ) : (
          /* ── CALME state ── */
          <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
            <span
              className="uppercase"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                fontSize: "clamp(2rem, 8vw, 3rem)",
                color: C.textGhost,
                lineHeight: 0.9,
                letterSpacing: "-0.02em",
              }}
            >
              CALME
            </span>
            <span style={{ ...mono, fontSize: "0.55rem", color: C.textDim }}>
              Prochain signal T-{getNextSkeletonMinutes()}
            </span>

            {/* TRACE even in calme */}
            {traceRef.current.length > 0 && (
              <div className="w-full mt-8">
                <span
                  className="uppercase tracking-[0.25em]"
                  style={{ ...mono, fontSize: "0.3rem", color: C.textGhost }}
                >
                  TRACE
                </span>
                <div className="flex flex-col gap-1 mt-2">
                  {traceRef.current.map((t) => (
                    <div key={t.id} className="flex items-center gap-2">
                      <motion.div
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: "50%",
                          backgroundColor: C.textDim,
                        }}
                      />
                      <span style={{ ...mono, fontSize: "0.4rem", color: C.textDim }}>
                        {t.time}
                      </span>
                      <span
                        className="uppercase"
                        style={{
                          fontFamily: "'Inter', sans-serif",
                          fontWeight: 600,
                          fontSize: "0.45rem",
                          color: C.green,
                        }}
                      >
                        {t.action}
                      </span>
                      <span style={{ ...label, fontSize: "0.45rem", color: C.textBright }}>
                        {t.zone}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}