/**
 * Export Places Registry
 *
 * Consolidates all sensor/regime JSON files into a single canonical places registry.
 * Outputs:
 *   - data/places/places-registry.paris.json (unified registry)
 *   - data/places/places-registry.research.csv (for Gemini/Perplexity enrichment)
 */

import * as fs from 'fs'
import * as path from 'path'

// ── Types ──

type PlaceKind =
  | 'theatre'
  | 'club'
  | 'concert'
  | 'arena'
  | 'hotel_cluster'
  | 'nightlife_district'
  | 'station'
  | 'airport_gate'
  | 'opera'
  | 'comedy'
  | 'show'
  | 'venue'

type Corridor = 'nord' | 'est' | 'sud' | 'ouest' | 'centre' | null
type CrowdLabel = 'young_metro' | 'premium' | 'mixed' | 'tourist' | 'unknown'

interface PlaceSchedule {
  open: string | null
  close: string | null
  days: number[] | null
}

interface VtcProfile {
  probability: number | null
  crowd: CrowdLabel | null
  exit_duration_min: number | null
}

interface PlaceEntry {
  id: string
  name: string
  kind: PlaceKind
  arrondissement: string | null
  zone_hint: string | null
  corridor: Corridor
  lat: number | null
  lon: number | null
  capacity: number | null
  schedule: PlaceSchedule
  vtc_profile: VtcProfile
  confidence_base: number | null
  sources: string[]
}

interface PlacesRegistry {
  version: string
  city: string
  generated_at: string
  item_count: number
  items: PlaceEntry[]
}

// ── Utilities ──

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Strip accents
    .replace(/[^a-z0-9\s]/g, '')     // Remove punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

function safeReadJson(filePath: string): any {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`[registry] File not found: ${filePath}`)
      return null
    }
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch (error) {
    console.error(`[registry] Error reading ${filePath}:`, error)
    return null
  }
}

function inferCloseTime(item: any): string | null {
  // From theatre patterns
  if (item.show_patterns && Array.isArray(item.show_patterns)) {
    for (const pattern of item.show_patterns) {
      if (pattern.typical_start_times && pattern.typical_duration_min) {
        const startTime = pattern.typical_start_times[0]
        if (startTime) {
          const [h, m] = startTime.split(':').map(Number)
          const totalMinutes = h * 60 + m + pattern.typical_duration_min
          const closeH = Math.floor(totalMinutes / 60) % 24
          const closeM = totalMinutes % 60
          return `${closeH.toString().padStart(2, '0')}:${closeM.toString().padStart(2, '0')}`
        }
      }
    }
  }

  // From venue schedule
  if (item.schedule?.close) {
    return item.schedule.close
  }

  return null
}

function inferDays(item: any): number[] | null {
  // From theatre patterns
  if (item.show_patterns && Array.isArray(item.show_patterns)) {
    const allDays = new Set<number>()
    for (const pattern of item.show_patterns) {
      if (pattern.days) {
        pattern.days.forEach((d: number) => allDays.add(d))
      }
    }
    if (allDays.size > 0) {
      return Array.from(allDays).sort((a, b) => a - b)
    }
  }

  // From venue schedule
  if (item.schedule?.days) {
    return item.schedule.days
  }

  return null
}

// ── Source Readers ──

function readVenuesEnriched(registry: Map<string, PlaceEntry>): void {
  const filePath = path.join(process.cwd(), 'data', 'venues', 'paris-venues-enriched.json')
  const data = safeReadJson(filePath)
  if (!data?.venues) return

  console.log(`[registry] Reading ${data.venues.length} venues from venues_enriched`)

  for (const venue of data.venues) {
    const id = venue.id
    const normalizedName = normalizeName(venue.name || id)

    const entry: PlaceEntry = {
      id,
      name: venue.name || id,
      kind: mapVenueType(venue.type),
      arrondissement: venue.zone || null,
      zone_hint: null,
      corridor: venue.corridor || null,
      lat: venue.lat || null,
      lon: venue.lon || null,
      capacity: venue.capacity || null,
      schedule: {
        open: venue.schedule?.open || null,
        close: venue.schedule?.close || null,
        days: venue.schedule?.days || null
      },
      vtc_profile: {
        probability: venue.vtc_profile?.probability || null,
        crowd: venue.vtc_profile?.crowd || null,
        exit_duration_min: venue.vtc_profile?.exit_duration_min || null
      },
      confidence_base: venue.confidence || null,
      sources: ['venues_enriched']
    }

    mergeEntry(registry, id, normalizedName, entry)
  }
}

