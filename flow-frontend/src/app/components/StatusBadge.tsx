// FLOW — StatusBadge: Reusable inline badge component
// Replaces all inline badge patterns across the app.
// Color is the only language. Zero emoji.

import { C, mono } from "./theme";

type BadgeVariant = "green" | "amber" | "red" | "dim" | "ghost";

interface StatusBadgeProps {
  text: string;
  variant?: BadgeVariant;
  /** Custom color override */
  color?: string;
  /** Size preset */
  size?: "xs" | "sm" | "md";
}

const VARIANT_COLORS: Record<BadgeVariant, string> = {
  green: C.green,
  amber: C.amber,
  red: C.red,
  dim: C.textDim,
  ghost: C.textGhost,
};

const SIZE_STYLES: Record<string, { fontSize: string; padding: string }> = {
  xs: { fontSize: "0.25rem", padding: "1px 3px" },
  sm: { fontSize: "0.3rem", padding: "1px 4px" },
  md: { fontSize: "0.35rem", padding: "2px 6px" },
};

export function StatusBadge({
  text,
  variant = "dim",
  color,
  size = "sm",
}: StatusBadgeProps) {
  const badgeColor = color ?? VARIANT_COLORS[variant];
  const sizeStyle = SIZE_STYLES[size];

  return (
    <span
      className="uppercase tracking-[0.1em]"
      style={{
        ...mono,
        fontSize: sizeStyle.fontSize,
        color: badgeColor,
        padding: sizeStyle.padding,
        border: `1px solid ${badgeColor}30`,
        borderRadius: 2,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}
