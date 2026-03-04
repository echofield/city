const fs = require('fs');
let content = fs.readFileSync('src/lib/city-signals/loadCitySignals.ts', 'utf8');

// Replace loadTonightPack to also check Supabase Storage
content = content.replace(
  `/**
 * Load tonight pack from disk (v1.5)
 */
function loadTonightPack(date: string): TonightPack | null {
  const tonightPath = path.join(TONIGHT_DIR, \`\${date}.paris-idf.json\`)

  if (!fs.existsSync(tonightPath)) {
    return null
  }

  try {
    const raw = fs.readFileSync(tonightPath, 'utf-8')
    const data = JSON.parse(raw)

    if (isTonightPack(data)) {
      // Check if pack is too old (> 6 hours)
      const compiledAt = new Date(data.compiledAt)
      const ageHours = (Date.now() - compiledAt.getTime()) / (1000 * 60 * 60)

      if (ageHours > 6) {
        console.warn(\`[loadCitySignals] Tonight pack is \${ageHours.toFixed(1)}h old (stale)\`)
        // Still use it but mark as degraded
        data.meta.stale = true
      }

      return data
    }
  } catch (err) {
    console.error('[loadCitySignals] Tonight pack parse error:', err)
  }

  return null
}`,
  `/**
 * Load tonight pack from Supabase Storage or local disk (v1.5)
 */
async function loadTonightPackAsync(date: string): Promise<TonightPack | null> {
  // 1. Try Supabase Storage first (production)
  if (isStorageConfigured()) {
    try {
      const storagePath = \`tonight/\${date}.paris-idf.json\`
      const data = await storageFetchJson<TonightPack>('flow-packs', storagePath)
      if (data && isTonightPack(data)) {
        console.log(\`[loadCitySignals] Source: Supabase Storage tonight pack (\${date})\`)
        
        // Check if pack is too old (> 6 hours)
        const compiledAt = new Date(data.compiledAt)
        const ageHours = (Date.now() - compiledAt.getTime()) / (1000 * 60 * 60)
        if (ageHours > 6) {
          console.warn(\`[loadCitySignals] Tonight pack is \${ageHours.toFixed(1)}h old (stale)\`)
          data.meta.stale = true
        }
        
        return data
      }
    } catch (err) {
      console.error('[loadCitySignals] Supabase Storage tonight pack error:', err)
    }
  }

  // 2. Fallback to local disk (development)
  const tonightPath = path.join(TONIGHT_DIR, \`\${date}.paris-idf.json\`)
  if (fs.existsSync(tonightPath)) {
    try {
      const raw = fs.readFileSync(tonightPath, 'utf-8')
      const data = JSON.parse(raw)

      if (isTonightPack(data)) {
        console.log(\`[loadCitySignals] Source: Local disk tonight pack (\${date})\`)
        
        const compiledAt = new Date(data.compiledAt)
        const ageHours = (Date.now() - compiledAt.getTime()) / (1000 * 60 * 60)
        if (ageHours > 6) {
          console.warn(\`[loadCitySignals] Tonight pack is \${ageHours.toFixed(1)}h old (stale)\`)
          data.meta.stale = true
        }

        return data
      }
    } catch (err) {
      console.error('[loadCitySignals] Tonight pack parse error:', err)
    }
  }

  return null
}`
);

// Update the caller to use async version
content = content.replace(
  `  // 1. Try tonight pack first (v1.5 real signals)
  const tonightPack = loadTonightPack(tonightDate)
  if (tonightPack) {
    console.log(\`[loadCitySignals] Source: Tonight pack v1.5 (\${tonightDate})\`)
    return tonightPackToCitySignalsPack(tonightPack)
  }`,
  `  // 1. Try tonight pack first (v1.5 real signals) - now async for Supabase
  const tonightPack = await loadTonightPackAsync(tonightDate)
  if (tonightPack) {
    return tonightPackToCitySignalsPack(tonightPack)
  }`
);

fs.writeFileSync('src/lib/city-signals/loadCitySignals.ts', content);
console.log('loadCitySignals updated to check Supabase Storage for tonight packs');
