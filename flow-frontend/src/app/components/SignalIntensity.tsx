// FLOW — SignalIntensity: Dot-based intensity indicator
// 1-4 dots. Color = signal state. No text, pure visual.
// Variants: 1 dot (weak), 2 dots (forming), 3 dots (active), 4 dots (strong)

import { C } from "./theme";

interface SignalIntensityProps {
  /** 0..1 confidence/pressure value */
  value: number;
  /** Override color (defaults to threshold-based) */
  color?: string;
  /** Dot size in px (default 4) */
  size?: number;
}

function intensityDots(value: number): number {
  if (value >= 0.8) return 4;
  if (value >= 0.6) return 3;
  if (value >= 0.35) return 2;
  return 1;
}

function intensityColor(value: number): string {
  if (value >= 0.8) return C.green;
  if (value >= 0.6) return C.greenDim;
  if (value >= 0.35) return C.amber;
  return C.gray;
}

export function SignalIntensity({ value, color, size = 4 }: SignalIntensityProps) {
  const dots = intensityDots(value);
  const dotColor = color ?? intensityColor(value);
  const gap = Math.max(2, size - 1);

  return (
    <div className="flex items-center" style={{ gap }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            backgroundColor: i < dots ? dotColor : `${C.textGhost}40`,
          }}
        />
      ))}
    </div>
  );
}
