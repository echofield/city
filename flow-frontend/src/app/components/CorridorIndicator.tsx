// FLOW — Corridor Indicator: Status dots for Paris corridors
// Fluide = dim dot. Dense = amber. Plein = red.
// 4 directions. Each is a state. Nothing more.

import { C, mono, label } from "./theme";
import type { CorridorStatus } from "./FlowEngine";

function getStatusVisual(status: CorridorStatus["status"]): {
  color: string;
  symbol: string;
} {
  switch (status) {
    case "fluide":
      return { color: C.textDim, symbol: "\u25CB" };
    case "dense":
      return { color: C.amber, symbol: "\u25CF" };
    case "plein":
      return { color: C.red, symbol: "\u25C9" };
  }
}

export function CorridorRow({ corridor }: { corridor: CorridorStatus }) {
  const { color, symbol } = getStatusVisual(corridor.status);

  return (
    <div className="flex items-center gap-3 py-2">
      <span
        className="uppercase tracking-[0.15em] w-12"
        style={{ ...label, fontSize: "0.6rem", color: C.textMid }}
      >
        {corridor.direction}
      </span>
      <span style={{ fontSize: "0.6rem", color, lineHeight: 1 }}>{symbol}</span>
      <span
        className="uppercase tracking-[0.1em] flex-1"
        style={{ ...label, fontSize: "0.55rem", color }}
      >
        {corridor.status}
      </span>
      {corridor.reason && (
        <span style={{ ...label, fontSize: "0.55rem", color: C.textDim }}>
          {corridor.reason}
        </span>
      )}
    </div>
  );
}

export function CorridorList({ corridors }: { corridors: CorridorStatus[] }) {
  return (
    <div className="flex flex-col">
      {corridors.map((c) => (
        <CorridorRow key={c.direction} corridor={c} />
      ))}
    </div>
  );
}