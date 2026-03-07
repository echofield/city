// FLOW — RADAR: City Sonar Instrument
// Pull intelligence. The driver becomes the explorer.
// Shazam-like: central sonar, concentric time rings, signal dots floating.
// The driver is at the center. The city breathes around them.
// Tap a dot → detail card. Not a list — an instrument.

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { C, mono, label } from "./theme";
import type { FlowSignal, VenueType } from "./FlowEngine";

// ── Helpers ──

function causeTag(venueType?: VenueType): string {
  switch (venueType) {
    case "theatre": return "fin";
    case "concert": return "sortie";
    case "club": return "fermeture";
    case "station": return "train";
    case "airport": return "vol";
    case "bar_area": return "rush";
    case "stadium": return "sortie";
    case "office": return "sortie";
    case "restaurant": return "sortie";
    case "metro": return "dernier";
    default: return "";
  }
}

function wazeUrl(lat?: number, lng?: number): string | null {
  if (!lat || !lng) return null;
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}

// ── Ring assignment by proximity ──

function proximityToRing(minutes: number): number {
  if (minutes <= 5) return 0;   // inner — NOW
  if (minutes <= 15) return 1;  // +15
  if (minutes <= 30) return 2;  // +30
  return 3;                     // +60
}

const RING_LABELS = ["MAINTENANT", "+15", "+30", "+60"];

// Paris center for angle computation
const PARIS_CENTER = { lat: 48.8566, lng: 2.3522 };

function angleFromCenter(lat?: number, lng?: number, driverLat?: number, driverLng?: number): number {
  const cLat = driverLat ?? PARIS_CENTER.lat;
  const cLng = driverLng ?? PARIS_CENTER.lng;
  if (!lat || !lng) return Math.random() * 360;
  const dLat = lat - cLat;
  const dLng = lng - cLng;
  return (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
}

// ── Confidence ──

function confScore(sig: FlowSignal): { score: number; color: string } {
  const s = Math.round(sig.confidence * 100);
  if (s >= 85) return { score: s, color: C.green };
  if (s >= 65) return { score: s, color: C.amber };
  return { score: s, color: C.textDim };
}

function crowdStr(n?: number): string | null {
  if (!n) return null;
  if (n >= 1000) return `~${Math.round(n / 1000)}k`;
  return `~${n}`;
}

// ── Sonar Visualization ──

interface SonarDot {
  sig: FlowSignal;
  ring: number;
  angle: number; // degrees
  x: number;     // % from center
  y: number;     // % from center
}

function buildSonarDots(signals: FlowSignal[]): SonarDot[] {
  // Limit to top 5 signals by confidence — keep the sonar clean
  const sorted = [...signals]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5)
    .sort((a, b) => a.proximity_minutes - b.proximity_minutes);
  
  // Distribute dots to avoid overlap within same ring
  const ringCounts = [0, 0, 0, 0];
  
  return sorted.map((sig) => {
    const ring = proximityToRing(sig.proximity_minutes);
    const ringIdx = ringCounts[ring]++;
    
    // Compute angle from GPS if available, else distribute evenly with offset
    let angle: number;
    if (sig.lat && sig.lng) {
      angle = angleFromCenter(sig.lat, sig.lng);
      // Add small offset per ring to avoid stacking
      angle += ringIdx * 15;
    } else {
      // Distribute evenly with golden angle
      angle = (ringIdx * 137.5 + ring * 45) % 360;
    }
    
    // Ring radius as % of sonar radius (0.25 inner to 0.95 outer)
    const ringRadius = ring === 0 ? 0.22 : ring === 1 ? 0.42 : ring === 2 ? 0.65 : 0.88;
    
    const rad = (angle * Math.PI) / 180;
    const x = 50 + ringRadius * 50 * Math.sin(rad);
    const y = 50 - ringRadius * 50 * Math.cos(rad);
    
    return { sig, ring, angle, x, y };
  });
}

// ── Main Component ──

interface RadarPageProps {
  signals: FlowSignal[];
  breathPhase: number;
}

