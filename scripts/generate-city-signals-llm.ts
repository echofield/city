/**
 * Generate CitySignalsPackV1 via LLM (OpenAI) or manual JSON drop-in.
 * Used by run-city-signals when not --mock.
 */

import * as fs from 'fs'
import * as path from 'path'
import type { CitySignalsPackV1 } from '../src/types/city-signals-pack'
import { validateCitySignalsPackV1 } from './validate-city-signals-pack'

export type RunMode = 'FULL' | 'EVENING' | 'NIGHT'

const PROMPT_PATH = path.join(__dirname, 'prompts', 'city-signals-pack-v1.md')
const DROP_IN_PATH = path.join(process.cwd(), 'data', 'city-signals', '.input.json')

function loadPrompt(date: string, runMode: RunMode): string {
  const raw = fs.readFileSync(PROMPT_PATH, 'utf-8')
  return raw.replace(/\{\{date\}\}/g, date).replace(/\{\{runMode\}\}/g, runMode)
}

function extractJSON(text: string): unknown {
  const trimmed = text.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}') + 1
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(trimmed.slice(start, end)) as unknown
  } catch {
    return null
  }
}

async function callOpenAI(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    })
    if (!res.ok) {
      console.error('OpenAI API error', res.status, await res.text())
      return null
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = data.choices?.[0]?.message?.content
    return content ?? null
  } catch (e) {
    console.error('OpenAI fetch failed', e)
    return null
  }
}

function readDropIn(): string | null {
  try {
    if (fs.existsSync(DROP_IN_PATH)) {
      return fs.readFileSync(DROP_IN_PATH, 'utf-8')
    }
  } catch {
    // ignore
  }
  return null
}

/**
 * Generate pack from LLM or manual drop-in. Validates before return.
 * Returns validated pack or null; does not write.
 */
export async function generateCitySignalsPackV1FromLLM(options: {
  date: string
  runMode: RunMode
}): Promise<CitySignalsPackV1 | null> {
  const { date, runMode } = options
  const prompt = loadPrompt(date, runMode)

  let rawText: string | null = null
  const openaiText = await callOpenAI(prompt)
  if (openaiText) {
    rawText = openaiText
  } else {
    const dropIn = readDropIn()
    if (dropIn) rawText = dropIn
  }

  if (!rawText) {
    console.error('No LLM response and no drop-in file at', DROP_IN_PATH)
    return null
  }

  const parsed = extractJSON(rawText)
  if (!parsed) {
    console.error('Could not parse JSON from response or drop-in file')
    return null
  }

  const result = validateCitySignalsPackV1(parsed)
  if (!result.success) {
    console.error('Validation failed:', result.errors)
    return null
  }

  return result.pack
}
