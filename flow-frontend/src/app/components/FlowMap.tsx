// FLOW — Paris Map: Spatial Field Instrument
// Green = active. Amber = forming. Gray = dormant.
// Colors encode meaning. Every glow is information.

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  TERRITORIES,
  SEINE_NORTH,
  SEINE_SOUTH,
} from "./parisData";
import type { ZoneState } from "./FlowEngine";

interface FlowMapProps {
  zoneHeat: Record<string, number>;
  zoneStates: Record<string, ZoneState>;
  zoneSaturation: Record<string, number>;
  favoredZoneIds: string[];
  breathPhase: number;
  windowState: "forming" | "active" | "closing" | "stable";
  compact?: boolean;
  selectedZoneIds?: string[];
  onZoneTap?: (id: string) => void;
}

// ── Color grammar ──
const C = {
  bg: "#0a0a0b",
  border: "#1a1a1e",
  borderActive: "#2a2a30",
  seine: "#0c1018",
  seineBank: "#161e28",
  // State colors
  green: "#00B14F",
  greenDim: "#006830",
  greenGlow: "#00D460",
  amber: "#C9A24A",
  amberDim: "#7a6230",
  amberGlow: "#E0B85A",
  gray: "#3a3a40",
  grayDim: "#222226",
  red: "#a04040",
  // Text
  textBright: "#d0cdc8",
  textDim: "#5a5a60",
};

function getZoneColor(
  heat: number,
  state: ZoneState
): { fill: string; opacity: number; glow: boolean } {
  switch (state) {
    case "peak":
      return { fill: C.greenGlow, opacity: 0.7 + heat * 0.25, glow: true };
    case "active":
      return { fill: C.green, opacity: 0.45 + heat * 0.4, glow: true };
    case "forming":
      return { fill: C.amber, opacity: 0.25 + heat * 0.5, glow: false };
    case "fading":
      return { fill: C.amberDim, opacity: 0.15 + heat * 0.3, glow: false };
    case "dormant":
    default:
      return { fill: C.grayDim, opacity: heat > 0.03 ? 0.08 + heat * 0.15 : 0, glow: false };
  }
}

function buildSeinePath(): string {
  const n = SEINE_NORTH;
  const s = SEINE_SOUTH;
  let d = `M${n[0][0]},${n[0][1]}`;
  for (let i = 1; i < n.length; i++) d += ` L${n[i][0]},${n[i][1]}`;
  for (let i = s.length - 1; i >= 0; i--) d += ` L${s[i][0]},${s[i][1]}`;
  return d + " Z";
}

function buildBridgeLines(): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  key: string;
}[] {
  const lines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
  const seen = new Set<string>();
  for (const t of TERRITORIES) {
    for (const nb of t.neighbors) {
      if (!nb.bridge) continue;
      const key = [t.id, nb.id].sort().join("-");
      if (seen.has(key)) continue;
      seen.add(key);
      const other = TERRITORIES.find((x) => x.id === nb.id);
      if (!other) continue;
      lines.push({
        x1: t.center[0],
        y1: t.center[1],
        x2: other.center[0],
        y2: other.center[1],
        key,
      });
    }
  }
  return lines;
}