export function RadarPage({ signals, breathPhase }: RadarPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [sweepAngle, setSweepAngle] = useState(0);

  const dots = useMemo(() => buildSonarDots(signals), [signals]);
  const hasSignals = signals.length > 0;
  const selectedDot = dots.find(d => d.sig.id === selectedId) ?? null;

  // Scanning entrance
  useEffect(() => {
    const id = setTimeout(() => setIsScanning(false), 1400);
    return () => clearTimeout(id);
  }, []);

  // Sweep rotation (slow, continuous)
  useEffect(() => {
    let raf: number;
    let start: number | null = null;
    const speed = 0.015; // degrees per ms (~5.4 deg/s → 67s full rotation)
    const tick = (ts: number) => {
      if (!start) start = ts;
      setSweepAngle((ts - start) * speed % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleDotClick = useCallback((id: string) => {
    setSelectedId(prev => prev === id ? null : id);
  }, []);

  // Ring opacities for breath — slightly stronger contrast per feedback
  const ringBreath = 0.12 + breathPhase * 0.06;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: C.bg }}>
      {/* ── Header ── */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="uppercase tracking-[0.3em]"
            style={{ ...label, fontSize: "0.6rem", fontWeight: 500, color: C.text }}
          >
            RADAR
          </span>
          <motion.div
            animate={{
              scale: [1, 1.4, 1],
              opacity: [0.3, 0.7, 0.3],
            }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              backgroundColor: hasSignals ? C.green : C.textDim,
            }}
          />
        </div>
        <span style={{ ...mono, fontSize: "0.4rem", color: C.textGhost }}>
          {signals.length} {signals.length === 1 ? "signal" : "signaux"}
        </span>
      </div>

      {/* ── Sonar Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Scanning entrance */}
        <AnimatePresence>
          {isScanning && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col items-center justify-center gap-4"
            >
              <motion.div
                animate={{
                  scale: [1, 3, 1],
                  opacity: [0.2, 0.5, 0.2],
                }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: `1px solid ${C.textMid}`,
                }}
              />
              <span
                className="uppercase tracking-[0.4em]"
                style={{ ...mono, fontSize: "0.35rem", color: C.textDim }}
              >
                SCAN EN COURS
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sonar visualization */}
        {!isScanning && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Radar circle */}
            <div className="flex-1 relative flex items-center justify-center px-4 py-2 min-h-0">
              <div
                className="relative w-full max-w-[340px] max-h-full"
                style={{ aspectRatio: "1/1" }}
              >
                <svg
                  viewBox="0 0 100 100"
                  className="w-full h-full"
                  style={{ overflow: "visible" }}
                >
                  {/* Concentric rings */}
                  {[0.88, 0.65, 0.42, 0.22].map((r, i) => (
                    <circle
                      key={i}
                      cx="50"
                      cy="50"
                      r={r * 50}
                      fill="none"
                      stroke={C.textGhost}
                      strokeWidth="0.3"
                      opacity={ringBreath}
                    />
                  ))}

                  {/* Cross hairs — very subtle */}
                  <line x1="50" y1="6" x2="50" y2="94" stroke={C.textGhost} strokeWidth="0.15" opacity={0.04} />
                  <line x1="6" y1="50" x2="94" y2="50" stroke={C.textGhost} strokeWidth="0.15" opacity={0.04} />

                  {/* Sweep line */}
                  <line
                    x1="50"
                    y1="50"
                    x2={50 + 45 * Math.sin(sweepAngle * Math.PI / 180)}
                    y2={50 - 45 * Math.cos(sweepAngle * Math.PI / 180)}
                    stroke={C.green}
                    strokeWidth="0.3"
                    opacity={0.12}
                  />
                  {/* Sweep glow trail (fading arc) */}
                  <defs>
                    <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={C.green} stopOpacity="0" />
                      <stop offset="100%" stopColor={C.green} stopOpacity="0.08" />
                    </linearGradient>
                    {/* Subtle glow for signal dots */}
                    <filter id="dotGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Ring labels */}
                  {RING_LABELS.map((lbl, i) => {
                    const r = i === 0 ? 0.22 : i === 1 ? 0.42 : i === 2 ? 0.65 : 0.88;
                    return (
                      <text
                        key={lbl}
                        x={50 + r * 50 + 1.5}
                        y={50 - 0.8}
                        fill={C.textGhost}
                        fontSize="2"
                        fontFamily="'JetBrains Mono', monospace"
                        opacity={0.5}
                      >
                        {lbl}
                      </text>
                    );
                  })}

                  {/* Center dot — the driver */}
                  <circle cx="50" cy="50" r="1.2" fill={C.textMid} opacity={0.6} />
                  <circle cx="50" cy="50" r="0.5" fill={C.text} />

                  {/* Signal dots */}
                  {dots.map((dot) => {
                    const isSelected = selectedId === dot.sig.id;
                    const cs = confScore(dot.sig);
                    const dotColor = isSelected ? cs.color : (cs.score >= 70 ? C.green : cs.score >= 50 ? C.amber : C.textDim);
                    const crowd = crowdStr(dot.sig.crowd_estimate);
                    const sName = dot.sig.venue_name ?? dot.sig.zone;
                    // Truncate name for sonar label
                    const shortName = sName.length > 16 ? sName.slice(0, 15) + "\u2026" : sName;
                    // Time hint: "NOW" or "+Xmin"
                    const timeHint = dot.sig.proximity_minutes <= 5
                      ? "NOW"
                      : `+${dot.sig.proximity_minutes}min`;
                    // Dot radius scales with signal strength (confidence)
                    const baseR = 1.0 + dot.sig.confidence * 0.8; // 1.0–1.8
                    const dotR = isSelected ? 2.2 : baseR;

                    return (
                      <g
                        key={dot.sig.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => handleDotClick(dot.sig.id)}
                      >
                        {/* Pulse ring for high-confidence signals */}
                        {cs.score >= 75 && (
                          <circle
                            cx={dot.x}
                            cy={dot.y}
                            r={isSelected ? 3.5 : 2.5 + breathPhase * 0.8}
                            fill="none"
                            stroke={dotColor}
                            strokeWidth="0.3"
                            opacity={isSelected ? 0.5 : 0.15 + breathPhase * 0.1}
                          />
                        )}

                        {/* Main dot */}
                        <circle
                          cx={dot.x}
                          cy={dot.y}
                          r={dotR}
                          fill={dotColor}
                          opacity={isSelected ? 1 : 0.7}
                          filter={isSelected ? "url(#dotGlow)" : undefined}
                        />

                        {/* Venue label */}
                        <text
                          x={dot.x}
                          y={dot.y - 2.8}
                          fill={isSelected ? C.textBright : C.textMid}
                          fontSize={isSelected ? "2.2" : "1.8"}
                          fontFamily="'Inter', sans-serif"
                          fontWeight={isSelected ? 600 : 400}
                          textAnchor="middle"
                          opacity={isSelected ? 1 : 0.7}
                        >
                          {shortName}
                        </text>

                        {/* Crowd count + time hint under dot */}
                        <text
                          x={dot.x}
                          y={dot.y + 3.2}
                          fill={C.textDim}
                          fontSize="1.5"
                          fontFamily="'JetBrains Mono', monospace"
                          textAnchor="middle"
                          opacity={0.6}
                        >
                          {crowd ? `${crowd} ${"\u00B7"} ${timeHint}` : timeHint}
                        </text>

                        {/* Score badge — only when selected */}
                        {isSelected && (
                          <text
                            x={dot.x + 3}
                            y={dot.y + 0.6}
                            fill={cs.color}
                            fontSize="2"
                            fontFamily="'JetBrains Mono', monospace"
                            fontWeight="bold"
                          >
                            {cs.score}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* ── Detail card — slides up when a dot is tapped ── */}
            <AnimatePresence>
              {selectedDot && (
                <motion.div
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 40, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="shrink-0 flex flex-col gap-2.5 px-5 py-4"
                  style={{
                    backgroundColor: C.surface,
                    borderTop: `1px solid ${C.border}`,
                  }}
                >
                  {(() => {
                    const sig = selectedDot.sig;
                    const sName = sig.venue_name ?? sig.zone;
                    const cause = causeTag(sig.venue_type);
                    const cs = confScore(sig);
                    const sNavUrl = wazeUrl(sig.lat, sig.lng);
                    const crowd = crowdStr(sig.crowd_estimate);

                    return (
                      <>
                        {/* Row 1: Name + score */}
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            style={{
                              fontFamily: "'Inter', sans-serif",
                              fontWeight: 600,
                              fontSize: "0.85rem",
                              color: C.textBright,
                              lineHeight: 1.1,
                            }}
                          >
                            {sName}
                          </span>
                          <span style={{ ...mono, fontSize: "0.7rem", color: cs.color }}>
                            {cs.score}
                          </span>
                        </div>

                        {/* Row 2: Cause + time + crowd */}
                        <div className="flex items-center gap-2.5">
                          {cause && (
                            <span style={{ ...label, fontSize: "0.5rem", color: C.textMid }}>
                              {cause}
                            </span>
                          )}
                          <span style={{ ...mono, fontSize: "0.45rem", color: C.textDim }}>
                            {sig.time_window.start} {"\u2013"} {sig.time_window.end}
                          </span>
                          {sig.peak_time && (
                            <span style={{ ...mono, fontSize: "0.4rem", color: C.amber }}>
                              PIC {sig.peak_time}
                            </span>
                          )}
                          {crowd && (
                            <span style={{ ...mono, fontSize: "0.4rem", color: C.textDim }}>
                              {crowd}
                            </span>
                          )}
                        </div>

                        {/* Row 3: EUR + Ride + Wave + Clientele */}
                        <div className="flex items-center gap-2.5">
                          {sig.estimated_value && (
                            <span style={{ ...mono, fontSize: "0.5rem", color: C.green }}>
                              {"\u20AC"}{sig.estimated_value}
                            </span>
                          )}
                          {sig.ride_profile && (
                            <span style={{ ...label, fontSize: "0.4rem", color: C.textDim }}>
                              {sig.ride_profile === "longues" ? "Courses longues" : sig.ride_profile === "courtes" ? "Courtes" : "Mixtes"}
                            </span>
                          )}
                          {sig.wave_phase && (
                            <span
                              className="uppercase tracking-[0.08em]"
                              style={{
                                ...mono,
                                fontSize: "0.28rem",
                                color: sig.wave_phase === "ACTIVE" ? C.green : C.textDim,
                                padding: "1px 4px",
                                border: `1px solid ${C.border}`,
                                borderRadius: 2,
                              }}
                            >
                              {sig.wave_phase === "FORMATION" ? "EN FORMATION" : sig.wave_phase === "ACTIVE" ? "ACTIF" : "DECAY"}
                            </span>
                          )}
                        </div>

                        {/* Clientele */}
                        {sig.clientele && sig.clientele.length > 0 && (
                          <div className="flex items-center gap-1">
                            {sig.clientele.map((c, i) => (
                              <span
                                key={i}
                                className="uppercase tracking-[0.06em]"
                                style={{
                                  ...mono,
                                  fontSize: "0.28rem",
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
                        )}

                        {/* NAVIGUER */}
                        {sNavUrl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(sNavUrl, "_blank");
                            }}
                            className="w-full py-2.5 mt-0.5 uppercase tracking-[0.3em]"
                            style={{
                              ...mono,
                              fontSize: "0.4rem",
                              color: C.textMid,
                              backgroundColor: "transparent",
                              border: `1px solid ${C.border}`,
                              borderRadius: 0,
                              cursor: "pointer",
                            }}
                          >
                            NAVIGUER {"\u2192"}
                          </button>
                        )}
                      </>
                    );
                  })()}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state */}
            {!hasSignals && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
                <span
                  className="uppercase"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                    fontSize: "clamp(1.5rem, 6vw, 2.2rem)",
                    color: C.textGhost,
                    lineHeight: 0.9,
                  }}
                >
                  CALME
                </span>
                <span style={{ ...label, fontSize: "0.5rem", color: C.textGhost }}>
                  Donnees en attente
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}