function readTheatreSensors(registry: Map<string, PlaceEntry>): void {
  const filePath = path.join(process.cwd(), 'data', 'sensors', 'theatre-exit-sensors.paris.json')
  const data = safeReadJson(filePath)
  if (!data?.items) return

  console.log(`[registry] Reading ${data.items.length} items from theatre_sensors`)

  for (const item of data.items) {
    const id = item.id
    const normalizedName = normalizeName(item.name || id)

    const entry: PlaceEntry = {
      id,
      name: item.name || id,
      kind: mapTheatreCategory(item.category),
      arrondissement: item.arrondissement || null,
      zone_hint: item.zone_hint || null,
      corridor: item.corridor || null,
      lat: item.lat || null,
      lon: item.lon || null,
      capacity: item.capacity || null,
      schedule: {
        open: null,
        close: inferCloseTime(item),
        days: inferDays(item)
      },
      vtc_profile: {
        probability: item.vtc_profile?.probability || null,
        crowd: item.vtc_profile?.crowd || null,
        exit_duration_min: item.vtc_profile?.exit_duration_min || null
      },
      confidence_base: item.confidence || null,
      sources: ['theatre_sensors']
    }

    mergeEntry(registry, id, normalizedName, entry)
  }
}

function readNightlifeDistricts(registry: Map<string, PlaceEntry>): void {
  const filePath = path.join(process.cwd(), 'data', 'sensors', 'generated', 'nightlife-districts.json')
  const data = safeReadJson(filePath)
  if (!data?.districts) return

  console.log(`[registry] Reading ${data.districts.length} items from nightlife_districts`)

  for (const district of data.districts) {
    const id = district.id
    const normalizedName = normalizeName(district.name || id)

    const entry: PlaceEntry = {
      id,
      name: district.name || id,
      kind: 'nightlife_district',
      arrondissement: district.arrondissements?.[0] || null,
      zone_hint: district.name || null,
      corridor: district.corridor || null,
      lat: district.centroid?.lat || null,
      lon: district.centroid?.lon || null,
      capacity: null,
      schedule: {
        open: null,
        close: null,
        days: null
      },
      vtc_profile: {
        probability: district.vtc_likelihood || null,
        crowd: parseCrowdLabel(district.crowd_label),
        exit_duration_min: null
      },
      confidence_base: null,
      sources: ['nightlife_districts']
    }

    mergeEntry(registry, id, normalizedName, entry)
  }
}

function readHotelClusters(registry: Map<string, PlaceEntry>): void {
  const filePath = path.join(process.cwd(), 'data', 'sensors', 'hotel-clusters.json')
  const data = safeReadJson(filePath)
  if (!data?.clusters) return

  console.log(`[registry] Reading ${data.clusters.length} clusters from hotel_clusters`)

  for (const cluster of data.clusters) {
    const id = cluster.id
    const normalizedName = normalizeName(cluster.name || id)

    const entry: PlaceEntry = {
      id,
      name: cluster.name || id,
      kind: 'hotel_cluster',
      arrondissement: cluster.arrondissements?.[0] || null,
      zone_hint: cluster.zones?.join(' / ') || null,
      corridor: cluster.corridor || null,
      lat: cluster.centroid?.lat || null,
      lon: cluster.centroid?.lon || null,
      capacity: null,
      schedule: {
        open: cluster.windows?.checkin?.start || null,
        close: cluster.windows?.checkout?.end || null,
        days: null
      },
      vtc_profile: {
        probability: cluster.vtc_profile?.probability || null,
        crowd: cluster.vtc_profile?.crowd || null,
        exit_duration_min: cluster.vtc_profile?.exit_duration_min || null
      },
      confidence_base: cluster.confidence_base || null,
      sources: ['hotel_clusters']
    }

    mergeEntry(registry, id, normalizedName, entry)
  }

  // Also read staging gates
  if (data.staging_gates) {
    console.log(`[registry] Reading ${data.staging_gates.length} staging gates`)
    for (const gate of data.staging_gates) {
      const id = gate.id
      const normalizedName = normalizeName(gate.name || id)

      const entry: PlaceEntry = {
        id,
        name: gate.name || id,
        kind: 'airport_gate',
        arrondissement: null,
        zone_hint: gate.notes || null,
        corridor: gate.corridor || null,
        lat: gate.centroid?.lat || null,
        lon: gate.centroid?.lon || null,
        capacity: null,
        schedule: { open: null, close: null, days: null },
        vtc_profile: { probability: null, crowd: null, exit_duration_min: null },
        confidence_base: null,
        sources: ['hotel_clusters']
      }

      mergeEntry(registry, id, normalizedName, entry)
    }
  }
}

