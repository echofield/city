/**
 * List Sensors Missing GPS
 *
 * Scans sensor JSON files and outputs a list of venues that need GPS enrichment.
 * Output format: JSON ready for Perplexity enrichment prompt.
 */

import * as fs from 'fs'
import * as path from 'path'

interface SensorItem {
  id: string
  name: string
  lat?: number
  lon?: number
  arrondissement?: string
  zone_hint?: string
  category?: string
  type?: string
}

interface MissingGpsItem {
  id: string
  name: string
  zone_hint?: string
  arrondissement?: string
  type: string
  source_file: string
}

function scanJsonFile(filePath: string, results: MissingGpsItem[]): void {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)

    // Handle different JSON structures
    let items: SensorItem[] = []

    if (Array.isArray(data)) {
      items = data
    } else if (data.items && Array.isArray(data.items)) {
      items = data.items
    } else if (data.venues && Array.isArray(data.venues)) {
      items = data.venues
    } else if (data.clusters && Array.isArray(data.clusters)) {
      // Hotel clusters have centroid, not individual lat/lon
      return
    }

    const relativePath = path.relative(process.cwd(), filePath)

    for (const item of items) {
      if (!item.id) continue

      // Check if GPS is missing
      if (item.lat === undefined || item.lon === undefined) {
        results.push({
          id: item.id,
          name: item.name || item.id,
          zone_hint: item.zone_hint,
          arrondissement: item.arrondissement,
          type: item.category || item.type || 'unknown',
          source_file: relativePath
        })
      }
    }
  } catch (error) {
    console.error(`[scan] Error reading ${filePath}:`, error)
  }
}

function scanDirectory(dirPath: string, results: MissingGpsItem[]): void {
  if (!fs.existsSync(dirPath)) return

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      // Skip gps directory (that's the output)
      if (entry.name !== 'gps') {
        scanDirectory(fullPath, results)
      }
    } else if (entry.name.endsWith('.json')) {
      scanJsonFile(fullPath, results)
    }
  }
}

function main(): void {
  const results: MissingGpsItem[] = []
  const cwd = process.cwd()

  // Scan sensor directories
  const scanPaths = [
    path.join(cwd, 'data', 'sensors'),
    path.join(cwd, 'data', 'venues')
  ]

  for (const scanPath of scanPaths) {
    console.log(`[scan] Scanning ${scanPath}...`)
    scanDirectory(scanPath, results)
  }

  // Deduplicate by ID
  const uniqueMap = new Map<string, MissingGpsItem>()
  for (const item of results) {
    if (!uniqueMap.has(item.id)) {
      uniqueMap.set(item.id, item)
    }
  }

  const uniqueResults = Array.from(uniqueMap.values())

  // Sort by type, then name
  uniqueResults.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type)
    return a.name.localeCompare(b.name)
  })

  console.log(`\n[scan] Found ${uniqueResults.length} venues missing GPS coordinates\n`)

  // Output JSON
  const output = {
    generated_at: new Date().toISOString(),
    count: uniqueResults.length,
    items: uniqueResults
  }

  const outputPath = path.join(cwd, 'data', 'sensors', 'gps', 'missing-gps-list.json')
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`[scan] Written to ${outputPath}`)

  // Also output Perplexity-ready prompt format
  console.log('\n--- Perplexity Prompt Format ---\n')
  console.log('Venues list (id — name):')
  uniqueResults.forEach((item, index) => {
    console.log(`${index + 1}) ${item.id} — ${item.name}`)
  })

  // Stats by type
  const byType = new Map<string, number>()
  for (const item of uniqueResults) {
    byType.set(item.type, (byType.get(item.type) || 0) + 1)
  }

  console.log('\n--- Stats by Type ---')
  for (const [type, count] of byType) {
    console.log(`  ${type}: ${count}`)
  }
}

main()
