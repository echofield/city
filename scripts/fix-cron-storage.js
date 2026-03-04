const fs = require('fs');
let content = fs.readFileSync('src/app/api/cron/compile-tonight/route.ts', 'utf8');

// Add import for Supabase storage
content = content.replace(
  "import type { TonightPack, WeeklyWindow, EventSignal, WeatherSignal, TransportSignal } from '@/lib/signal-fetchers/types'",
  `import type { TonightPack, WeeklyWindow, EventSignal, WeatherSignal, TransportSignal } from '@/lib/signal-fetchers/types'
import { storageWriteJson, isStorageConfigured } from '@/lib/supabase/storageFetchJson'`
);

// Replace local disk write with Supabase Storage write
content = content.replace(
  `    // Write to disk
    const root = path.join(process.cwd(), 'data', 'city-signals', 'tonight')
    fs.mkdirSync(root, { recursive: true })
    const filePath = path.join(root, \`\${date}.paris-idf.json\`)
    fs.writeFileSync(filePath, JSON.stringify(pack, null, 2), 'utf-8')`,
  `    // Write to Supabase Storage (persistent across Vercel invocations)
    const storagePath = \`tonight/\${date}.paris-idf.json\`
    if (isStorageConfigured()) {
      try {
        await storageWriteJson('flow-packs', storagePath, pack)
        console.log(\`[cron] Pack saved to Supabase Storage: \${storagePath}\`)
      } catch (storageErr) {
        console.error('[cron] Supabase Storage write failed:', storageErr)
        // Continue - the pack was compiled, just couldn't persist
      }
    } else {
      console.warn('[cron] Supabase Storage not configured - pack will not persist')
    }
    
    // Also write to local disk (useful for development/debugging)
    if (process.env.NODE_ENV === 'development') {
      const root = path.join(process.cwd(), 'data', 'city-signals', 'tonight')
      fs.mkdirSync(root, { recursive: true })
      const filePath = path.join(root, \`\${date}.paris-idf.json\`)
      fs.writeFileSync(filePath, JSON.stringify(pack, null, 2), 'utf-8')
    }`
);

fs.writeFileSync('src/app/api/cron/compile-tonight/route.ts', content);
console.log('Cron route updated to use Supabase Storage');
