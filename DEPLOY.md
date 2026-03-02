# Deploy (city-backend)

Two Vercel projects: this repo = backend; frontend = separate repo.

## Vercel env (after push to GitHub)

- **LIVE reads use anon only** (RLS/paywall applies). Do not use service role for `loadCitySignalsAsync`.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or prefer `SUPABASE_URL` / `SUPABASE_ANON_KEY` for server-only naming).
- Optional: `SUPABASE_SERVICE_ROLE_KEY` only for server-side writes (ingest/webhook); **not** for LIVE reads.
- **Set `ALLOWED_ORIGINS`** to your frontend prod URL (e.g. `https://your-frontend.vercel.app`). Do not leave `*` in production (avoids surprise issues when using cookies later).
- Optional: `NEXT_PUBLIC_APP_URL` for redirects.

## Local test before deploy

1. `npm run dev` (port 3000).
2. With frontend on 5173, open `http://localhost:5173/flow` and confirm LIVE uses Supabase (edit `public.city_signal_daily.payload`, wait 45s, refresh).
3. Run simulation flow; confirm `POST /api/flow/simulation-state` and 10-min overlay.

## If LIVE falls back to file in prod

- Verify Vercel env has Supabase URL + anon key (and no typo).
- Check backend logs for RPC/select errors.
