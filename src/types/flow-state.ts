/**
 * FLOW API CONTRACT — FlowState
 *
 * This type is the exact shape returned by GET /api/flow/state.
 * Frontend must consume it as-is. Do not change without frontend coordination.
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

export interface FlowState {
  windowState: WindowState;
  windowLabel: string;

  /** Seconds until window closes; frontend formats as MM:SS */
  windowCountdownSec: number;
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
  sessionEarnings: number;

  signals: {
    text: string;
    type: "event" | "weather" | "transport" | "surge";
  }[];

  upcoming: {
    time: string;
    zone: string;
    saturation: number;
    earnings: number;
  }[];

  peaks: {
    time: string;
    zone: string;
    reason: string;
    score: number;
  }[];

  /** API contract version; future-proof and debug */
  version?: number;
  /** ISO timestamp when this state was generated */
  generatedAt?: string;

  /** Day templates derived from daily pack (Matin/Midi/Soir/Nuit) */
  templates?: DayTemplate[];
}

export type DayTemplateWindow = "morning" | "midday" | "evening" | "night";

export interface DayTemplate {
  id: string;
  title: string;
  window: DayTemplateWindow;
  description: string;
  fuelBand: string;
  movement: number;
  stress: number;
  potential: number;
  suggestedZones: string[];
  reasons: string[];
}
