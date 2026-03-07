// FLOW — Night Ops: Driver survival infrastructure
// Below the fold on LIVE. Not revenue. Survival.
// Design rules: same as signal cards.
// No emoji. No icons. Color-coded left border only.
// Compact. One-line scan.

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { C, mono, label } from "./theme";
import {
  NIGHT_OPS_CATEGORIES,
  NIGHT_OPS_NODES,
  getNightOpsNearZone,
  type NightOpsCategory,
  type NightOpsNode,
} from "./nightOpsData";

// ── Category filter ──

function CategoryPill({
  category,
  active,
  onToggle,
}: {
  category: NightOpsCategory;
  active: boolean;
  onToggle: () => void;
}) {
  const cat = NIGHT_OPS_CATEGORIES[category];
  return (
    <button
      onClick={onToggle}
      className="uppercase tracking-[0.12em] shrink-0"
      style={{
        ...mono,
        fontSize: "0.4rem",
        color: active ? cat.color : C.textDim,
        backgroundColor: "transparent",
        border: `1px solid ${active ? `${cat.color}30` : C.border}`,
        borderRadius: 2,
        padding: "3px 8px",
        cursor: "pointer",
        transition: "all 0.12s",
      }}
    >
      {cat.label}
    </button>
  );
}

// ── Node card — ultra compact ──

function NodeCard({ node, index }: { node: NightOpsNode; index: number }) {
  const cat = NIGHT_OPS_CATEGORIES[node.category];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.1, delay: index * 0.025 }}
      style={{
        backgroundColor: C.surface,
        borderLeft: `2px solid ${cat.color}`,
        borderRadius: 2,
      }}
    >
      {/* Single dense row */}
      <div className="flex items-start justify-between px-3.5 py-2.5">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
              fontSize: "0.75rem",
              color: C.textBright,
              lineHeight: 1.2,
            }}
          >
            {node.name}
          </span>
          {node.note && (
            <span
              style={{
                ...label,
                fontSize: "0.5rem",
                color: C.textDim,
                lineHeight: 1.3,
              }}
            >
              {node.note}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0 ml-3">
          <span style={{ ...mono, fontSize: "0.4rem", color: C.textDim }}>
            {node.hours}
          </span>
          <span style={{ ...mono, fontSize: "0.35rem", color: C.textGhost }}>
            {node.zone}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main ──

interface NightOpsLayerProps {
  driverZone?: string;
}

export function NightOpsLayer({ driverZone }: NightOpsLayerProps) {
  const [activeCategory, setActiveCategory] = useState<NightOpsCategory | null>(null);
  const [expanded, setExpanded] = useState(false);

  const filteredNodes = useMemo(() => {
    let nodes: NightOpsNode[];
    if (driverZone) {
      nodes = getNightOpsNearZone(driverZone, 12);
    } else {
      nodes = NIGHT_OPS_NODES;
    }
    if (activeCategory) {
      nodes = nodes.filter(n => n.category === activeCategory);
    }
    return nodes;
  }, [driverZone, activeCategory]);

  const displayNodes = expanded ? filteredNodes : filteredNodes.slice(0, 4);
  const categories: NightOpsCategory[] = ["toilet_24h", "food_24h", "gas_ev_24h", "safe_zone"];

  return (
    <div className="flex flex-col gap-0">
      {/* Section label — whispered, not shouted */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span
          className="uppercase tracking-[0.2em]"
          style={{ ...mono, fontSize: "0.3rem", color: C.textGhost }}
        >
          NIGHT OPS
        </span>
        <span style={{ ...mono, fontSize: "0.3rem", color: C.textGhost }}>
          {filteredNodes.length}
        </span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 px-3 pb-2 overflow-x-auto">
        {categories.map((cat) => (
          <CategoryPill
            key={cat}
            category={cat}
            active={activeCategory === cat}
            onToggle={() => setActiveCategory(activeCategory === cat ? null : cat)}
          />
        ))}
      </div>

      {/* Nodes */}
      <div className="flex flex-col gap-1 px-3">
        <AnimatePresence>
          {displayNodes.map((node, i) => (
            <NodeCard key={node.id} node={node} index={i} />
          ))}
        </AnimatePresence>
      </div>

      {/* Expand */}
      {filteredNodes.length > 4 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mx-3 mt-1.5 py-1.5 uppercase tracking-[0.12em]"
          style={{
            ...mono,
            fontSize: "0.35rem",
            color: C.textDim,
            backgroundColor: "transparent",
            border: `1px solid ${C.border}`,
            borderRadius: 2,
            cursor: "pointer",
          }}
        >
          {expanded ? "REDUIRE" : `+${filteredNodes.length - 4}`}
        </button>
      )}
    </div>
  );
}
