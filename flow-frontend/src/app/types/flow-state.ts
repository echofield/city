/**
 * FlowState — API contract from GET /api/flow/state.
 * Must match backend city-flow src/types/flow-state.ts
 * Frontend does not compute phase, action, or zones; only renders.
 */

export type ShiftPhase =
  | "calme"
  | "montee"
  | "pic"
  | "dispersion";

export type WindowState =
  | "forming"
  | "active"
  | "closing"
  | "stable";

export type ActionType =
  | "hold"
  | "prepare"
  | "move"
  | "rest";

export type ZoneStateApi = "cold" | "warm" | "hot" | "blocked";

export type BanlieueHubStatus = "dormant" | "forming" | "active";

export interface BanlieueHubState {
  id: string;
  heat: number;
  status: BanlieueHubStatus;
  nextPic?: string;
  corridor: "nord" | "est" | "sud" | "ouest";
}

export interface FlowState {
  windowState: WindowState;
  windowLabel: string;
  windowCountdownSec: number;
  /** What the countdown is counting down to */
  countdownTargetLabel?: string;
  windowMinutes: number;
  shiftPhase: ShiftPhase;
  shiftProgress: number;
  action: ActionType;
  actionLabel: string;
  confidence: number;
  fieldMessage: string;
  temporalMessage: string;
  targetZone: string;
  targetZoneArr: string;
  favoredCorridor: string;
  favoredZoneIds: string[];
  alternatives: string[];
  zoneHeat: Record<string, number>;
  zoneSaturation: Record<string, number>;
  zoneState: Record<string, ZoneStateApi>;
  earningsEstimate: [number, number];
  /** Intensity label: FORT | MODERE | FAIBLE */
  earningsIntensity?: "FORT" | "MODERE" | "FAIBLE";
  sessionEarnings: number;
  signals: { text: string; type: "event" | "weather" | "transport" | "surge" }[];
  upcoming: { time: string; zone: string; saturation: number; earnings: number }[];
  peaks: { time: string; zone: string; reason: string; score: number; lifecycle?: 'maintenant' | 'prochain' | 'ce_soir'; venue?: string; affluence?: string }[];
  /** Optional; not in API contract, backend may omit */
  memory?: { time: string; zone: string; captured: boolean }[];
  /** API contract version; future-proof and debug */
  version?: number;
  /** ISO timestamp when this state was generated */
  generatedAt?: string;
  /** Banlieue hub states (CDG, Orly, La Defense, etc.) */
  banlieueHubs?: Record<string, BanlieueHubState>;
}

/** Format seconds as MM:SS for display */
export function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Map API zoneState (cold/warm/hot/blocked) to FlowMap ZoneState (dormant/forming/active/peak/fading) */
export type ZoneStateDisplay = "dormant" | "forming" | "active" | "peak" | "fading";

export function zoneStateApiToDisplay(
  zoneState: Record<string, ZoneStateApi>
): Record<string, ZoneStateDisplay> {
  const out: Record<string, ZoneStateDisplay> = {};
  for (const [id, s] of Object.entries(zoneState)) {
    out[id] =
      s === "hot" ? "active"
      : s === "warm" ? "forming"
      : s === "blocked" ? "fading"
      : "dormant";
  }
  return out;
}

/** Parse "MM:SS" to seconds (for fallback adapter) */
function parseCountdownToSec(mmss: string): number {
  const [m, s] = mmss.split(":").map(Number);
  return (m ?? 0) * 60 + (s ?? 0);
}

/** Map engine ZoneState (dormant/forming/active/peak/fading) to API zoneState (cold/warm/hot/blocked) */
function engineZoneStateToApi(
  zoneStates: Record<string, string>
): Record<string, ZoneStateApi> {
  const out: Record<string, ZoneStateApi> = {};
  for (const [id, s] of Object.entries(zoneStates)) {
    out[id] =
      s === "active" || s === "peak" ? "hot"
      : s === "forming" ? "warm"
      : s === "fading" ? "blocked"
      : "cold";
  }
  return out;
}

/**
 * Convert FlowEngine-computed state to API FlowState shape for demo fallback.
 * Use when the API is unreachable so the UI never shows a blank screen.
 */
export function engineStateToApiState(engine: {
  windowCountdown: string;
  zoneStates: Record<string, string>;
  memory?: { time: string; zone: string; captured: boolean }[];
  [k: string]: unknown;
}): FlowState {
  const e = engine as Record<string, unknown>;
  return {
    windowState: e.windowState as FlowState["windowState"],
    windowLabel: e.windowLabel as string,
    windowCountdownSec: parseCountdownToSec((e.windowCountdown as string) ?? "0:00"),
    windowMinutes: (e.windowMinutes as number) ?? 0,
    shiftPhase: e.shiftPhase as FlowState["shiftPhase"],
    shiftProgress: (e.shiftProgress as number) ?? 0,
    action: e.action as FlowState["action"],
    actionLabel: e.actionLabel as string,
    confidence: (e.confidence as number) ?? 0,
    fieldMessage: (e.fieldMessage as string) ?? "",
    temporalMessage: (e.temporalMessage as string) ?? "",
    targetZone: (e.targetZone as string) ?? "",
    targetZoneArr: (e.targetZoneArr as string) ?? "",
    favoredCorridor: (e.favoredCorridor as string) ?? "",
    favoredZoneIds: (e.favoredZoneIds as string[]) ?? [],
    alternatives: (e.alternatives as string[]) ?? [],
    zoneHeat: (e.zoneHeat as Record<string, number>) ?? {},
    zoneSaturation: (e.zoneSaturation as Record<string, number>) ?? {},
    zoneState: engineZoneStateToApi((e.zoneStates as Record<string, string>) ?? {}),
    earningsEstimate: (e.earningsEstimate as [number, number]) ?? [0, 0],
    earningsIntensity: (e.earningsIntensity as "FORT" | "MODERE" | "FAIBLE") ?? "MODERE",
    sessionEarnings: (e.sessionEarnings as number) ?? 0,
    signals: (e.signals as FlowState["signals"]) ?? [],
    upcoming: (e.upcoming as FlowState["upcoming"]) ?? [],
    peaks: (e.peaks as FlowState["peaks"]) ?? [],
    memory: engine.memory,
    banlieueHubs: (e.banlieueHubs as Record<string, BanlieueHubState>) ?? undefined,
    version: 1,
    generatedAt: new Date().toISOString(),
  };
}
