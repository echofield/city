/**
 * FLOW — Around You Panel
 *
 * Local tactical radar showing nearby opportunities.
 * Appears on refresh and in CARTE.
 * Distinct from LIVE: compact, proximity-focused, scan aesthetic.
 */

import { motion, AnimatePresence } from "motion/react";
import type { AroundYouResult, AroundYouSignal } from "../lib/around-you";
import { C, mono, label } from "./theme";

// ── Type Icons ──

function getTypeIcon(type: string): string {
  switch (type) {
    case "event_exit": return "▸";
    case "nightlife": return "◆";
    case "transport_wave": return "⇢";
    case "weather": return "◦";
    case "compound": return "●";
    case "hotel_outflow": return "◇";
    case "restaurant": return "◈";
    default: return "·";
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case "event_exit": return "Sortie";
    case "nightlife": return "Nuit";
    case "transport_wave": return "Flux";
    case "weather": return "Meteo";
    case "compound": return "Multi";
    case "hotel_outflow": return "Hotel";
    case "restaurant": return "Resto";
    default: return "";
  }
}

// ── Signal Row ──

function AroundYouRow({ signal, index }: { signal: AroundYouSignal; index: number }) {
  const isClose = signal.travel_minutes <= 5;
  const travelColor = isClose ? C.green : C.textMid;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="flex items-center gap-3 py-2.5"
      style={{
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      {/* Type indicator */}
      <div className="flex flex-col items-center w-8 shrink-0">
        <span
          style={{
            fontSize: "0.9rem",
            color: signal.is_active ? C.green : C.textMid,
          }}
        >
          {getTypeIcon(signal.type)}
        </span>
        <span
          className="uppercase"
          style={{
            ...label,
            fontSize: "0.45rem",
            color: C.textGhost,
            letterSpacing: "0.05em",
          }}
        >
          {getTypeLabel(signal.type)}
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className="truncate"
            style={{
              ...label,
              fontSize: "0.8rem",
              fontWeight: 500,
              color: C.text,
            }}
          >
            {signal.zone}
          </span>
          {signal.is_active && (
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                backgroundColor: C.green,
                boxShadow: `0 0 4px ${C.green}60`,
                flexShrink: 0,
              }}
            />
          )}
        </div>
        <span
          className="block truncate"
          style={{
            ...label,
            fontSize: "0.65rem",
            color: C.textDim,
          }}
        >
          {signal.local_label}
        </span>
      </div>

      {/* Travel time */}
      <div className="flex flex-col items-end shrink-0">
        <span
          style={{
            ...mono,
            fontSize: "0.85rem",
            fontWeight: 500,
            color: travelColor,
          }}
        >
          {signal.travel_minutes}′
        </span>
        <span
          style={{
            ...label,
            fontSize: "0.5rem",
            color: C.textGhost,
          }}
        >
          {signal.distance_meters < 1000
            ? `${signal.distance_meters}m`
            : `${(signal.distance_meters / 1000).toFixed(1)}km`}
        </span>
      </div>
    </motion.div>
  );
}

// ── Scanning Animation ──

function ScanningOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ backgroundColor: `${C.bg}F0` }}
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        style={{
          width: 24,
          height: 24,
          border: `2px solid ${C.border}`,
          borderTopColor: C.green,
          borderRadius: "50%",
        }}
      />
      <span
        className="mt-3 uppercase tracking-[0.15em]"
        style={{
          ...label,
          fontSize: "0.6rem",
          color: C.textDim,
        }}
      >
        Scan en cours...
      </span>
    </motion.div>
  );
}

// ── Empty State ──

function EmptyState({ arrondissement }: { arrondissement: string | null }) {
  return (
    <div className="py-6 text-center">
      <span
        style={{
          ...label,
          fontSize: "0.75rem",
          color: C.textGhost,
        }}
      >
        {arrondissement
          ? `Aucun signal proche dans le ${arrondissement}e`
          : "Aucun signal a proximite"}
      </span>
    </div>
  );
}

// ── Main Panel ──

interface AroundYouPanelProps {
  result: AroundYouResult | null;
  isScanning: boolean;
  variant?: "overlay" | "inline";
  onClose?: () => void;
}

