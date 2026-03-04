/**
 * Weather Signal Fetcher - OpenWeatherMap API
 * Location: Paris (48.8566, 2.3522)
 */

import type { WeatherSignal, WeatherCondition, WeatherImpact } from './types'
import { CONFIDENCE_RUBRIC } from './types'

const PARIS_LAT = 48.8566
const PARIS_LON = 2.3522
const TTL_WEATHER = 3600 // 1 hour

interface OpenWeatherResponse {
  weather: Array<{ id: number; main: string; description: string }>
  main: { temp: number; feels_like: number; humidity: number }
  wind: { speed: number }
  rain?: { '1h'?: number; '3h'?: number }
  snow?: { '1h'?: number; '3h'?: number }
}

interface OpenWeatherForecastResponse {
  list: Array<{
    dt: number
    main: { temp: number }
    weather: Array<{ id: number; main: string }>
    pop: number // probability of precipitation 0-1
    wind: { speed: number }
    rain?: { '3h'?: number }
  }>
}

/**
 * Map OpenWeatherMap condition to our WeatherCondition
 */
function mapCondition(weatherId: number, main: string): WeatherCondition {
  // Weather condition codes: https://openweathermap.org/weather-conditions
  if (weatherId >= 600 && weatherId < 700) return 'snow'
  if (weatherId >= 502 && weatherId < 600) return 'heavy_rain' // Heavy rain
  if (weatherId >= 500 && weatherId < 600) return 'rain'
  if (weatherId >= 300 && weatherId < 400) return 'rain' // Drizzle
  if (weatherId >= 200 && weatherId < 300) return 'rain' // Thunderstorm
  if (main === 'Clouds') return 'cloudy'
  return 'clear'
}

/**
 * Calculate weather impact on VTC demand
 */
function calculateImpact(
  condition: WeatherCondition,
  temp: number,
  rainProb: number
): WeatherImpact {
  // Heavy rain or snow = amplified (everyone wants VTC)
  if (condition === 'heavy_rain' || condition === 'snow') {
    return 'amplified'
  }

  // Light rain = fragmented demand (people seek cover, short trips)
  if (condition === 'rain') {
    return 'fragmented'
  }

  // Cold + any precipitation probability = amplified demand
  if (temp < 10 && rainProb > 0.4) {
    return 'amplified'
  }

  // Clear warm = neutral (more walking, less VTC)
  if (condition === 'clear' && temp > 18) {
    return 'neutral'
  }

  return 'neutral'
}

/**
 * Fetch current weather from OpenWeatherMap
 */
export async function fetchWeatherSignal(): Promise<WeatherSignal | null> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY

  if (!apiKey) {
    console.warn('[weather] OPENWEATHERMAP_API_KEY not configured')
    return null
  }

  try {
    // Fetch current weather
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${PARIS_LAT}&lon=${PARIS_LON}&appid=${apiKey}&units=metric`
    const currentRes = await fetch(currentUrl, { next: { revalidate: TTL_WEATHER } })

    if (!currentRes.ok) {
      console.error('[weather] API error:', currentRes.status)
      return null
    }

    const current: OpenWeatherResponse = await currentRes.json()

    // Fetch forecast for rain probability
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${PARIS_LAT}&lon=${PARIS_LON}&appid=${apiKey}&units=metric&cnt=8`
    const forecastRes = await fetch(forecastUrl, { next: { revalidate: TTL_WEATHER } })
    const forecast: OpenWeatherForecastResponse = forecastRes.ok
      ? await forecastRes.json()
      : { list: [] }

    // Calculate average rain probability over next 24h
    const avgRainProb = forecast.list.length > 0
      ? forecast.list.reduce((sum, item) => sum + item.pop, 0) / forecast.list.length
      : 0

    const weatherMain = current.weather[0]
    const condition = mapCondition(weatherMain.id, weatherMain.main)
    const temp = Math.round(current.main.temp)
    const rainProbability = Math.round(avgRainProb * 100)
    const windSpeed = Math.round(current.wind.speed * 3.6) // m/s to km/h

    const impact = calculateImpact(condition, temp, avgRainProb)

    return {
      type: 'weather',
      condition,
      temperature: temp,
      rainProbability,
      windSpeed,
      impact,
      confidence: CONFIDENCE_RUBRIC.REALTIME_AUTHORITATIVE,
      source: 'openweathermap',
      compiledAt: new Date().toISOString(),
      ttl: TTL_WEATHER,
    }
  } catch (error) {
    console.error('[weather] Fetch error:', error)
    return null
  }
}

/**
 * Create a fallback weather signal when API is unavailable
 */
export function createUnknownWeatherSignal(): WeatherSignal {
  return {
    type: 'weather',
    condition: 'cloudy', // Safe default
    temperature: 15,
    rainProbability: 0,
    windSpeed: 0,
    impact: 'neutral',
    confidence: CONFIDENCE_RUBRIC.UNKNOWN,
    source: 'fallback',
    compiledAt: new Date().toISOString(),
    ttl: 1800, // 30 min - try again soon
  }
}
