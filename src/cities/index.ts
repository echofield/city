/**
 * FLOW CITY REGISTRY
 *
 * Central registry for all supported cities.
 * Each city pack provides a CityConfig and adapter.
 *
 * Usage:
 *   import { getCityConfig, getCityAdapter } from '@/cities'
 *   const config = getCityConfig('paris')
 *   const adapter = getCityAdapter('paris')
 */

import type { CityConfig } from '@/core/types'
import { PARIS_CONFIG } from './paris/config'
import { ParisAdapter, parisAdapter } from './paris/adapter'

// ═══════════════════════════════════════════════════════════════════════════
// CITY REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

export type SupportedCityId = 'paris'

/**
 * All registered city configs
 */
const CITY_CONFIGS: Record<SupportedCityId, CityConfig> = {
  paris: PARIS_CONFIG,
}

/**
 * All registered city adapters
 */
const CITY_ADAPTERS: Record<SupportedCityId, ParisAdapter> = {
  paris: parisAdapter,
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get config for a city
 */
export function getCityConfig(cityId: string): CityConfig | undefined {
  return CITY_CONFIGS[cityId as SupportedCityId]
}

/**
 * Get adapter for a city
 */
export function getCityAdapter(cityId: string): ParisAdapter | undefined {
  return CITY_ADAPTERS[cityId as SupportedCityId]
}

/**
 * Get all supported city IDs
 */
export function getSupportedCities(): SupportedCityId[] {
  return Object.keys(CITY_CONFIGS) as SupportedCityId[]
}

/**
 * Check if a city is supported
 */
export function isSupportedCity(cityId: string): cityId is SupportedCityId {
  return cityId in CITY_CONFIGS
}

/**
 * Get default city (Paris)
 */
export function getDefaultCity(): CityConfig {
  return PARIS_CONFIG
}

/**
 * Get default city ID
 */
export function getDefaultCityId(): SupportedCityId {
  return 'paris'
}

// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

// Paris pack
export * from './paris'
