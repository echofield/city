# FLOW deploy guide

One place for health check, deploy hooks, and cron. Use this when Git-based deploys are blocked or you want to deploy on demand.

## 1. Health check (backend)

Before triggering cron, confirm the backend is up and Supabase is configured:

```bash
curl https://city-delta-red.vercel.app/api/health
```

You should see `ok: true` and `storageConfigured: true` if Supabase env vars are set. If `storageConfigured: false`, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel (backend project → Settings → Environment Variables).

## 2. Deploy hooks (bypass Git)

Trigger a new deployment without pushing. Replace with your current hook IDs if they change.

**Backend (city-delta-red):**
```powershell
Invoke-WebRequest -Uri "https://api.vercel.com/v1/integrations/deploy/prj_JrA0MPNQEKnZMYu0E2Do0gtp4ZvZ/hs7x02pFhk" -Method POST -UseBasicParsing
```

**Frontend (citycell):**
```powershell
Invoke-WebRequest -Uri "https://api.vercel.com/v1/integrations/deploy/prj_MraT182PB7WTwtyjgUkMw7TyqABb/yYE8lkRQGy" -Method POST -UseBasicParsing
```

Create new hooks in Vercel: Project → Settings → Git → Deploy Hooks.

## 3. Cron (compile tonight pack)

After backend is deployed, run once (or rely on Vercel Crons at 17:00, 20:00, 05:00 UTC). Use the **exact** value of `CRON_SECRET` from Vercel env.

```powershell
Invoke-WebRequest -Uri "https://city-delta-red.vercel.app/api/cron/compile-tonight" -Method POST -Headers @{ Authorization = "Bearer YOUR_CRON_SECRET" } -UseBasicParsing
```

- **200 + body**: Success. Check `storageOk` and `warnings` in the JSON (e.g. `skeleton_from_fallback`, `disk_write_skipped` are non-fatal).
- **401**: Wrong or missing `CRON_SECRET`.
- **500**: Unexpected error; check Vercel function logs and response body `details`.

The cron never fails for missing skeleton file (inline fallback) or read-only disk; it always tries to write to Supabase when configured.

## 4. Order of operations

1. Deploy backend (hook or Git).
2. Open `https://city-delta-red.vercel.app/api/health` → confirm `storageConfigured: true`.
3. Trigger cron (see above).
4. Deploy frontend (hook or Git).
5. Open citycell.vercel.app and hard-refresh (Ctrl+F5).
