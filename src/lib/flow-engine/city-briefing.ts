/**
 * FLOW City Briefing — AI Synthesis Layer
 *
 * Takes top 5 signals and generates a tactical French summary
 * using DeepSeek API. Rules detect. LLMs express.
 *
 * The AI does NOT decide what matters — it only explains
 * the already-ranked signals in natural, concise French.
 */

import { cache, CACHE_KEYS } from '@/lib/cache'
import type { Signal } from '@/types/signal'

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface CityBriefingInput {
  signals: Signal[]           // top 5 signals, already ranked
  currentTime: string         // ISO or "HH:mm" format
  driverZone?: string         // optional: driver's current zone
  shiftPhase?: string         // calme | montee | pic | dispersion
}

export interface CityBriefing {
  lines: string[]             // 3-4 tactical bullet lines in French
  generatedAt: string         // ISO timestamp
  signalCount: number         // how many signals were used
  cached: boolean             // whether this was served from cache
}

// ═══════════════════════════════════════════════════════════════════
// DEEPSEEK API
// ═══════════════════════════════════════════════════════════════════

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-chat'
const CACHE_TTL_SECONDS = 300 // 5 minutes

/**
 * Build the prompt for DeepSeek
 * Forces concise French, no hallucination, grounded in signals only
 */
function buildPrompt(input: CityBriefingInput): string {
  const { signals, currentTime, driverZone, shiftPhase } = input

  // Format signals into structured text
  const signalLines = signals.map((s, i) => {
    const timeLabel = s.time_window?.label || s.time_window?.start || ''
    const density = s.driver_density === 'opportunity' ? 'peu de chauffeurs'
      : s.driver_density === 'saturated' ? 'zone saturee'
      : ''
    return `${i + 1}. ${s.title} @ ${s.zone}${s.arrondissement ? ` (${s.arrondissement})` : ''} — ${timeLabel}${density ? ` [${density}]` : ''} — ${s.reason}`
  }).join('\n')

  const contextLine = [
    `Heure: ${currentTime}`,
    driverZone ? `Position: ${driverZone}` : null,
    shiftPhase ? `Phase: ${shiftPhase}` : null,
  ].filter(Boolean).join(' | ')

  return `Tu es un assistant pour chauffeurs VTC a Paris. Tu recois des signaux de demande en temps reel.

CONTEXTE:
${contextLine}

SIGNAUX ACTIFS (classes par priorite):
${signalLines}

CONSIGNES:
- Ecris 3-4 lignes tactiques en francais concis (style operateur radio)
- Pas de formules de politesse, pas d'introduction
- Uniquement des faits et recommandations directes
- NE JAMAIS inventer de lieux, horaires ou evenements non mentionnes ci-dessus
- Utilise UNIQUEMENT les informations des signaux fournis
- Style: "• Bercy en sortie, flux vers Gare de Lyon" ou "• Montmartre calme, eviter"

REPONSE (3-4 lignes, format bullet points):`
}

/**
 * Call DeepSeek API with the prompt
 */
async function callDeepSeek(prompt: string): Promise<string | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    console.warn('[city-briefing] DEEPSEEK_API_KEY not configured')
    return null
  }

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,  // Low temp for consistency
        max_tokens: 200,   // Keep it short
        stream: false,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[city-briefing] DeepSeek API error:', response.status, errorText)
      return null
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content || typeof content !== 'string') {
      console.error('[city-briefing] Invalid DeepSeek response:', data)
      return null
    }

    return content.trim()
  } catch (err) {
    console.error('[city-briefing] DeepSeek request failed:', err)
    return null
  }
}

/**
 * Parse the AI response into bullet lines
 */
function parseResponse(rawText: string): string[] {
  // Split by newlines, clean up bullet points
  const lines = rawText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      // Remove leading bullet chars and normalize
      return line.replace(/^[•\-\*]\s*/, '').trim()
    })
    .filter(line => line.length > 5) // Filter out empty/tiny lines

  // Take max 4 lines
  return lines.slice(0, 4)
}

// ═══════════════════════════════════════════════════════════════════
// FALLBACK — When API fails
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a simple fallback briefing from signals
 * No AI, just templated French based on signal data
 */
function generateFallbackBriefing(input: CityBriefingInput): string[] {
  const { signals, shiftPhase } = input
  const lines: string[] = []

  // Phase context
  if (shiftPhase === 'pic') {
    lines.push('Phase pic active — demande elevee')
  } else if (shiftPhase === 'montee') {
    lines.push('Montee en cours — flux en formation')
  }

  // Top signals as simple lines
  for (const signal of signals.slice(0, 3)) {
    const zone = signal.zone || 'Paris'
    const arr = signal.arrondissement ? ` (${signal.arrondissement})` : ''

    if (signal.type === 'event_exit') {
      lines.push(`Sortie ${zone}${arr} — positionnement conseille`)
    } else if (signal.type === 'transport_wave') {
      lines.push(`Flux gare/aeroport ${zone}${arr}`)
    } else if (signal.type === 'nightlife') {
      lines.push(`Activite nocturne ${zone}${arr}`)
    } else if (signal.type === 'weather') {
      lines.push(`Meteo favorable — demande accrue`)
    } else {
      lines.push(`Signal actif ${zone}${arr}`)
    }
  }

  // Ensure we have at least one line
  if (lines.length === 0) {
    lines.push('Ville calme — surveiller les signaux')
  }

  return lines.slice(0, 4)
}

// ═══════════════════════════════════════════════════════════════════
// MAIN API
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a city briefing from top signals
 * Uses DeepSeek API with caching and fallback
 */
export async function generateCityBriefing(
  input: CityBriefingInput
): Promise<CityBriefing> {
  const { signals } = input

  // Validate input
  if (!signals || signals.length === 0) {
    return {
      lines: ['Aucun signal actif — ville calme'],
      generatedAt: new Date().toISOString(),
      signalCount: 0,
      cached: false,
    }
  }

  // Build cache key from signal IDs (stable across same signals)
  const signalKey = signals
    .slice(0, 5)
    .map(s => s.id)
    .sort()
    .join('-')
  const cacheKey = `city-briefing-${signalKey}`

  // Check cache first
  const cached = cache.get<CityBriefing>(cacheKey)
  if (cached) {
    return { ...cached, cached: true }
  }

  // Build prompt and call DeepSeek
  const prompt = buildPrompt(input)
  const rawResponse = await callDeepSeek(prompt)

  let lines: string[]

  if (rawResponse) {
    // Parse AI response
    lines = parseResponse(rawResponse)

    // If parsing failed, use fallback
    if (lines.length === 0) {
      console.warn('[city-briefing] AI response parsed to empty, using fallback')
      lines = generateFallbackBriefing(input)
    }
  } else {
    // API failed, use fallback
    console.warn('[city-briefing] Using fallback briefing')
    lines = generateFallbackBriefing(input)
  }

  const briefing: CityBriefing = {
    lines,
    generatedAt: new Date().toISOString(),
    signalCount: signals.length,
    cached: false,
  }

  // Cache the result
  cache.set(cacheKey, briefing, CACHE_TTL_SECONDS)

  return briefing
}

/**
 * Get current Paris time as HH:mm string
 */
export function getCurrentParisTime(): string {
  const now = new Date()
  const parisTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  const hours = String(parisTime.getHours()).padStart(2, '0')
  const minutes = String(parisTime.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}
