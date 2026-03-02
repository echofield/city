# Supabase: GRANTs and RLS (app schema)

Run these in the Supabase SQL editor (or any Postgres client as a superuser). Tables live in the **app** schema; RLS is enabled on application tables.

If RLS or policies already exist, drop or adjust conflicting policies before re-running. Policy names must be unique per table.

**Column names (this doc):** `app.profiles` and other user-owned tables use **user_id** = `auth.uid()`. `app.referrals` uses **referrer_user_id** (user who made the referral) and **referred_user_id** (user who was referred).

---

## 0) Indexes for RLS performance

Policies filter by these columns; add indexes if not already present so RLS checks stay fast:

```sql
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON app.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON app.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_briefs_user_id ON app.briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON app.alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_accounts_user_id ON app.referral_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id ON app.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON app.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_plan_catalog_is_active ON app.plan_catalog(is_active);
```

---

## 1) GRANTs recap

### external_rw (direct Postgres / scripts)

```sql
GRANT USAGE ON SCHEMA app TO external_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO external_rw;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA app TO external_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO external_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO external_rw;
```

Optional (if external_rw should create objects in app):

```sql
GRANT CREATE ON SCHEMA app TO external_rw;
```

### anon / authenticated (Supabase JS client)

GRANTs only allow the operation to be attempted; RLS still enforces row-level access.

```sql
GRANT USAGE ON SCHEMA app TO anon, authenticated;
```

Grant table-level privileges only if you are not relying purely on RLS (e.g. for read-only catalog). Keep minimal and let RLS enforce row access. Example for a public read-only table:

```sql
-- Optional: if plan_catalog is read-only and you allow anon/authenticated to list plans
GRANT SELECT ON app.plan_catalog TO anon, authenticated;
```

---

## 2) Baseline RLS policies (user-ownership)

Assumption: users may only read/write their own rows. `auth.uid()` is the Supabase Auth user id. Enable RLS and attach policies per table. For INSERT/UPDATE, **WITH CHECK** mirrors the ownership condition (same as USING) so users cannot insert or update rows for another user.

### app.profiles

- **user_id** = `auth.uid()`.

```sql
ALTER TABLE app.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON app.profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON app.profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON app.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### app.subscriptions

- **user_id** = `auth.uid()`.

```sql
ALTER TABLE app.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON app.subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own subscription"
  ON app.subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own subscription"
  ON app.subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### app.briefs

- **user_id** = `auth.uid()`.

```sql
ALTER TABLE app.briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own briefs"
  ON app.briefs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own briefs"
  ON app.briefs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own briefs"
  ON app.briefs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### app.alerts

- **user_id** = `auth.uid()`.

```sql
ALTER TABLE app.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own alerts"
  ON app.alerts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own alerts"
  ON app.alerts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own alerts"
  ON app.alerts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### app.plan_catalog (read-only)

- No user ownership; allow authenticated (and optionally anon) to read active plans. Add the anon policy if you want the pricing page public before login.

```sql
ALTER TABLE app.plan_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active plans"
  ON app.plan_catalog FOR SELECT
  TO authenticated
  USING (is_active = true);
```

To allow unauthenticated read (e.g. pay page before login):

```sql
CREATE POLICY "Anon can read active plans"
  ON app.plan_catalog FOR SELECT
  TO anon
  USING (is_active = true);
```

### app.referral_accounts

- **user_id** = `auth.uid()`.

```sql
ALTER TABLE app.referral_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referral account"
  ON app.referral_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own referral account"
  ON app.referral_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own referral account"
  ON app.referral_accounts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### app.referrals

- **referrer_user_id** = user who made the referral, **referred_user_id** = user who was referred. Read as referrer or as referred; insert/update only when referrer_user_id = auth.uid().

```sql
ALTER TABLE app.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read referrals they made"
  ON app.referrals FOR SELECT
  TO authenticated
  USING (referrer_user_id = auth.uid());

CREATE POLICY "Users can read referrals where they are referred"
  ON app.referrals FOR SELECT
  TO authenticated
  USING (referred_user_id = auth.uid());

CREATE POLICY "Users can insert referrals as referrer"
  ON app.referrals FOR INSERT
  TO authenticated
  WITH CHECK (referrer_user_id = auth.uid());

