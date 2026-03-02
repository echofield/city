/**
 * Strict validation for CitySignalsPackV1. Use before writing artifact.
 */

import type { CitySignalsPackV1 } from '../src/types/city-signals-pack'

const EVENT_TYPES = ['concert', 'sport', 'expo'] as const
const TRANSPORT_TYPES = ['closure', 'incident', 'strike'] as const
const WEATHER_TYPES = ['rain_start', 'heavy_rain', 'cold_spike'] as const
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export type ValidationResult =
  | { success: true; pack: CitySignalsPackV1 }
  | { success: false; errors: string[] }

export function validateCitySignalsPackV1(raw: unknown): ValidationResult {
  const errors: string[] = []
  if (raw === null || typeof raw !== 'object') {
    return { success: false, errors: ['Root must be an object'] }
  }
  const o = raw as Record<string, unknown>

  if (typeof o.date !== 'string' || !DATE_REGEX.test(o.date)) {
    errors.push('date must be YYYY-MM-DD string')
  }
  if (typeof o.generatedAt !== 'string') {
    errors.push('generatedAt must be a string (ISO)')
  }

  if (!Array.isArray(o.events)) {
    errors.push('events must be an array')
  } else {
    o.events.forEach((e: unknown, i: number) => {
      if (e === null || typeof e !== 'object') {
        errors.push(`events[${i}] must be an object`)
        return
      }
      const ev = e as Record<string, unknown>
      if (typeof ev.name !== 'string') errors.push(`events[${i}].name required (string)`)
      if (typeof ev.venue !== 'string') errors.push(`events[${i}].venue required (string)`)
      if (!Array.isArray(ev.zoneImpact) || ev.zoneImpact.some((z: unknown) => typeof z !== 'string')) {
        errors.push(`events[${i}].zoneImpact must be string[]`)
      }
      if (ev.type !== undefined && !EVENT_TYPES.includes(ev.type as typeof EVENT_TYPES[number])) {
        errors.push(`events[${i}].type must be one of: ${EVENT_TYPES.join(', ')}`)
      }
    })
  }

  if (!Array.isArray(o.transport)) {
    errors.push('transport must be an array')
  } else {
    o.transport.forEach((t: unknown, i: number) => {
      if (t === null || typeof t !== 'object') {
        errors.push(`transport[${i}] must be an object`)
        return
      }
      const tr = t as Record<string, unknown>
      if (typeof tr.line !== 'string') errors.push(`transport[${i}].line required (string)`)
      if (!TRANSPORT_TYPES.includes(tr.type as typeof TRANSPORT_TYPES[number])) {
        errors.push(`transport[${i}].type must be one of: ${TRANSPORT_TYPES.join(', ')}`)
      }
      if (!Array.isArray(tr.impactZones) || tr.impactZones.some((z: unknown) => typeof z !== 'string')) {
        errors.push(`transport[${i}].impactZones must be string[]`)
      }
    })
  }

  if (!Array.isArray(o.weather)) {
    errors.push('weather must be an array')
  } else {
    o.weather.forEach((w: unknown, i: number) => {
      if (w === null || typeof w !== 'object') {
        errors.push(`weather[${i}] must be an object`)
        return
      }
      const we = w as Record<string, unknown>
      if (!WEATHER_TYPES.includes(we.type as typeof WEATHER_TYPES[number])) {
        errors.push(`weather[${i}].type must be one of: ${WEATHER_TYPES.join(', ')}`)
      }
      if (typeof we.impactLevel !== 'number') {
        errors.push(`weather[${i}].impactLevel required (number)`)
      }
    })
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }

  return {
    success: true,
    pack: o as CitySignalsPackV1,
  }
}