export function AroundYouPanel({
  result,
  isScanning,
  variant = "inline",
  onClose,
}: AroundYouPanelProps) {
  const hasSignals = result && result.signals.length > 0;

  // Header text
  const headerText = result?.driver_arrondissement
    ? `AUTOUR DE VOUS — ${result.driver_arrondissement}e`
    : "AUTOUR DE VOUS";

  const content = (
    <div
      className="relative"
      style={{
        backgroundColor: variant === "overlay" ? C.surface : "transparent",
        borderRadius: variant === "overlay" ? 4 : 0,
        border: variant === "overlay" ? `1px solid ${C.border}` : "none",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{
          borderBottom: `1px solid ${C.border}`,
          backgroundColor: variant === "overlay" ? C.bg : "transparent",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: "0.7rem",
              color: C.green,
            }}
          >
            ◎
          </span>
          <span
            className="uppercase tracking-[0.12em]"
            style={{
              ...label,
              fontSize: "0.6rem",
              fontWeight: 500,
              color: C.textMid,
            }}
          >
            {headerText}
          </span>
        </div>
        {onClose && variant === "overlay" && (
          <button
            onClick={onClose}
            style={{
              ...label,
              fontSize: "0.7rem",
              color: C.textDim,
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-1">
        <AnimatePresence mode="wait">
          {isScanning ? (
            <ScanningOverlay key="scanning" />
          ) : hasSignals ? (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {result.signals.map((signal, i) => (
                <AroundYouRow key={signal.id} signal={signal} index={i} />
              ))}
            </motion.div>
          ) : (
            <EmptyState
              key="empty"
              arrondissement={result?.driver_arrondissement ?? null}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Footer hint */}
      {hasSignals && !isScanning && (
        <div
          className="px-4 py-2"
          style={{ borderTop: `1px solid ${C.border}` }}
        >
          <span
            style={{
              ...label,
              fontSize: "0.5rem",
              color: C.textGhost,
            }}
          >
            {result.signals.length} opportunite{result.signals.length > 1 ? "s" : ""} dans un rayon de {result.scan_radius_km} km
          </span>
        </div>
      )}
    </div>
  );

  // Overlay variant wraps in motion container
  if (variant === "overlay") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className="absolute left-4 right-4 top-16 z-50"
        style={{
          boxShadow: `0 4px 20px ${C.bg}80`,
        }}
      >
        {content}
      </motion.div>
    );
  }

  return content;
}

// ── Compact version for CARTE ──

interface AroundYouCompactProps {
  result: AroundYouResult | null;
  isScanning: boolean;
}

export function AroundYouCompact({ result, isScanning }: AroundYouCompactProps) {
  if (isScanning) {
    return (
      <div className="px-4 py-3 flex items-center gap-2">
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          style={{ fontSize: "0.7rem", color: C.textDim }}
        >
          ◎
        </motion.span>
        <span
          className="uppercase tracking-[0.1em]"
          style={{
            ...label,
            fontSize: "0.55rem",
            color: C.textDim,
          }}
        >
          Scan...
        </span>
      </div>
    );
  }

  if (!result || result.signals.length === 0) {
    return null;
  }

  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ fontSize: "0.6rem", color: C.green }}>◎</span>
        <span
          className="uppercase tracking-[0.1em]"
          style={{
            ...label,
            fontSize: "0.5rem",
            color: C.textDim,
          }}
        >
          Proche de vous
        </span>
      </div>
      {result.signals.slice(0, 3).map((signal) => (
        <div
          key={signal.id}
          className="flex items-center justify-between py-1.5"
        >
          <span
            className="truncate"
            style={{
              ...label,
              fontSize: "0.7rem",
              color: C.text,
              maxWidth: "60%",
            }}
          >
            {signal.zone}
          </span>
          <span
            style={{
              ...mono,
              fontSize: "0.7rem",
              color: signal.travel_minutes <= 5 ? C.green : C.textMid,
            }}
          >
            {signal.travel_minutes}′
          </span>
        </div>
      ))}
    </div>
  );
}