export function FlowMap({
  zoneHeat,
  zoneStates,
  zoneSaturation,
  favoredZoneIds,
  breathPhase,
  windowState,
  compact = false,
  selectedZoneIds,
  onZoneTap,
}: FlowMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const seinePath = useMemo(buildSeinePath, []);
  const bridges = useMemo(buildBridgeLines, []);
  const favoredSet = useMemo(() => new Set(favoredZoneIds), [favoredZoneIds]);
  const selectedSet = useMemo(() => new Set(selectedZoneIds ?? []), [selectedZoneIds]);

  const hovered = hoveredId
    ? TERRITORIES.find((t) => t.id === hoveredId)
    : null;

  const seineOpacity = 0.45 + breathPhase * 0.15;
  const labelSize = compact ? "10px" : "13px";
  const smallLabelSize = compact ? "7px" : "9px";

  return (
    <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
      <svg
        viewBox="155 95 690 555"
        className="w-full h-full"
        style={{ maxWidth: "100%", maxHeight: "100%" }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="fglow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="fsoft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect x="155" y="95" width="690" height="555" fill={C.bg} />

        {/* Peripherique */}
        <ellipse
          cx="500"
          cy="380"
          rx="290"
          ry="265"
          fill="none"
          stroke="#181820"
          strokeWidth="0.5"
          opacity={0.35 + breathPhase * 0.08}
          strokeDasharray="3,6"
        />

        {/* Seine */}
        <path
          d={seinePath}
          fill={C.seine}
          opacity={seineOpacity}
          style={{ transition: "opacity 0.6s ease" }}
        />
        <polyline
          points={SEINE_NORTH.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke={C.seineBank}
          strokeWidth="0.7"
          opacity={0.4 + breathPhase * 0.1}
        />
        <polyline
          points={SEINE_SOUTH.map((p) => p.join(",")).join(" ")}
          fill="none"
          stroke={C.seineBank}
          strokeWidth="0.7"
          opacity={0.4 + breathPhase * 0.1}
        />

        {/* Bridges */}
        {bridges.map((br) => (
          <line
            key={br.key}
            x1={br.x1}
            y1={br.y1}
            x2={br.x2}
            y2={br.y2}
            stroke="#1a1a22"
            strokeWidth={0.4}
            opacity={0.15 + breathPhase * 0.05}
            strokeDasharray="2,3"
          />
        ))}

        {/* Territory fills */}
        {TERRITORIES.map((t) => {
          const heat = zoneHeat[t.id] ?? 0;
          const state = zoneStates[t.id] ?? "dormant";
          const sat = zoneSaturation[t.id] ?? 0;
          const { fill, opacity, glow } = getZoneColor(heat, state);
          const isFavored = favoredSet.has(t.id);
          const isSelected = selectedSet.has(t.id);
          const isHovered = hoveredId === t.id;
          const breathPulse = isFavored ? breathPhase * 0.06 : breathPhase * 0.015;

          // Saturation indicator — if saturated, dim the zone slightly
          const satDim = sat > 70 ? 0.08 : 0;

          // Label color based on state
          const labelColor =
            isSelected
              ? C.green
              : state === "active" || state === "peak"
                ? "#5a8a60"
                : state === "forming"
                  ? "#8a7a50"
                  : isHovered
                    ? "#4a4a50"
                    : "#222228";

          return (
            <g key={t.id}>
              {opacity > 0 && (
                <path
                  d={t.path}
                  fill={fill}
                  opacity={Math.min(0.95, Math.max(0, opacity + breathPulse - satDim))}
                  style={{ transition: "fill 0.8s ease, opacity 0.5s ease" }}
                  filter={glow ? "url(#fglow)" : heat > 0.2 ? "url(#fsoft)" : undefined}
                />
              )}

              {/* Border */}
              <path
                d={t.path}
                fill="transparent"
                stroke={isSelected ? C.green : isHovered ? C.borderActive : C.border}
                strokeWidth={isSelected ? 1.2 : isHovered ? 0.8 : 0.35}
                style={{
                  cursor: onZoneTap ? "pointer" : "default",
                  transition: "stroke 0.3s ease, stroke-width 0.3s ease",
                }}
                onMouseEnter={() => setHoveredId(t.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onZoneTap?.(t.id)}
              />

              {/* Territory label */}
              <text
                x={t.center[0]}
                y={t.center[1]}
                textAnchor="middle"
                dominantBaseline="central"
                fill={labelColor}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: t.id === "cite" || t.id === "stlouis" ? smallLabelSize : labelSize,
                  fontWeight: 400,
                  pointerEvents: "none",
                  transition: "fill 0.5s ease",
                  letterSpacing: "0.05em",
                }}
              >
                {t.displayName}
              </text>

              {/* Saturation dot — high saturation zones get a red dot */}
              {sat > 65 && (
                <circle
                  cx={t.center[0] + 14}
                  cy={t.center[1] - 10}
                  r={2.5}
                  fill={C.red}
                  opacity={0.6 + breathPhase * 0.2}
                />
              )}
            </g>
          );
        })}

        {/* Center meridian */}
        <line
          x1="500"
          y1="115"
          x2="500"
          y2="630"
          stroke="#151518"
          strokeWidth="0.3"
          opacity={0.12}
          strokeDasharray="3,7"
        />
      </svg>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.25 }}
          >
            <div
              className="flex items-center gap-4 px-5 py-2.5"
              style={{
                backgroundColor: "rgba(10, 10, 11, 0.95)",
                border: "1px solid #222228",
                borderRadius: "3px",
              }}
            >
              <div className="flex flex-col gap-0.5">
                <span
                  className="uppercase tracking-[0.25em]"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "0.7rem",
                    fontWeight: 400,
                    color: C.textBright,
                  }}
                >
                  {hovered.name}
                </span>
                <span
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: "0.6rem",
                    fontWeight: 300,
                    color: C.textDim,
                  }}
                >
                  {hovered.subtitle}
                </span>
              </div>
              {(zoneHeat[hovered.id] ?? 0) > 0.1 && (
                <div className="flex flex-col items-end gap-0.5">
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.6rem",
                      fontWeight: 400,
                      color:
                        (zoneStates[hovered.id] ?? "dormant") === "active" ||
                        (zoneStates[hovered.id] ?? "dormant") === "peak"
                          ? C.green
                          : C.amber,
                    }}
                  >
                    {Math.round((zoneHeat[hovered.id] ?? 0) * 100)}%
                  </span>
                  {(zoneSaturation[hovered.id] ?? 0) > 40 && (
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "0.5rem",
                        fontWeight: 300,
                        color: (zoneSaturation[hovered.id] ?? 0) > 65 ? C.red : C.textDim,
                      }}
                    >
                      sat {zoneSaturation[hovered.id]}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}