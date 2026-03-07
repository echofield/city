FLOW v1.6 — Architect Mega Prompt (No Drift, Real Data, Obvious Decisions)

Context
- FLOW is a Paris VTC driver intelligence instrument (Next.js + TS + Supabase + Vercel).
- v1.5 infra exists: real fetchers (OpenAgenda, OpenWeatherMap, PRIM), TonightPack compiler, skeleton patterns, manual override, ramification engine.
- UI exists but must become a DRIVER DECISION TOOL (not an information dashboard).
- Rule: ZERO fake data. If uncertain → degrade. If unknown → say so. If stale → flag.

Objective (v1.6)
Make the system “obvious and factual”:
- READ MODE (glance) is default and usable while driving: <1 second comprehension.
- RADAR MODE (parked) shows map + opportunities + explain cards.
- Every UI element must trace to real sources (TonightPack signals / ramifications / weekly skeleton / manual override).
- Language must feel “chauffeur Paris”, not governmental/military. Remove heavy analytic words from UI.

NON-NEGOTIABLE UI LANGUAGE
Ban these words from UI: signal, ramification, saturation, dispersion, friction, champ, optimisation, algorithme, prediction, analyse.
Allowed phase bar: “Calme — Monte — Plein — Sortie”
Allowed action verbs: “Maintenir / Rejoindre / Anticiper / Contourner / Tenter”
Replace “Why/Raison” label: no label. Just show the concrete trigger line.

Core Concept: Opportunities (Decision Objects)
Drivers should see “opportunities”, not raw signals.

Implement a single driver-facing object produced server-side:

type DriverOpportunity = {
  id: string
  kind: "confirme" | "piste"            // confirmed vs bet
  action: "maintenir"|"rejoindre"|"anticiper"|"contourner"|"tenter"
  placeId: string                      // zone/venue key
  placeLabel: string                   // “Châtelet”, “Gare du Nord”, “Pantin”
  corridor?: "nord"|"est"|"sud"|"ouest"
  window: { start: string; end: string }  // ISO
  timerLabel: string                   // e.g. “Fenêtre ferme dans”
  why: string                          // 1 line, concrete, observable (e.g. “Sortie théâtre Châtelet · ~900”)
  distanceMinutes?: number             // from driver anchor
  crowd?: { value?: number; band?: "S"|"M"|"L" }  // honest magnitude
  rideProfile?: "courtes"|"longues"|"mixte"
  confidence: number                   // 0..1
  evidence: Array<{ source: "event"|"transport"|"weather"|"skeleton"|"manual"; ref: string }>
  freshness: { compiledAt: string; stale: boolean }
}

Server must generate:
- bestNow: DriverOpportunity | null
- alternatives: DriverOpportunity[] (top 3 near anchor)
- farOpportunity?: DriverOpportunity (optional long-ride)
- upcoming: DriverOpportunity[] (next 4)
- tonightPeaks: DriverOpportunity[] (top 6; includes skeleton as “structural”)

DATA → OPPORTUNITY TRANSLATION (the key missing layer)
1) Venue Registry MUST be upgraded
Use existing: data/venues/paris-idf-venues.json
Extend each venue with:
- type: "theatre"|"concert"|"club"|"station"|"airport"|"bar_area"|"stadium"|"office"
- capacity?: number
- crowdBand?: "S"|"M"|"L" (if no capacity)
- endTimeRule?: { typicalEndLocal?: "22:15"|"23:00"|"05:00"; exitOffsetMinutes?: { before: number; after: number } }

2) Exit window MUST always exist
For each event signal:
- If endTime exists → exitWindow = endTime -15min to endTime +30min (default; venue rules may override)
- If endTime missing → infer by venue.type and endTimeRule
  theatre: typical end ~22:15
  concert: typical end ~23:00
  club: closing ~05:00
  stadium/match: end +15 to +45
If cannot infer, mark as piste (not confirmé) and reduce confidence.

3) Magnitude MUST be honest
- If capacity exists: crowd.value = floor(capacity * 0.6) (conservative)
- Else use crowd.band from venue: S/M/L
UI shows:
- “~900” if value exists
- Else “S / M / L”
Never invent attendance numbers.

4) Transport “Derniers métros” must be factual or removed
If you cannot compute last train/metro countdown from a real schedule feed, DO NOT show countdown (“dans 45min”).
Instead show a degraded/neutral line:
- “Métro réduit (nuit)” + last update time
Transport disruptions from PRIM can be confirmed.

Anchor Model (replace arrondissement selection)
Drivers should not pick many arrondissements.
Implement “driver anchor” as starting point:
- allow quick pick list: (Gare du Nord, Gare de Lyon, Châtelet, Bastille, Opéra, Montparnasse, La Défense, CDG, Orly, Pantin, Saint-Denis, Montreuil)
- store anchor in client state + optionally localStorage
DistanceMinutes = estimate based on zone coordinates (use venue registry lat/lng or simplified corridor distance map).
No GPS required for v1.6.

