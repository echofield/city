# Backend audit (city-flow)

Quick checklist of what’s in this repo and how it fits with Supabase.

## ✅ In place

| Area | Status | Notes |
|------|--------|--------|
| **API** | ✅ | `/api/health`, `/api/flow/state`, `/api/flow/brief`, `/api/city-signals/today`, `/api/checkout` |
| **Flow engine** | ✅ | orchestrate, compile-from-pack, flow-state-adapter, day-templates, mock |
| **City signals** | ✅ | `dateParis`, `normalize-pack`, **`loadCitySignals`** (added; was missing) |
| **Data path** | ✅ | Daily pack: `data/city-signals/YYYY-MM-DD.json` (create dir + files as needed) |
| **Stripe** | ✅ | POST `/api/checkout` — subscription, Stripe customer, session.url |
| **Supabase (app)** | ✅ | Auth + tables: profiles, subscriptions, plan_catalog, briefs, alerts, referral_* |

## Supabase: two ways to connect

1. **Next.js app (browser + server)**  
   Uses Supabase JS client with:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
   Tables are accessed via `supabase.from('profiles')` etc. By default that is the **public** schema.

2. **Direct Postgres (scripts, migrations, external tools)**  
   You created role `external_rw` and granted on schema **app**:
   - `grant usage on schema app to external_rw`
   - `grant select, insert, update, delete on all tables in schema app to external_rw`
   - Same for sequences and default privileges.

   Use a connection string like:
   ```text
   postgres://external_rw:YOUR_PASSWORD@db.XXXX.supabase.co:5432/postgres?sslmode=require
   ```
   Store it in **env only** (e.g. `DATABASE_URL` in `.env`), **never commit** the real password.

**Schema alignment (done):**  
Application tables live in **app**. All Supabase client calls now use `.schema('app').from(...)` in: middleware, dashboard, pay, onboarding, api/checkout.

(Previously: If your tables live in **public**: the current code is correct; `external_rw` is for extra access (e.g. from another service) — then grant on `public` for that role if needed.  
- If your tables live in **app**: either point the Supabase JS client at schema `app`, or keep using `public` and move/duplicate tables as you prefer.  
README here says “Schema: app”; TypeScript types use `Database['public']`. Worth confirming in Supabase which schema actually has the tables and aligning code/docs.

## Fixed in this audit

- **Missing module:** `src/lib/city-signals/loadCitySignals.ts` was imported by `/api/flow/state` and `/api/flow/brief` but the file did not exist. It has been added: reads `data/city-signals/YYYY-MM-DD.json`, uses today (Europe/Paris), with fallback to latest daily file.

## Flow-engine and shift-conductor (added)

The following modules were added so `npm run build` succeeds:

| Module | Role |
|--------|--------|
| `@/lib/flow-engine/types` | CompiledBrief, OrchestrateInput, MoveOutput |
| `@/lib/flow-engine/mock-data` | MOCK_COMPILED_BRIEF |
| `@/lib/flow-engine/compile-from-pack` | compiledFromCitySignalsPackV1(pack) → CompiledBrief |
| `@/lib/flow-engine/flow-state-adapter` | TERRITORY_IDS, compiledBriefAndMoveToFlowState(brief, move, sessionStart) → FlowState |
| `@/lib/shift-conductor/orchestrator` | orchestrate(input) → { move } |

The flow API now builds and runs; you can refine compile-from-pack and orchestrator logic (e.g. richer zones, phase, confidence) without changing the API contract.

## Optional next steps

- Ensure `data/city-signals/` exists at repo root (or in deployment) and has at least one `YYYY-MM-DD.json` for testing, or rely on mock when no pack is present.
- If you use direct Postgres with `external_rw`, add `DATABASE_URL` to `.env.example` (placeholder only, no real password).