CREATE POLICY "Users can update own referrals (referrer)"
  ON app.referrals FOR UPDATE
  TO authenticated
  USING (referrer_user_id = auth.uid())
  WITH CHECK (referrer_user_id = auth.uid());
```

---

## 3) Backend-only tables (no client access)

For **app.brief_runs**, **app.source_items**, **app.webhook_events**: if only the backend (e.g. service_role or external_rw) should touch them, use RLS that denies anon/authenticated or allow only service_role:

```sql
-- Example: no policy for anon/authenticated => they get no rows
ALTER TABLE app.brief_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.source_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.webhook_events ENABLE ROW LEVEL SECURITY;

-- Option A: no SELECT/INSERT/UPDATE/DELETE for anon, authenticated (default when no policy allows)
-- Option B: add a policy that allows only service_role (bypasses RLS when using service key)
-- For service_role, RLS is typically bypassed by Supabase; no policy needed for backend-only tables.
```

---

## 4) Quick verification steps

After running GRANTs and policies:

**In SQL editor (with role / JWT context):**

- `SET LOCAL role TO authenticated; SELECT * FROM app.plan_catalog WHERE is_active = true LIMIT 1;` — should return rows if plans exist.
- With a real JWT in request context, `SELECT * FROM app.profiles WHERE id = auth.uid();` — in the editor without a request you typically get 0 rows; that’s expected. Rely on the app for identity.

**From the app (Next.js + Supabase client):**

- Read **app.plan_catalog** (e.g. pay page).
- Create/read a **profile** row (onboarding).
- Create/read a **subscription** row (after checkout).

If any operation returns 0 rows or “permission denied,” note the table and operation (SELECT/INSERT/UPDATE) and adjust the policy or GRANT (see Notes below).

---

## 5) Single executable block (optional, hardened)

Run this **after GRANTs (section 1)**. Safe to run repeatedly: wrapped in a transaction (rolls back on error), indexes use IF NOT EXISTS, and policy drops run inside a DO block so a missing or mistyped policy name does not abort the script. Column names: **profiles.user_id**; **subscriptions/briefs/alerts/referral_accounts.user_id**; **referrals.referrer_user_id** / **referred_user_id**; **plan_catalog** read-only by **is_active**. For large historical tables, consider partial indexes later; the full indexes below are fine for typical write volume.

**Paste into Supabase SQL editor and run:**

```sql
BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Indexes for RLS (full indexes; partials only if large historical data)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON app.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON app.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_briefs_user_id ON app.briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON app.alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_accounts_user_id ON app.referral_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id ON app.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON app.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_plan_catalog_is_active ON app.plan_catalog(is_active);

