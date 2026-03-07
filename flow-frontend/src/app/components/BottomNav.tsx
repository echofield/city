// FLOW — Bottom Navigation
// 3 screens: LIVE | CARTE | SEMAINE

import { motion } from "motion/react";
import { C, label } from "./theme";

export type ScreenId = "live" | "carte" | "semaine";

interface BottomNavProps {
  active: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  liveCount?: number;
}

export function BottomNav({ active, onNavigate, liveCount }: BottomNavProps) {
  const screens: { id: ScreenId; label: string }[] = [
    { id: "live", label: "LIVE" },
    { id: "carte", label: "CARTE" },
    { id: "semaine", label: "SEMAINE" },
  ];

  return (
    <nav
      className="shrink-0 flex items-center justify-around"
      style={{
        borderTop: `1px solid ${C.border}`,
        backgroundColor: C.bg,
      }}
    >
      {screens.map((screen) => {
        const isActive = active === screen.id;
        return (
          <button
            key={screen.id}
            onClick={() => onNavigate(screen.id)}
            className="flex-1 relative py-3.5 uppercase tracking-[0.15em] text-center"
            style={{
              ...label,
              fontSize: "0.7rem",
              fontWeight: isActive ? 500 : 400,
              color: isActive ? C.green : C.textDim,
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "color 0.2s ease",
            }}
          >
            {/* Active indicator */}
            {isActive && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute top-0 left-1/4 right-1/4 h-0.5"
                style={{ backgroundColor: C.green }}
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}

            <span className="relative">
              {screen.label}
              {/* Live count badge */}
              {screen.id === "live" && liveCount !== undefined && liveCount > 0 && (
                <span
                  className="absolute -top-1 -right-4 px-1.5 py-0.5 rounded-full"
                  style={{
                    ...label,
                    fontSize: "0.5rem",
                    fontWeight: 600,
                    color: C.bg,
                    backgroundColor: C.green,
                    minWidth: 14,
                  }}
                >
                  {liveCount > 9 ? "9+" : liveCount}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
