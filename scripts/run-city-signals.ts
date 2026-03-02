/**
 * City Signals Engine Run — writes daily CitySignalsPackV1 to data/city-signals/YYYY-MM-DD.json
 * Modes: --mock (mock only), or run mode: full (FULL), evening (EVENING), night (NIGHT).
 * Pack is validated before writing; existing pack is preserved if generation or validation fails.
 */

import * as fs from 'fs'
import * as path from 'path'
import type { CitySignalsPackV1 } from '../src/types/city-signals-pack'
import { validateCitySignalsPackV1 } from './validate-city-signals-pack'
import { generateCitySignalsPackV1FromLLM, type RunMode } from './generate-city-signals-llm'
import { filterPackAgainstMonthShape, getDefaultMonthShape } from '../src/lib/city-signals/month-shape-guardian'

function getTodayISO(): string {
  const now = new Date()
  return now.toISOString().slice(0, 10) // YYYY-MM-DD
}

export function generateMockCitySignalsPackV1(): CitySignalsPackV1 {
  const date = getTodayISO()
  const generatedAt = new Date().toISOString()
  return {
    date,
    generatedAt,
    events: [
      {
        name: 'Concert Phoenix',
        venue: 'Accor Arena',
        zoneImpact: ['Bercy', 'Nation', 'Gare de Lyon'],
        startTime: '20:00',
        endTime: '23:00',
        expectedAttendance: 20000,
        type: 'concert',
      },
      {
        name: 'PSG vs Monaco',
        venue: 'Parc des Princes',
        zoneImpact: ['Porte de Saint-Cloud', 'Auteuil', 'Boulogne'],
        startTime: '21:00',
        endTime: '23:00',
        expectedAttendance: 45000,
        type: 'sport',
      },
    ],
    transport: [
      {
        line: 'RER A',
        type: 'incident',
        impactZones: ['Gare du Nord', 'Gare de Lyon', 'Châtelet'],
        startTime: '18:00',
        endTime: '22:00',
      },
    ],
    weather: [
      {
        type: 'rain_start',
        expectedAt: '19:00',
        impactLevel: 2,
      },
    ],
  }
}

function parseArgs(): { mock: boolean; runMode: RunMode } {
  const argv = process.argv.slice(2)
  const mock = argv.includes('--mock')
  if (argv.includes('--night')) return { mock, runMode: 'NIGHT' }
  if (argv.includes('--evening')) return { mock, runMode: 'EVENING' }
  if (argv.includes('--full')) return { mock, runMode: 'FULL' }
  return { mock, runMode: 'FULL' }
}

async function main(): Promise<void> {
  const { mock, runMode } = parseArgs()
  const date = getTodayISO()
  const root = path.join(process.cwd(), 'data', 'city-signals')
  const filePath = path.join(root, `${date}.json`)

  let pack: CitySignalsPackV1 | null = null

  if (mock) {
    pack = generateMockCitySignalsPackV1()
    const result = validateCitySignalsPackV1(pack)
    if (!result.success) {
      console.error('Mock validation failed:', result.errors)
      process.exit(1)
    }
    pack = result.pack
  } else {
    pack = await generateCitySignalsPackV1FromLLM({ date, runMode })
    if (!pack) {
      console.error('LLM/drop-in generation failed or invalid. Existing pack not overwritten.')
      process.exit(1)
    }
  }

  pack = filterPackAgainstMonthShape(pack, getDefaultMonthShape())

  fs.mkdirSync(root, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(pack, null, 2), 'utf-8')
  console.log('Written', filePath, new Date().toISOString(), mock ? '(mock)' : `(${runMode})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