function readStationExitWaves(registry: Map<string, PlaceEntry>): void {
  const filePath = path.join(process.cwd(), 'data', 'sensors', 'generated', 'station-exit-waves.json')
  const data = safeReadJson(filePath)
  if (!data?.stations) return

  console.log(`[registry] Reading ${data.stations.length} items from station_waves`)

  for (const station of data.stations) {
    const id = station.id
    const normalizedName = normalizeName(station.name || id)

    const entry: PlaceEntry = {
      id,
      name: station.name || id,
      kind: 'station',
      arrondissement: station.arrondissement || null,
      zone_hint: station.zone_hint || null,
      corridor: station.corridor || null,
      lat: station.centroid?.lat || station.lat || null,
      lon: station.centroid?.lon || station.lon || null,
      capacity: null,
      schedule: { open: null, close: null, days: null },
      vtc_profile: {
        probability: station.vtc_likelihood || null,
        crowd: parseCrowdLabel(station.crowd_label),
        exit_duration_min: null
      },
      confidence_base: null,
      sources: ['station_waves']
    }

    mergeEntry(registry, id, normalizedName, entry)
  }
}

function readAirportCorridorWaves(registry: Map<string, PlaceEntry>): void {
  const filePath = path.join(process.cwd(), 'data', 'sensors', 'generated', 'airport-corridor-waves.json')
  const data = safeReadJson(filePath)
  if (!data?.airports) return

  console.log(`[registry] Reading ${data.airports.length} items from airport_corridors`)

  for (const airport of data.airports) {
    const id = airport.id
    const normalizedName = normalizeName(airport.name || id)

    const entry: PlaceEntry = {
      id,
      name: airport.name || id,
      kind: 'airport_gate',
      arrondissement: null,
      zone_hint: airport.zone_hint || null,
      corridor: airport.corridor || null,
      lat: airport.centroid?.lat || airport.lat || null,
      lon: airport.centroid?.lon || airport.lon || null,
      capacity: null,
      schedule: { open: null, close: null, days: null },
      vtc_profile: {
        probability: airport.vtc_likelihood || null,
        crowd: parseCrowdLabel(airport.crowd_label),
        exit_duration_min: null
      },
      confidence_base: null,
      sources: ['airport_corridors']
    }

    mergeEntry(registry, id, normalizedName, entry)
  }
}

// ── Mapping Helpers ──

function mapVenueType(type: string | undefined): PlaceKind {
  if (!type) return 'venue'
  const t = type.toLowerCase()
  if (t.includes('club') || t.includes('nightclub')) return 'club'
  if (t.includes('concert') || t.includes('salle')) return 'concert'
  if (t.includes('arena') || t.includes('stade')) return 'arena'
  if (t.includes('theatre') || t.includes('theater')) return 'theatre'
  if (t.includes('opera')) return 'opera'
  return 'venue'
}

function mapTheatreCategory(category: string | undefined): PlaceKind {
  if (!category) return 'theatre'
  const c = category.toLowerCase()
  if (c === 'opera') return 'opera'
  if (c === 'comedy') return 'comedy'
  if (c === 'show') return 'show'
  if (c === 'concert') return 'concert'
  return 'theatre'
}

function parseCrowdLabel(label: string | undefined): CrowdLabel | null {
  if (!label) return null
  const l = label.toLowerCase()
  if (l.includes('premium')) return 'premium'
  if (l.includes('young') || l.includes('metro') || l.includes('student')) return 'young_metro'
  if (l.includes('tourist')) return 'tourist'
  if (l.includes('mixed') || l.includes('volume')) return 'mixed'
  return 'unknown'
}

// ── Merge Logic ──

const normalizedNameIndex = new Map<string, string>() // normalized name -> first id

function mergeEntry(
  registry: Map<string, PlaceEntry>,
  id: string,
  normalizedName: string,
  newEntry: PlaceEntry
): void {
  // Check for exact ID match
  if (registry.has(id)) {
    const existing = registry.get(id)!
    mergeFields(existing, newEntry)
    return
  }

  // Check for normalized name match
  const existingIdByName = normalizedNameIndex.get(normalizedName)
  if (existingIdByName && registry.has(existingIdByName)) {
    const existing = registry.get(existingIdByName)!
    mergeFields(existing, newEntry)
    return
  }

  // New entry
  registry.set(id, newEntry)
  normalizedNameIndex.set(normalizedName, id)
}

