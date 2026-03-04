const fs = require('fs');
const filepath = 'src/lib/city-signals/loadCitySignals.ts';
let content = fs.readFileSync(filepath, 'utf8');

// 1. Add async wrapper function before loadTonightPack
const asyncFn = `/**
 * Load tonight pack from Supabase Storage or disk (v1.5)
 */
async function loadTonightPackAsync(date: string): Promise<TonightPack | null> {
  // Try Supabase Storage first (production)
  if (isStorageConfigured()) {
    try {
      const storagePath = \`tonight/\${date}.paris-idf.json\`
      const data = await storageFetchJson<TonightPack>(STORAGE_BUCKET, storagePath)
      if (data && isTonightPack(data)) {
        console.log(\`[loadCitySignals] Source: Supabase tonight pack (\${date})\`)
        const compiledAt = new Date(data.compiledAt)
        const ageHours = (Date.now() - compiledAt.getTime()) / (1000 * 60 * 60)
        if (ageHours > 6) {
          console.warn(\`[loadCitySignals] Tonight pack \${ageHours.toFixed(1)}h old (stale)\`)
          data.meta.stale = true
        }
        return data
      }
    } catch (err) {
      console.error('[loadCitySignals] Supabase tonight pack error:', err)
    }
  }
  // Fallback to local disk
  return loadTonightPack(date)
}

`;

// Find where to insert (before loadTonightPack function)
const searchStr = ' * Load tonight pack from disk (v1.5)';
let insertPoint = content.indexOf(searchStr);
if (insertPoint === -1) {
  console.error('Could not find loadTonightPack function');
  process.exit(1);
}
// Back up to start of JSDoc comment
insertPoint = content.lastIndexOf('/**', insertPoint);

content = content.slice(0, insertPoint) + asyncFn + content.slice(insertPoint);

// 2. Change caller to use async version
content = content.replace(
  'const tonightPack = loadTonightPack(tonightDate)',
  'const tonightPack = await loadTonightPackAsync(tonightDate)'
);

// 3. Remove duplicate log line since async function already logs
content = content.replace(
  `if (tonightPack) {
    console.log(\`[loadCitySignals] Source: Tonight pack v1.5 (\${tonightDate})\`)
    return tonightPackToCitySignalsPack(tonightPack)
  }`,
  `if (tonightPack) {
    return tonightPackToCitySignalsPack(tonightPack)
  }`
);

fs.writeFileSync(filepath, content);
console.log('loadCitySignals.ts patched successfully');
