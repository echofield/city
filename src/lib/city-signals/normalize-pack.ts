/**
 * Normalize daily pack: fill missing optional fields with safe defaults.
 * Does not invent content; backward compatible with old packs.
 */

import type {
  CitySignalsPackV1,
  CitySignalsEventV1,
  CitySignalsTransportV1,
  CitySignalsWeatherV1,
  CitySignalsSocialV1,
  EventCategory,
} from '@/types/city-signals-pack'

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function normalizeEvent(e: Record<string, unknown>): CitySignalsEventV1 {
  const type = (e.type as string) ?? 'other'
  const category = (e.category as EventCategory) ?? (type as EventCategory)
  const intensity = e.intensity != null ? clamp(Number(e.intensity), 1, 5) : 3
  return {
    name: String(e.name ?? ''),
    venue: String(e.venue ?? ''),
    zoneImpact: Array.isArray(e.zoneImpact) ? e.zoneImpact.map(String) : [],
    startTime: e.startTime != null ? String(e.startTime) : null,
    endTime: e.endTime != null ? String(e.endTime) : null,
    expectedAttendance: e.expectedAttendance != null ? Number(e.expectedAttendance) : null,
    type: type as CitySignalsEventV1['type'],
    notes: e.notes != null ? String(e.notes) : undefined,
    category: category as EventCategory,
    intensity,
  }
}

function normalizeTransport(t: Record<string, unknown>): CitySignalsTransportV1 {
  const severity = t.severity != null ? clamp(Number(t.severity), 1, 5) : 3
  return {
    line: String(t.line ?? ''),
    type: (t.type as CitySignalsTransportV1['type']) ?? 'incident',
    impactZones: Array.isArray(t.impactZones) ? t.impactZones.map(String) : [],
    startTime: t.startTime != null ? String(t.startTime) : null,
    endTime: t.endTime != null ? String(t.endTime) : null,
    notes: t.notes != null ? String(t.notes) : undefined,
    severity,
  }
}

function normalizeWeather(w: Record<string, unknown>): CitySignalsWeatherV1 {
  const impactLevel = w.impactLevel != null ? clamp(Number(w.impactLevel), 1, 3) : 2
  const precipProb = w.precipProb != null ? clamp(Number(w.precipProb), 0, 100) : undefined
  return {
    type: (w.type as CitySignalsWeatherV1['type']) ?? 'rain_start',
    expectedAt: w.expectedAt != null ? String(w.expectedAt) : null,
    impactLevel,
    notes: w.notes != null ? String(w.notes) : undefined,
    summary: w.summary != null ? String(w.summary) : undefined,
    precipProb,
    tempMin: w.tempMin != null ? Number(w.tempMin) : undefined,
    tempMax: w.tempMax != null ? Number(w.tempMax) : undefined,
  }
}

function normalizeSocial(s: Record<string, unknown>): CitySignalsSocialV1 {
  return {
    type: (s.type as CitySignalsSocialV1['type']) ?? 'other',
    title: String(s.title ?? ''),
    zoneImpact: Array.isArray(s.zoneImpact) ? s.zoneImpact.map(String) : [],
    startTime: s.startTime != null ? String(s.startTime) : null,
    endTime: s.endTime != null ? String(s.endTime) : null,
    notes: s.notes != null ? String(s.notes) : undefined,
  }
}

export function normalizeCitySignalsPack(raw: unknown): CitySignalsPackV1 {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const events = Array.isArray(o.events) ? o.events.map((e) => normalizeEvent(e as Record<string, unknown>)) : []
  const transport = Array.isArray(o.transport) ? o.transport.map((t) => normalizeTransport(t as Record<string, unknown>)) : []
  const weather = Array.isArray(o.weather) ? o.weather.map((w) => normalizeWeather(w as Record<string, unknown>)) : []
  const social = Array.isArray(o.social) ? o.social.map((s) => normalizeSocial(s as Record<string, unknown>)) : []
  return {
    date: String(o.date ?? new Date().toISOString().slice(0, 10)),
    generatedAt: String(o.generatedAt ?? new Date().toISOString()),
    events,
    transport,
    weather,
    social,
  }
}
