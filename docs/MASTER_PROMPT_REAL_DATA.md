# Master prompt: Why is the app showing mock / thin data instead of real ramifications?

## Context

- **Backend:** Next.js at `city-rho-six.vercel.app` (or city-delta-red). Env vars are set: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CRON_SECRET`, `OPENAGENDA_API_KEY`, `OPENWEATHERMAP_API_KEY`, `PRIM_API_KEY`.
- **Frontend:** Vite app at citycell (or similar). Has `VITE_FLOW_API_URL` pointing at the backend.
- **Observed:** The dashboard shows mock-like or very thin data (single zone, no real peaks, no real ramifications) even though we configured the right keys. We want **real data** and **real ramifications** (tonight pack from OpenAgenda + skeleton + transport + weather → multiple zones, peaks with reasons).

---

## Question for Claude

**Why is the app still showing mock or thin data despite correct keys?** Trace the full pipeline and identify the exact point where real data is lost or replaced by empty/fallback/simulated state. Then propose or apply the minimal fix so the UI shows real ramifications (multiple zones, peaks with reasons, intensity from real signals).

---

## Data pipeline (reference)

1. **Cron** `POST /api/cron/compile-tonight` (with `Authorization: Bearer <CRON_SECRET>`)
   - Fetches: OpenAgenda (events), OpenWeatherMap, PRIM (transport).
   - Loads skeleton from `data/city-signals/weekly/skeleton.json` or uses inline fallback.
   - Builds `TonightPack` (signals + ramifications + weeklySkeleton).
   - Writes to **Supabase Storage**: bucket `flow-packs`, path `tonight/{YYYY-MM-DD}.paris-idf.json`.
   - Files: `src/app/api/cron/compile-tonight/route.ts`, `src/lib/signal-fetchers/ramification-engine.ts`.

2. **API** `GET /api/flow/state`
   - Calls `loadCitySignals()` which tries **Supabase first**: `flow-packs/tonight/{tonightDate}.paris-idf.json`. If not found, tries daily pack, then events compilation.
   - If **no pack** is found: uses `createEmptyBrief()` → empty zones, empty hotspots, empty timeline → API still returns 200 but with thin/degraded state.
   - If **pack exists**: `tonightPackToCitySignalsPack` → `compiledFromCitySignalsPackV1` → `orchestrate` → `compiledBriefAndMoveToFlowState` → real peaks, upcoming, ramifications.
   - Files: `src/app/api/flow/state/route.ts`, `src/lib/city-signals/loadCitySignals.ts`, `src/lib/city-signals/tonightPackAdapter.ts`, `src/lib/flow-engine/compile-from-pack.ts`.

3. **Frontend** (Dashboard)
   - Calls `fetchFlowState()` → `GET {VITE_FLOW_API_URL}/api/flow/state`. If the request **fails** (network, CORS, 500), it catches and uses `computeFlowState()` (simulated mock).
   - If the request **succeeds**, it displays whatever the API returned (so if the API returned empty brief, the UI shows thin data; if the API returned real pack, the UI shows real data).
   - File: `flow-frontend/src/app/components/Dashboard.tsx`, `flow-frontend/src/app/api/flow.ts`.

---

## What to verify

1. **Supabase Storage**
   - Does the bucket **`flow-packs`** exist in the Supabase project?
   - After running the cron, does the object **`tonight/{YYYY-MM-DD}.paris-idf.json`** exist (today’s date in Paris time)?

2. **Cron**
   - Was the cron triggered **after** the backend had `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set?
   - Does the cron response show **`storageOk: true`** and no `storage_write_failed` in `warnings`? If it shows `storage_not_configured` or `storage_write_failed`, the tonight pack was never written.

3. **API**
   - `GET /api/health`: does it return **`storageConfigured: true`**?
   - `GET /api/flow/state`: open the JSON response. Does it contain non-empty `peaks`, `upcoming`, and multiple zones, or empty arrays and a single fallback zone? Check backend logs for `[loadCitySignals] Source: Tonight pack v1.5` (real) vs Storage fetch error / no log (no pack).

4. **Frontend**
   - Is **`VITE_FLOW_API_URL`** set to the backend URL (e.g. `https://city-rho-six.vercel.app`) so the app calls the backend and not same-origin (which would 404)?
   - In the browser Network tab, is **`/api/flow/state`** requested to the backend URL and returning 200? If the request fails, the frontend falls back to **simulated** `computeFlowState()` (mock).

---

## Likely root causes

- **No tonight pack in Storage:** Cron was never run successfully after Supabase was configured, or the bucket doesn’t exist / is misnamed. Then `loadCitySignals` returns `null` → API uses `createEmptyBrief()` → thin data.
- **Frontend fallback:** API URL wrong or CORS/network failure → frontend uses `computeFlowState()` → mock data.
- **Wrong date:** `getTonightParis()` uses Paris time; if the cron wrote for one date and the API is asking for another (e.g. timezone edge), the object path might not match.

---

## Requested output

1. **Diagnosis:** Which of the above is true (no pack in Storage / frontend fallback / other)? Cite the exact place in the code or the exact log/response that shows it.
2. **Fix:** Minimal steps (e.g. create bucket, run cron, fix env or CORS) so that the next load shows real data and real ramifications. Prefer changing config or running the cron; only change code if necessary.
3. **Push:** If you change code, commit and push so the user can deploy.