function mergeFields(existing: PlaceEntry, newEntry: PlaceEntry): void {
  // Add source
  for (const src of newEntry.sources) {
    if (!existing.sources.includes(src)) {
      existing.sources.push(src)
    }
  }

  // Merge missing fields (prefer existing, fill gaps)
  if (!existing.lat && newEntry.lat) existing.lat = newEntry.lat
  if (!existing.lon && newEntry.lon) existing.lon = newEntry.lon
  if (!existing.capacity && newEntry.capacity) existing.capacity = newEntry.capacity
  if (!existing.arrondissement && newEntry.arrondissement) existing.arrondissement = newEntry.arrondissement
  if (!existing.zone_hint && newEntry.zone_hint) existing.zone_hint = newEntry.zone_hint
  if (!existing.corridor && newEntry.corridor) existing.corridor = newEntry.corridor
  if (!existing.confidence_base && newEntry.confidence_base) existing.confidence_base = newEntry.confidence_base

  // Merge schedule
  if (!existing.schedule.open && newEntry.schedule.open) existing.schedule.open = newEntry.schedule.open
  if (!existing.schedule.close && newEntry.schedule.close) existing.schedule.close = newEntry.schedule.close
  if (!existing.schedule.days && newEntry.schedule.days) existing.schedule.days = newEntry.schedule.days

  // Merge VTC profile
  if (!existing.vtc_profile.probability && newEntry.vtc_profile.probability) {
    existing.vtc_profile.probability = newEntry.vtc_profile.probability
  }
  if (!existing.vtc_profile.crowd && newEntry.vtc_profile.crowd) {
    existing.vtc_profile.crowd = newEntry.vtc_profile.crowd
  }
  if (!existing.vtc_profile.exit_duration_min && newEntry.vtc_profile.exit_duration_min) {
    existing.vtc_profile.exit_duration_min = newEntry.vtc_profile.exit_duration_min
  }
}

// ── Export Functions ──

function exportJson(registry: Map<string, PlaceEntry>): void {
  const outputDir = path.join(process.cwd(), 'data', 'places')
  fs.mkdirSync(outputDir, { recursive: true })

  const items = Array.from(registry.values())
    .sort((a, b) => a.name.localeCompare(b.name))

  const output: PlacesRegistry = {
    version: 'places_registry_v1',
    city: 'Paris',
    generated_at: new Date().toISOString(),
    item_count: items.length,
    items
  }

  const filePath = path.join(outputDir, 'places-registry.paris.json')
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`[registry] Written ${items.length} places to ${filePath}`)
}

function exportCsv(registry: Map<string, PlaceEntry>): void {
  const outputDir = path.join(process.cwd(), 'data', 'places')
  fs.mkdirSync(outputDir, { recursive: true })

  const items = Array.from(registry.values())
    .sort((a, b) => a.name.localeCompare(b.name))

  const header = 'id,name,kind,arrondissement,zone_hint,corridor,needs_latlon,needs_close_time'
  const rows = items.map(item => {
    const needsLatlon = (item.lat === null || item.lon === null) ? 'true' : 'false'
    const needsCloseTime = (item.schedule.close === null) ? 'true' : 'false'

    // Escape CSV fields
    const escapeCsv = (val: string | null): string => {
      if (val === null) return ''
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }

    return [
      escapeCsv(item.id),
      escapeCsv(item.name),
      escapeCsv(item.kind),
      escapeCsv(item.arrondissement),
      escapeCsv(item.zone_hint),
      escapeCsv(item.corridor),
      needsLatlon,
      needsCloseTime
    ].join(',')
  })

  const csv = [header, ...rows].join('\n')
  const filePath = path.join(outputDir, 'places-registry.research.csv')
  fs.writeFileSync(filePath, csv, 'utf-8')
  console.log(`[registry] Written CSV to ${filePath}`)

  // Stats
  const needingLatlon = items.filter(i => i.lat === null || i.lon === null).length
  const needingCloseTime = items.filter(i => i.schedule.close === null).length
  console.log(`\n[registry] Stats:`)
  console.log(`  Total places: ${items.length}`)
  console.log(`  Needing lat/lon: ${needingLatlon}`)
  console.log(`  Needing close time: ${needingCloseTime}`)

  // Kind breakdown
  const byKind = new Map<string, number>()
  for (const item of items) {
    byKind.set(item.kind, (byKind.get(item.kind) || 0) + 1)
  }
  console.log(`\n[registry] By kind:`)
  for (const [kind, count] of Array.from(byKind.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${kind}: ${count}`)
  }
}

// ── Main ──

function main(): void {
  console.log('[registry] Building canonical places registry...\n')

  const registry = new Map<string, PlaceEntry>()

  // Read all sources
  readVenuesEnriched(registry)
  readTheatreSensors(registry)
  readNightlifeDistricts(registry)
  readHotelClusters(registry)
  readStationExitWaves(registry)
  readAirportCorridorWaves(registry)

  console.log(`\n[registry] Total unique places: ${registry.size}\n`)

  // Export
  exportJson(registry)
  exportCsv(registry)

  console.log('\n[registry] Done.')
}

main()
