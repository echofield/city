/**
 * Merge Places Enrichment
 *
 * Merges GPS/schedule enrichment data into places-registry.paris.json
 *
 * Rules:
 * - Match by id
 * - Fill lat/lon if null (do NOT overwrite existing)
 * - Fill schedule.close if missing (do NOT overwrite existing)
 */

import * as fs from 'fs'
import * as path from 'path'

interface EnrichmentResult {
  id: string
  lat?: number
  lon?: number
  close_time?: string
  confidence?: number
}

interface EnrichmentData {
  results: EnrichmentResult[]
}

interface PlaceEntry {
  id: string
  name: string
  lat: number | null
  lon: number | null
  schedule: {
    open: string | null
    close: string | null
    days: number[] | null
  }
  [key: string]: any
}

interface PlacesRegistry {
  version: string
  city: string
  generated_at: string
  item_count: number
  items: PlaceEntry[]
}

function main(): void {
  const cwd = process.cwd()

  // Find enrichment file (use latest or specified)
  const enrichmentArg = process.argv[2]
  let enrichmentPath: string

  if (enrichmentArg) {
    enrichmentPath = path.isAbsolute(enrichmentArg)
      ? enrichmentArg
      : path.join(cwd, enrichmentArg)
  } else {
    // Find latest enrichment file
    const placesDir = path.join(cwd, 'data', 'places')
    const files = fs.readdirSync(placesDir)
      .filter(f => f.startsWith('gemini-enrichment') && f.endsWith('.json'))
      .sort()
      .reverse()

    if (files.length === 0) {
      console.error('[merge] No enrichment files found in data/places/')
      process.exit(1)
    }

    enrichmentPath = path.join(placesDir, files[0])
  }

  console.log(`[merge] Using enrichment file: ${enrichmentPath}`)

  // Load enrichment data
  const enrichmentRaw = fs.readFileSync(enrichmentPath, 'utf-8')
  const enrichment: EnrichmentData = JSON.parse(enrichmentRaw)
  console.log(`[merge] Loaded ${enrichment.results.length} enrichment results`)

  // Load registry
  const registryPath = path.join(cwd, 'data', 'places', 'places-registry.paris.json')
  const registryRaw = fs.readFileSync(registryPath, 'utf-8')
  const registry: PlacesRegistry = JSON.parse(registryRaw)
  console.log(`[merge] Loaded registry with ${registry.items.length} places`)

  // Build enrichment map
  const enrichmentMap = new Map<string, EnrichmentResult>()
  for (const result of enrichment.results) {
    enrichmentMap.set(result.id, result)
  }

  // Merge
  let latlonFilled = 0
  let closeFilled = 0
  let matched = 0
  let notFound = 0

  for (const place of registry.items) {
    const enriched = enrichmentMap.get(place.id)

    if (!enriched) {
      continue
    }

    matched++

    // Fill lat/lon if null
    if (place.lat === null && enriched.lat !== undefined) {
      place.lat = enriched.lat
      latlonFilled++
    }
    if (place.lon === null && enriched.lon !== undefined) {
      place.lon = enriched.lon
      // Only count once per place
    }

    // Fill schedule.close if missing
    if (place.schedule.close === null && enriched.close_time !== undefined) {
      place.schedule.close = enriched.close_time
      closeFilled++
    }
  }

  // Check for enrichment IDs not in registry
  for (const result of enrichment.results) {
    const found = registry.items.some(p => p.id === result.id)
    if (!found) {
      console.warn(`[merge] Enrichment ID not in registry: ${result.id}`)
      notFound++
    }
  }

  // Update metadata
  registry.generated_at = new Date().toISOString()

  // Write back
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8')

  console.log(`\n[merge] Results:`)
  console.log(`  Matched: ${matched}`)
  console.log(`  Lat/lon filled: ${latlonFilled}`)
  console.log(`  Close time filled: ${closeFilled}`)
  console.log(`  Not found in registry: ${notFound}`)
  console.log(`\n[merge] Registry updated: ${registryPath}`)

  // Stats after merge
  const stillNeedingLatlon = registry.items.filter(i => i.lat === null || i.lon === null).length
  const stillNeedingClose = registry.items.filter(i => i.schedule.close === null).length
  console.log(`\n[merge] Remaining gaps:`)
  console.log(`  Still needing lat/lon: ${stillNeedingLatlon}`)
  console.log(`  Still needing close time: ${stillNeedingClose}`)
}

main()
