const fs = require('fs');
const filepath = 'src/lib/city-signals/loadCitySignals.ts';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Change loadTonightPack call to loadTonightPackAsync with await
content = content.replace(
  `  // 1. Try tonight pack first (v1.5 real signals)
  const tonightPack = loadTonightPack(tonightDate)
  if (tonightPack) {
    console.log(\`[loadCitySignals] Source: Tonight pack v1.5 (\${tonightDate})\`)
    return tonightPackToCitySignalsPack(tonightPack)
  }`,
  `  // 1. Try tonight pack first (v1.5 real signals) - check Supabase then disk
  const tonightPack = await loadTonightPackAsync(tonightDate)
  if (tonightPack) {
    return tonightPackToCitySignalsPack(tonightPack)
  }`
);

// 2. Add async loadTonightPackAsync function before loadTonightPack
content = content.replace(
  `/**
 * Load tonight pack from disk (v1.5)
 */
function loadTonightPack(date: string): TonightPack | null {`,
  `/**
 * Load tonight pack from Supabase Storage or disk (v1.5)
 */
async function loadTonightPackAsync(date: string): Promise<TonightPack | null> {
  // 1. Try Supabase Storage first (production)
  if (isStorageConfigured()) {
    try {
      const storagePath = \`tonight/\${date}.paris-idf.json\`
      const data = await storageFetchJson<TonightPack>(STORAGE_BUCKET, storagePath)
      if (data && isTonightPack(data)) {
        console.log(\`[loadCitySignals] Source: Supabase Storage tonight pack (\${date})\`)
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

  // 2. Fallback to local disk
  return loadTonightPack(date)
}

/**
 * Load tonight pack from disk (v1.5)
 */
function loadTonightPack(date: string): TonightPack | null {`
);

fs.writeFileSync(filepath, content);
console.log('loadCitySignals.ts updated to check Supabase for tonight packs');
