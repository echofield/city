# LIVE mode — Supabase wiring

## loadCitySignalsAsync (LIVE)

Used by **GET /api/flow/state** when Supabase is configured.

1. **Cache:** 45s TTL in-memory. Repeated calls within 45s return cached pack.
2. **Supabase (when `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` is set):**
   - Uses **anon client only** (never service role). RLS applies — demo-today / paywall gating works.
   - Call **RPC** `current_date_for_territory(territory_id)` with default `territory_id = 'paris-idf'`.
   - **Select** from **public.city_signal_daily**: `payload, generated_at, schema_version, source, is_demo, current_version` where `territory_id = ?` and `date = ?`.
   - Pack is taken from **row.payload** (jsonb).
3. **Fallback:** If Supabase is not configured, or RPC/select fails or returns nothing, falls back to **local file**: `data/city-signals/YYYY-MM-DD.json` (and latest file if that date is missing).

## Env

- Prefer `SUPABASE_URL` and `SUPABASE_ANON_KEY` for server-only code; `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are supported as fallback.
- LIVE reads use anon key only (RLS applies).
- `SUPABASE_SERVICE_ROLE_KEY` — **not** used for loadCitySignals; only for admin/writes (ingest, webhook). Using it for reads would bypass RLS and break paywall.

## Required in Supabase

- **RPC:** `current_date_for_territory(territory_id text)` returning the current date for that territory.
- **Table:** **public.city_signal_daily** with at least:
  - `territory_id`, `date`
  - **payload** (jsonb) — the daily pack (CitySignalsPackV1 shape).
  - Optional: `generated_at`, `schema_version`, `source`, `is_demo`, `current_version`.

## Frontend LIVE

- **Dashboard** with `demoMode === false` and no `simulationMode` calls **fetchFlowState** → GET `/api/flow/state` (LIVE).
- Simulation and demo use **fetchFlowStateSimulation** and **fetchFlowStateMock** respectively; they do not use the LIVE Supabase-backed path.