Two UI Modes (must be completed)
A) READ MODE (default)
Shows ONLY:
- Timer (with label) e.g. “Fenêtre ferme dans 18 min”
- Big action verb (Maintenir/Rejoindre/…)
- Place label
- One-line why (no “why” label)
- Small confidence indicator (e.g. “Confiance 0.72” or icon-based; keep minimal)
- One CTA button: “Ouvrir radar”
NO list, NO map, NO scrolling.

B) RADAR MODE (parked)
Shows:
- Map heat (ONLY real heat; zones with no signal = 0/dormant)
- Opportunities list: bestNow, alternatives, upcoming, peaks
- Tap-to-reveal explain card with 3 layers:
  Layer 1: why + window + confidence
  Layer 2: cause breakdown (event/weather/transport/skeleton)
  Layer 3: corridor flow + effect zones (optional)
Make RADAR open as full-screen sheet on mobile, modal/panel on desktop.
Switching modes must not refetch repeatedly; cache FlowState.

Zone Heat (remove noise)
Replace any hash/random heat with:
- base heat from active skeleton windows
- add heat from active confirmed opportunities (pressure zones/effect zones)
- add proximity boost near driver anchor (optional subtle)
Normalize 0..1. If no signals, heat=0.
Banlieue magnets (always visible):
- Montreuil (Est)
- Saint-Denis (Nord)
- Créteil (Sud-Est)
- Nanterre / La Défense (Ouest)
Display as subtle green dots.

Freshness & Degraded States
- If TonightPack compiledAt > 6h ago → mark stale; degrade confidence globally; show “Dernière MAJ: HH:mm”
- If API fails → fallback to last good pack; mark degraded; never show stale as “normal”.
- When no strong opportunity: show “Calme” + “Prochain point: [time from skeleton]”
Never blank screens.

WhatsApp (Twilio) — required v1.6 distribution rail
- Numeric opt-in is already implemented; finalize integration:
  - only send to opted_in users
  - max 3 alerts per driver per night
  - dedupeKey per opportunity window prevents repeats
  - send only when opportunity.kind="confirme" AND confidence >= 0.65 AND NOT stale
Message templates (French, short):
1) ACTION_NOW:
  “🔥 FLOW
   REJOINDRE → {{place}}
   Fenêtre: {{minutes}} min
   {{why}}
   Confiance: {{conf}}”
2) ACTION_SOON:
  “⏳ FLOW
   {{place}} dans {{minutes}} min
   {{why}}
   Confiance: {{conf}}”
3) CALME:
  “FLOW
   Calme.
   Prochaine fenêtre: {{time}}”
Do not use “signal/ramification” terms in WhatsApp either.

Endpoints / Contracts (single source of truth)
- /api/flow/state must return a typed FlowState that includes:
  - meta: { compiledAt, stale, overallConfidence, source }
  - opportunities: { bestNow, alternatives[3], upcoming[4], tonightPeaks[6], farOpportunity? }
  - map: { zoneHeat, magnets }
  - copy: { phaseLabel, timerLabel }
Client should render from this only.

Implementation Tasks (in strict order)
1) Create/Update server-side builder: buildOpportunitiesFromTonightPack(tonightPack, now, anchor)
2) Upgrade venue registry (type + capacity/band + end rules + lat/lng if possible)
3) Implement exit window inference + honest magnitude
4) Remove/disable any remaining simulated countdowns (e.g. “Derniers métros dans 45min” unless sourced)
5) Implement freshness/stale guard in loader
6) Implement READ/RADAR dual-mode integration:
   - default READ on mobile
   - one tap opens RADAR sheet
   - cached state
7) Replace map heat with real heat; add banlieue magnets
8) Connect WhatsApp outbound alerts to confirmed opportunities
9) Remove all leftover simulation artifacts and words from UI

Acceptance Tests (must be demonstrated)
A) Data truth
- Every displayed “why” line references evidence sources.
- No random heat (zones with no signal are dark).
- No fake countdowns.

B) Driver decision quality
- READ screen shows: action/place/why/timer label.
- Clicking opens RADAR with explain card.

C) Realism
- If pack stale → UI shows last update and degraded confidence.
- If no signals → shows “Calme” + next skeleton window time.

D) Night boundary
- Between 00:00–06:00, load the correct “tonight” pack (yesterday evening if needed).
- Mode does not reset at midnight.

E) WhatsApp
- Opted-in driver receives one ACTION_NOW message when a confirmed opportunity becomes active.
- Max alerts/night enforced + dedupe.

Deliverables
- Code changes on main
- Short README section: v1.6 “FlowState contract” + vocabulary rules (banned words list)
- Screens verified: mobile READ, mobile RADAR, desktop RADAR

Now implement without adding new features. v1.6 is about making the existing real-data system feel obvious, factual, and trustworthy.