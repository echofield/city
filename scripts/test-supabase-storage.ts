/**
 * Quick test script to verify Supabase Storage connection.
 * Run with: npx tsx scripts/test-supabase-storage.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// Load .env.local manually
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        process.env[key] = valueParts.join('=')
      }
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function testStorageFetch() {
  console.log('=== Supabase Storage Test ===\n')

  // Check env vars
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  console.log(`SUPABASE_URL: ${SUPABASE_URL}`)
  console.log(`SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY.slice(0, 20)}...`)
  console.log()

  // Test 1: Fetch the daily pack from 2026-03-02
  const bucket = 'flow-packs'
  const objectPath = 'daily/2026-03-02.paris-idf.json'
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`

  console.log(`Fetching: ${bucket}/${objectPath}`)
  console.log(`URL: ${url}\n`)

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    })

    console.log(`Status: ${res.status} ${res.statusText}`)
    console.log(`Content-Type: ${res.headers.get('content-type')}`)

    if (res.ok) {
      const text = await res.text()
      console.log(`Body length: ${text.length} chars`)

      if (text) {
        try {
          const data = JSON.parse(text)
          console.log('\n=== SUCCESS: File fetched and parsed! ===')
          console.log(`\nPack metadata:`)
          console.log(`  - pack_id: ${data.pack_id || 'N/A'}`)
          console.log(`  - pack_date: ${data.pack_date || 'N/A'}`)
          console.log(`  - territory: ${data.territory || 'N/A'}`)
          console.log(`  - created_at: ${data.created_at || 'N/A'}`)

          if (data.time_blocks) {
            console.log(`  - time_blocks: ${data.time_blocks.length} blocks`)
          }
          if (data.events) {
            console.log(`  - events: ${data.events.length} events`)
          }
          if (data.weather) {
            console.log(`  - weather: present`)
          }
        } catch (parseErr) {
          console.error('JSON parse error:', parseErr)
          console.log('Raw body (first 500 chars):', text.slice(0, 500))
        }
      }
    } else {
      const body = await res.text()
      console.error(`\n=== FAILED ===`)
      console.error(`Response body: ${body}`)
    }
  } catch (err) {
    console.error('\n=== NETWORK ERROR ===')
    console.error(err)
  }

  // Test 2: List bucket contents (if accessible)
  console.log('\n\n--- Testing bucket listing ---')
  const listUrl = `${SUPABASE_URL}/storage/v1/object/list/${bucket}`

  try {
    const listRes = await fetch(listUrl, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefix: 'daily/',
        limit: 10,
      }),
    })

    console.log(`List status: ${listRes.status}`)

    if (listRes.ok) {
      const items = await listRes.json()
      console.log(`\nFiles in daily/:`)
      if (Array.isArray(items)) {
        items.forEach((item: { name: string }) => {
          console.log(`  - ${item.name}`)
        })
      } else {
        console.log(items)
      }
    }
  } catch (err) {
    console.error('List error:', err)
  }
}

testStorageFetch()
