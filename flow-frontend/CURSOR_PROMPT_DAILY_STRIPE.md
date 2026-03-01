# Cursor prompt: Daily CitySignals + Stripe Checkout

**Use in city-flow workspace first** (sections A + B), then **in FLOW FRONTEND workspace** run section C only (frontend patch).

---

You are implementing: (1) Daily CitySignals ingestion (manual default, Gemini optional later) + Month Guardian injection, all CANONICAL in city-flow; (2) Stripe Checkout Session endpoint in city-flow; (3) Frontend Activate page POST→redirect + /demo?paid=1 label.

Non-negotiables:
- Canonical data lives in city-flow: write daily packs to city-flow/data/city-signals/YYYY-MM-DD.json
- Clock must resolve "today" in Europe/Paris
- Never overwrite an existing daily file if validation fails
- Month Guardian is READ-ONLY context, never "truth"
- Facts only, no scoring in daily pack
- Stripe secret key stays server-side in city-flow

============================================================
A) CITY-FLOW — DAILY CITYSIGNALS (manual default)
============================================================

1) Add types: Daily pack
Create: src/types/city-signals-daily-pack.ts
Export:
- type CitySignalsDailyPack
- type CitySignalsDailyEvent, CitySignalsDailyTransport, CitySignalsDailyWeather, CitySignalsDailySocial
Shape EXACTLY:
{
  date: string; // YYYY-MM-DD
  generatedAt: string; // ISO datetime
  events: Array<{
    name: string;
    venue: string;
    zoneImpact: string[];
    startTime: string | null; // "HH:MM" or null
    endTime: string | null;
    expectedAttendance: number | null;
    type: "concert" | "sport" | "expo" | "festival" | "cluster" | "marathon" | "other";
    notes?: string;
  }>;
  transport: Array<{
    line: string;
    type: "closure" | "incident" | "strike";
    impactZones: string[];
    startTime: string | null;
    endTime: string | null;
    notes?: string;
  }>;
  weather: Array<{
    type: "rain_start" | "heavy_rain" | "cold_spike" | "wind_strong" | "heat_spike";
    expectedAt: string | null; // "HH:MM" or null
    impactLevel: 1 | 2 | 3;
    notes?: string;
  }>;
  social: Array<{
    type: "demonstration" | "rally" | "strike_action" | "other";
    title: string;
    zoneImpact: string[];
    startTime: string | null;
    endTime: string | null;
    notes?: string;
  }>;
}

2) Add validator
Create: scripts/validate-city-signals-daily-pack.ts
Export function validateCitySignalsDailyPack(raw: unknown): { ok: true; pack: CitySignalsDailyPack } | { ok: false; errors: string[] }
Rules:
- date must match /^\d{4}-\d{2}-\d{2}$/
- generatedAt must be parseable ISO date
- events/transport/weather/social must be arrays (allow empty arrays)
- For each item validate required fields and types
- For impactLevel only 1|2|3

3) Ensure Month Guardian loader exists in city-flow
If missing, implement:
- src/types/month-guardian-pack.ts (align with existing month-guardian JSON)
- src/lib/city-signals/loadMonthGuardian.ts that reads: data/city-signals/monthly/${month}.paris-idf.json
- If missing month file, fallback to latest *.paris-idf.json; else null
- Month resolution default: current month in Europe/Paris

NOTE: Month guardian sample file already exists at:
data/city-signals/monthly/2026-03.paris-idf.json
Keep it committed (do NOT add to gitignore).

4) Prompt template (daily)
Create or update: scripts/prompts/city-signals-daily-v1.md
Template must include:
- DATE: {{date}}
- SCOPE: Paris + Île-de-France (CDG/Orly, Saint-Denis, La Défense, Villepinte, Versailles)
- MonthGuardianPack injected in a code block: {{monthGuardianJson}}
- Strict instruction: OUTPUT JSON ONLY matching CitySignalsDailyPack schema
- Facts only, include only items active today
- If time unknown => null
- zoneImpact must be short operational corridors/hubs/arrondissements

5) "Today Paris" util
Create: scripts/utils/dateParis.ts exporting:
- getTodayParis(): string // YYYY-MM-DD in Europe/Paris
- getMonthFromDate(date: string): string // YYYY-MM
Implementation must use Intl.DateTimeFormat with timeZone:"Europe/Paris"