-- ---------------------------------------------------------------------------
-- 2) Re-affirm RLS is enabled (no-op if already enabled)
-- ---------------------------------------------------------------------------
ALTER TABLE app.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.plan_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.referral_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.referrals ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3) Drop existing policies safely (DO block: missing policy won't abort)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol text[];
  policies text[][] := ARRAY[
    ARRAY['Users can read own profile', 'profiles'],
    ARRAY['Users can insert own profile', 'profiles'],
    ARRAY['Users can update own profile', 'profiles'],
    ARRAY['Users can read own subscription', 'subscriptions'],
    ARRAY['Users can insert own subscription', 'subscriptions'],
    ARRAY['Users can update own subscription', 'subscriptions'],
    ARRAY['Users can read own briefs', 'briefs'],
    ARRAY['Users can insert own briefs', 'briefs'],
    ARRAY['Users can update own briefs', 'briefs'],
    ARRAY['Users can read own alerts', 'alerts'],
    ARRAY['Users can insert own alerts', 'alerts'],
    ARRAY['Users can update own alerts', 'alerts'],
    ARRAY['Anyone can read active plans', 'plan_catalog'],
    ARRAY['Anon can read active plans', 'plan_catalog'],
    ARRAY['Users can read own referral account', 'referral_accounts'],
    ARRAY['Users can insert own referral account', 'referral_accounts'],
    ARRAY['Users can update own referral account', 'referral_accounts'],
    ARRAY['Users can read referrals they made', 'referrals'],
    ARRAY['Users can read referrals where they are referred', 'referrals'],
    ARRAY['Users can insert referrals as referrer', 'referrals'],
    ARRAY['Users can update own referrals (referrer)', 'referrals']
  ];
BEGIN
  FOREACH pol SLICE 1 IN ARRAY policies
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON app.%I', pol[1], pol[2]);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped drop policy % on app.%: %', pol[1], pol[2], SQLERRM;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Create policies (intent + scope in comments)
-- ---------------------------------------------------------------------------

-- app.profiles: user_id = auth.uid() (read/write, TO authenticated)
CREATE POLICY "Users can read own profile" ON app.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON app.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON app.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- app.subscriptions: user_id = auth.uid() (read/write, TO authenticated)
CREATE POLICY "Users can read own subscription" ON app.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own subscription" ON app.subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own subscription" ON app.subscriptions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- app.briefs: user_id = auth.uid() (read/write, TO authenticated)
CREATE POLICY "Users can read own briefs" ON app.briefs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own briefs" ON app.briefs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own briefs" ON app.briefs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- app.alerts: user_id = auth.uid() (read/write, TO authenticated)
CREATE POLICY "Users can read own alerts" ON app.alerts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own alerts" ON app.alerts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own alerts" ON app.alerts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- app.referral_accounts: user_id = auth.uid() (read/write, TO authenticated)
CREATE POLICY "Users can read own referral account" ON app.referral_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own referral account" ON app.referral_accounts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own referral account" ON app.referral_accounts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- app.plan_catalog: read-only (SELECT, is_active = true). authenticated + optional anon for public pricing.
CREATE POLICY "Anyone can read active plans" ON app.plan_catalog FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Anon can read active plans" ON app.plan_catalog FOR SELECT TO anon USING (is_active = true);
-- If pricing page is auth-only, comment out the "Anon can read active plans" line above.

-- app.referrals: referrer_user_id / referred_user_id (read: as referrer or referred; insert/update only as referrer, TO authenticated)
CREATE POLICY "Users can read referrals they made" ON app.referrals FOR SELECT TO authenticated USING (referrer_user_id = auth.uid());
CREATE POLICY "Users can read referrals where they are referred" ON app.referrals FOR SELECT TO authenticated USING (referred_user_id = auth.uid());
CREATE POLICY "Users can insert referrals as referrer" ON app.referrals FOR INSERT TO authenticated WITH CHECK (referrer_user_id = auth.uid());
CREATE POLICY "Users can update own referrals (referrer)" ON app.referrals FOR UPDATE TO authenticated USING (referrer_user_id = auth.uid()) WITH CHECK (referrer_user_id = auth.uid());

COMMIT;
```

---

## 6) Notes

- **GRANTs** do not bypass RLS for anon/authenticated; they only allow the operation to be attempted. Ensure policies exist and match your intended access.
- **WITH CHECK** on INSERT/UPDATE mirrors the ownership condition so users cannot write rows for another user.
- If a route returns 0 rows unexpectedly, check for a missing or overly strict policy on the table and operation (SELECT/INSERT/UPDATE/DELETE).
- For API visibility: if you use PostgREST directly, expose the **app** schema in Supabase Dashboard → API settings. For supabase-js with `.schema('app')`, no extra setting is required beyond USAGE/table GRANTs and RLS as above.
- **Backend-only tables** (brief_runs, source_items, webhook_events): RLS enabled with no anon/authenticated policies; only service_role or external_rw can access. Add narrow policies later if app code needs a subset.
- **Build reminder:** `npm run build` still requires the flow-engine and shift-conductor libs; see `BACKEND_AUDIT.md`.
- **Indexes:** Full indexes on ownership columns are used; for very large historical data you can add partial indexes (e.g. `WHERE is_active = true`) later if needed.

---

## 7) Verification and optional tweaks

**Quick verification (from the app with a logged-in user):**

- **profiles / subscriptions / briefs / alerts / referral_accounts:** Only rows for the current user; you can insert/update your own rows but not others’.
- **referrals:** You can read rows where you’re `referrer_user_id` or `referred_user_id`; you can insert/update only when `referrer_user_id` = your user id.
- **plan_catalog:** Pricing page loads without auth if the anon policy is present; with auth, authenticated can read active plans.

**Lock pricing to signed-in users only:** Remove the anon policy so only authenticated users can read `plan_catalog`:

```sql
DROP POLICY IF EXISTS "Anon can read active plans" ON app.plan_catalog;
```

**Need more?** For a tailored revert, admin overrides, soft-deletes, or org/tenant policies, define the rules and we can generate the exact SQL.
