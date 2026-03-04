const fs = require('fs');
const filepath = 'src/app/api/cron/compile-tonight/route.ts';
let content = fs.readFileSync(filepath, 'utf8');

const oldCode = `    // Write to disk
    const root = path.join(process.cwd(), 'data', 'city-signals', 'tonight')
    fs.mkdirSync(root, { recursive: true })
    const filePath = path.join(root, \`\${date}.paris-idf.json\`)
    fs.writeFileSync(filePath, JSON.stringify(pack, null, 2), 'utf-8')`;

const newCode = `    // Write to Supabase Storage (production) or local disk (development)
    const storagePath = \`tonight/\${date}.paris-idf.json\`
    if (isStorageConfigured()) {
      await storageWriteJson('flow-packs', storagePath, pack)
      console.log(\`[cron] Pack saved to Supabase Storage: \${storagePath}\`)
    } else if (process.env.NODE_ENV === 'development') {
      const root = path.join(process.cwd(), 'data', 'city-signals', 'tonight')
      fs.mkdirSync(root, { recursive: true })
      const filePath = path.join(root, \`\${date}.paris-idf.json\`)
      fs.writeFileSync(filePath, JSON.stringify(pack, null, 2), 'utf-8')
      console.log(\`[cron] Pack saved to local disk: \${filePath}\`)
    } else {
      console.warn('[cron] No storage configured - pack will not persist')
    }`;

if (!content.includes('// Write to disk')) {
  console.log('Already patched or pattern not found');
  process.exit(0);
}

content = content.replace(oldCode, newCode);

fs.writeFileSync(filepath, content);
console.log('Cron route patched to use Supabase Storage');