6) Run script (manual default, gemini optional later)
Create: scripts/run-city-signals.ts
CLI:
- --date YYYY-MM-DD (optional)
- --manual (default true)
- --gemini (optional, stub or not implemented)
- --input path (optional; default data/city-signals/.input.json)
Behavior:
- Resolve date = provided or getTodayParis()
- Resolve month = getMonthFromDate(date)
- Load month guardian with loadMonthGuardian(month)
- Determine output path: data/city-signals/YYYY-MM-DD.json (ensure dir exists)
- Read pack:
  - manual: read JSON from input file; if missing => exit non-zero with helpful error
  - gemini: optional; if you implement, call Gemini REST using GEMINI_API_KEY and filled prompt (but if unsure, leave as TODO and return error)
- Validate with validateCitySignalsDailyPack
- If invalid: print errors, EXIT non-zero, DO NOT overwrite existing file
- If valid:
  - Force pack.generatedAt = new Date().toISOString()
  - Write JSON pretty (2 spaces)
  - Log "Written <path>"
Add npm scripts in city-flow/package.json:
- "city-signals": "tsx scripts/run-city-signals.ts"
- "city-signals:manual": "tsx scripts/run-city-signals.ts --manual"
- optional: "city-signals:gemini": "tsx scripts/run-city-signals.ts --gemini"
Ensure tsx is in devDependencies if needed.

7) Make city-flow API use the daily file if present
In city-flow:
- src/lib/city-signals/loadCitySignals.ts (daily loader):
  - loadCitySignals(date?: string): CitySignalsDailyPack | null
  - read data/city-signals/YYYY-MM-DD.json; if missing, fallback to latest YYYY-MM-DD.json; else null
- src/lib/flow-engine/compile-from-pack.ts:
  - ensure compiledFromCitySignalsPackV1 or similar maps DAILY pack to CompiledBrief
  - Weather/transport/social should become alerts + micro_alerts
- Update:
  - src/app/api/flow/state/route.ts
  - src/app/api/flow/brief/route.ts
Logic:
  pack = loadCitySignals()
  brief = pack ? compiledFromCitySignalsPack(pack) : MOCK_COMPILED_BRIEF

============================================================
B) CITY-FLOW — STRIPE CHECKOUT (subscription)
============================================================

1) Add env keys to city-flow .env.example:
- STRIPE_SECRET_KEY=
- STRIPE_PRICE_ID= (monthly subscription price id)
- APP_ORIGIN=http://localhost:5173 (or your prod origin)

2) Add dependency: stripe

3) Implement route:
Create: src/app/api/billing/checkout/route.ts
POST only.
Body JSON: { ref?: string | null }
Behavior:
- Create Stripe Checkout Session:
  - mode: "subscription"
  - line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }]
  - success_url: `${APP_ORIGIN}/demo?paid=1`
  - cancel_url: `${APP_ORIGIN}/activate?canceled=1`
  - metadata: { ref } if provided
Return: { url: session.url }
Errors: return 500 JSON message if missing env or stripe fails.

============================================================
C) FLOW FRONTEND — ACTIVATE POST→REDIRECT + paid label
============================================================

1) In Activate.tsx:
- Replace direct Payment Link redirect with:
  - read ref = localStorage.getItem("flow_ref")
  - POST to /api/billing/checkout (use relative /api; rely on Vite proxy)
  - body: { ref: ref || null }
  - on success: window.location.href = data.url
  - show loading state "Redirection…" and disable button

2) In DemoPage or Dashboard wrapper:
- If URL has ?paid=1, show a subtle label "Accès activé" (top-right near MODE APERÇU or small in header)

============================================================
D) Definition of Done (quick manual test)
============================================================

1) Create data/city-signals/.input.json in city-flow with a valid daily pack for today.
2) Run: npm run city-signals:manual
=> writes data/city-signals/YYYY-MM-DD.json
3) Start city-flow dev server; hit /api/flow/state => uses pack (signals should reflect it)
4) Click "Activer Flow" => POST /api/billing/checkout returns url => redirects to Stripe
5) After success, you land on /demo?paid=1 and see "Accès activé".

Do not change FlowState contract or UI beyond what's required above.
