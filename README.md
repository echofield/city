# Flow — Intelligence Chauffeur

Portail d'intelligence terrain pour chauffeurs VTC. Interface minimaliste inspirée de l'esthétique OPÉRA Console.

## Repo layout (front / back)

| Path | Role |
|------|------|
| **/** (root) | **Backend** — Next.js (city-flow). API: `/api/flow/state`, `/api/billing/checkout`. Data: `data/city-signals/`. |
| **/flow-frontend** | **Frontend** — Vite + React. Landing, demo, activate, dashboard. Proxy `/api` to backend in dev. |

- **Backend:** `npm install && npm run dev` (port 3000).
- **Frontend:** `cd flow-frontend && npm install && npm run dev` (port 5173). Set `VITE_FLOW_API_URL` or use Vite proxy to backend.
- Deploy: backend and frontend can be two Vercel projects (root + `flow-frontend`).

## Stack

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (Auth + PostgreSQL)
- **Stripe** (Paiements)
- **Framer Motion** (Animations)

## Routes

| Route | Description |
|-------|-------------|
| `/login` | Connexion (magic link ou mot de passe) |
| `/onboarding` | Configuration du profil chauffeur |
| `/pay` | Choix du plan et checkout Stripe |
| `/dashboard` | Console principale avec briefings et alertes |

## Gating Logic

```
Boot → Auth Check
├── No session → /login
├── Session but no profile/onboarding incomplete → /onboarding
├── Onboarding done but no active subscription → /pay
└── Active subscription → /dashboard
```

## Database Schema (Supabase)

Schema: `app`

### Tables utilisées (RLS strict):
- `profiles` — Profil et préférences chauffeur
- `subscriptions` — Abonnements Stripe
- `plan_catalog` — Catalogue des plans (lecture seule)
- `briefs` — Briefings quotidiens générés
- `alerts` — Alertes terrain actives
- `referral_accounts` — Comptes parrainage
- `referrals` — Suivi des parrainages

### Tables backend (non accessibles côté client):
- `source_items`
- `brief_runs`
- `webhook_events`

## Configuration

Copiez `.env.example` vers `.env.local` et remplissez:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Développement

```bash
npm install
npm run dev
```

## Design System

Inspiré de OPÉRA Meridien:

- **Base**: Near-black charcoal (#070A0B → #0B0F10)
- **Signal Green**: #00B14F (CTA, succès)
- **Intent Gold**: #C9A24A (métriques, statuts)
- **Text**: Off-white (#E7ECEB) + muted gray (#9AA4A1)

### Principes:
- Terminal-like presence
- Panels as soft layers emerging from darkness
- Information as state, not content
- Breathing space, minimal density
- Slow, intentional motion

## Structure

```
src/
├── app/
│   ├── login/
│   ├── onboarding/
│   ├── pay/
│   ├── dashboard/
│   ├── auth/callback/
│   └── api/checkout/
├── components/ui/
│   ├── button.tsx
│   ├── input.tsx
│   ├── panel.tsx
│   ├── select.tsx
│   ├── skeleton.tsx
│   ├── status-bar.tsx
│   └── tabs.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── design/tokens.ts
│   └── utils.ts
├── types/
│   └── database.ts
└── middleware.ts
```

## Webhook Stripe

Configurez le webhook Stripe pour écouter `checkout.session.completed` et `customer.subscription.updated` pour mettre à jour `app.subscriptions`.

---

Flow is a pragmatic operational extension of OPÉRA, not a separate visual product.
