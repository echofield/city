// FLOW — Session Progress: Earnings bar
// Shows progress toward target earnings.
// One bar. One number. The driver knows where they stand.

import { motion } from "motion/react";
import { C, mono, label } from "./theme";
import type { DispatchSession } from "./FlowEngine";

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function SessionProgress({ session }: { session: DispatchSession }) {
  const progress = Math.min(1, session.earnings / session.target_earnings);
  const progressColor = progress > 0.75 ? C.green : progress > 0.4 ? C.amber : C.textDim;

  return (
    <div className="flex flex-col gap-3">
      {/* Duration + earnings */}
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-0.5">
          <span
            className="uppercase tracking-[0.15em]"
            style={{ ...label, fontSize: "0.5rem", color: C.textDim }}
          >
            SESSION
          </span>
          <span style={{ ...mono, fontSize: "0.95rem", color: C.text }}>
            {formatDuration(session.duration_min)}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span style={{ ...mono, fontSize: "1.1rem", color: progressColor, lineHeight: 1 }}>
            {session.earnings}
          </span>
          <span style={{ ...mono, fontSize: "0.6rem", color: C.textDim }}>
            / {session.target_earnings} EUR
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ width: "100%", height: 3, borderRadius: 2, backgroundColor: C.textGhost }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{
            height: "100%",
            borderRadius: 2,
            backgroundColor: progressColor,
          }}
        />
      </div>

      {/* Efficiency */}
      <div className="flex items-center justify-between">
        <span style={{ ...label, fontSize: "0.55rem", color: C.textDim }}>
          {session.courses_count} courses
        </span>
        <span style={{ ...mono, fontSize: "0.65rem", color: progressColor }}>
          Efficacite {session.efficiency}%
        </span>
      </div>
    </div>
  );
}
