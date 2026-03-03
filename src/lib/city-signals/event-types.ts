/**
 * Event Types for city-flow
 * Source data format for banlieue/Paris events
 */

export type EventCategory =
  | "concert"
  | "sport"
  | "expo"
  | "festival"
  | "other"

export type FlowCorridor = "nord" | "est" | "sud" | "ouest"

export type ConfidenceLevel = "high" | "medium" | "low"

export interface PressureWindow {
  type: "arrivals" | "midday" | "exit" | "late_arrivals" | "nocturne_exit" | "departures" | "evening_returns"
  window: string  // "08:00–10:00"
  description?: string
}

export interface BanlieueEvent {
  id: string
  name: string
  venue: string
  city: string
  department: string  // "93", "92", "94", "75", "95"
  category: EventCategory
  start_date: string  // "2026-03-14"
  end_date: string
  start_time: string | null  // "21:10"
  end_time: string | null
  expected_attendance: number | null
  typical_pressure_windows: string[]
  zoneImpact: string[]
  infra_corridors: string[]
  flow_corridor: FlowCorridor
  sources: string[]
  confidence: ConfidenceLevel
}

/**
 * Parsed pressure window from typical_pressure_windows strings
 */
export interface ParsedPressureWindow {
  type: string
  start: string
  end: string
  note?: string
}

/**
 * Parse pressure window string like "arrivals 08:00–10:00 (pros industrie)"
 */
export function parsePressureWindow(raw: string): ParsedPressureWindow | null {
  // Pattern: "type HH:MM–HH:MM (optional note)"
  const match = raw.match(/^(\w+)\s+(\d{1,2}:\d{2})[–-](\d{1,2}:\d{2})(?:\s*\(([^)]+)\))?/)
  if (!match) {
    // Try simpler pattern: "type HH:MM–HH:MM"
    const simpleMatch = raw.match(/^(\w+)\s+(\d{1,2}:\d{2})[–-](\d{1,2}:\d{2})/)
    if (simpleMatch) {
      return {
        type: simpleMatch[1],
        start: simpleMatch[2],
        end: simpleMatch[3],
      }
    }
    return null
  }

  return {
    type: match[1],
    start: match[2],
    end: match[3],
    note: match[4],
  }
}
