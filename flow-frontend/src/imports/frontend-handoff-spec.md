
● Frontend Handoff Spec — CURSOR

  ---
  1. API Contract Updates

  GET /api/flow/state?lat={lat}&lng={lng}

  interface FlowState {
    // ... existing fields ...

    // NEW — Primary Action (structured)
    primaryAction?: {
      zone: string
      arrondissement: string
      distance_km: number
      eta_min: number
      entry_side: string           // "côté Nation"
      optimal_window: string       // "22:35–23:10"
      opportunity_score: number    // 0-100
      friction_risk: number        // 0-100
      reposition_cost: number      // 0-100, lower = better
      saturation_risk_delta: number // positive = good
      reason: string
    }

    // NEW — Driver Context
    driverContext?: {
      corridor: "nord" | "est" | "sud" | "ouest" | "centre"
      same_corridor: boolean
      corridor_hint?: string       // "Tu es dans le corridor EST..."
    }

    // NEW — Active Frictions
    activeFrictions?: {
      type: "transit" | "weather" | "saturation" | "event"
      label: string
      implication: string
      corridor?: string
    }[]

    // NEW — Alternatives
    alternativeActions?: {
      zone: string
      distance_km: number
      eta_min: number
      condition: string            // "si saturation Bercy"
    }[]

    // ENRICHED — with distances
    upcoming: {
      time: string
      zone: string
      saturation: number
      earnings: number
      distance_km?: number         // NEW
      eta_min?: number             // NEW
    }[]

    peaks: {
      time: string
      zone: string
      reason: string
      score: number
      distance_km?: number         // NEW
      eta_min?: number             // NEW
    }[]

    driverPosition?: { lat: number; lng: number }
  }

  GET /api/flow/dispatch (NEW ENDPOINT)

  interface DispatchView {
    session: {
      duration_min: number
      courses_count: number
      earnings: number
      target_earnings: number
      efficiency: number           // 0-100
    }
    corridors: {
      direction: "nord" | "est" | "sud" | "ouest"
      status: "fluide" | "dense" | "sature"
      reason?: string
    }[]
    timeline_extended: {
      time: string
      label: string
      zone: string
      type: "pic" | "dispersion" | "transition" | "nuit"
    }[]
    phase: "calme" | "montee" | "pic" | "dispersion"
    generatedAt: string
  }

  ---
  2. Component Updates

  A. ActionPanel (panneau droit principal)

  Replace current ramification list with 3 blocks:

  ┌────────────────────────────────────┐
  │  ACTION                            │
  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
  │                                    │
  │  BERCY                      XII    │
  │  5 km — 12 min                     │
  │                                    │
  │  Fenêtre : 22:35–23:10             │
  │  Entrée : côté Nation              │
  │                                    │
  │  ┌────────┐ ┌────────┐ ┌────────┐  │
  │  │OPP  64 │ │FRIC 15 │ │COST 13 │  │
  │  └────────┘ └────────┘ └────────┘  │
  │                                    │
  │  "Tu es dans le corridor EST.      │
  │   Opportunité naturelle."          │
  │                                    │
  ├────────────────────────────────────┤
  │  FRICTION                          │
  │  RER A perturbé                    │
  │  → Bonus VTC banlieue Est          │
  │                                    │
  ├────────────────────────────────────┤
  │  ALTERNATIVE                       │
  │  Gare de Lyon — 3 km (8 min)       │
  │  si saturation Bercy               │
  │                                    │
  └────────────────────────────────────┘

  Data mapping:
  // Action block
  primaryAction.zone
  primaryAction.arrondissement
  primaryAction.distance_km + " km — " + primaryAction.eta_min + " min"
  primaryAction.optimal_window
  primaryAction.entry_side
  primaryAction.opportunity_score
  primaryAction.friction_risk
  primaryAction.reposition_cost
  driverContext?.corridor_hint

  // Friction block
  activeFrictions[0]?.label
  activeFrictions[0]?.implication

  // Alternative block
  alternativeActions[0]?.zone
  alternativeActions[0]?.distance_km
  alternativeActions[0]?.eta_min
  alternativeActions[0]?.condition

  ---
  B. ScoreChips (nouveau component)

  interface ScoreChipProps {
    label: string      // "OPP", "FRIC", "COST"
    value: number      // 0-100
    inverted?: boolean // true for COST (lower = green)
  }

  // Color logic:
  // OPP/FRIC: value > 60 = green, 30-60 = yellow, < 30 = red
  // COST: value < 30 = green, 30-60 = yellow, > 60 = red

  ---
  C. Map Updates

  Add driver position marker:
  // Use driverPosition from API
  {driverPosition && (
    <DriverMarker
      lat={driverPosition.lat}
      lng={driverPosition.lng}
      corridor={driverContext?.corridor}
    />
  )}

  ---
  D. DispatchView (nouvelle page/modal)

  Triggered by clicking "DISPATCH" button:

  ┌─────────────────────────────────────────┐
  │  DISPATCH                               │
  ├─────────────────────────────────────────┤
  │                                         │
  │  SESSION           2h 00m               │
  │  ████████████░░░   72€ / 120€           │
  │  Efficiency: 71%                        │
  │                                         │
  ├─────────────────────────────────────────┤
  │                                         │
  │  CORRIDORS                              │
  │                                         │
  │  NORD    ○ fluide                       │
  │  EST     ◉ saturé    Sortie concert     │
  │  SUD     ○ fluide                       │
  │  OUEST   ● dense     PSG sortie         │
  │                                         │
  ├─────────────────────────────────────────┤
  │                                         │
  │  +2H                                    │
  │                                         │
  │  23:00   pic         Bercy              │
  │  00:00   dispersion  banlieue           │
  │  01:00   nuit        gares              │
  │                                         │
  └─────────────────────────────────────────┘

  Data mapping:
  // Session block
  session.duration_min → format as "Xh XXm"
  session.earnings + "€ / " + session.target_earnings + "€"
  session.efficiency + "%"
  // Progress bar: earnings / target_earnings

  // Corridors block
  corridors.map(c => (
    <CorridorRow
      direction={c.direction}
      status={c.status}
      reason={c.reason}
    />
  ))

  // Timeline block
  timeline_extended.slice(0, 3).map(t => (
    <TimelineRow
      time={t.time}
      type={t.type}
      zone={t.zone}
    />
  ))

  ---
  E. CorridorIndicator (nouveau component)

  interface CorridorIndicatorProps {
    direction: "nord" | "est" | "sud" | "ouest"
    status: "fluide" | "dense" | "sature"
    reason?: string
  }

  // Visual:
  // ○ fluide (dim)
  // ● dense (yellow)
  // ◉ saturé (red)

  ---
  3. Geolocation Integration

  Frontend needs to get driver position and pass to API:

  // In main dashboard component
  const [driverPosition, setDriverPosition] = useState<{lat: number, lng: number} | null>(null)

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (pos) => setDriverPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }),
        null,
        { enableHighAccuracy: true }
      )
    }
  }, [])

  // Pass to API
  const apiUrl = driverPosition
    ? `/api/flow/state?lat=${driverPosition.lat}&lng=${driverPosition.lng}`
    : `/api/flow/state`

  ---
  4. Navigation

  GUIDÉ (main view)
    └─> Click "DISPATCH" → DispatchView (modal or slide-over)
    └─> Click zone on map → Zone detail (existing)

  ---
  5. Files to Create/Modify
  ┌──────────────────────────────────┬──────────────────────────────┐
  │               File               │            Action            │
  ├──────────────────────────────────┼──────────────────────────────┤
  │ components/ActionPanel.tsx       │ REWRITE — 3 blocks structure │
  ├──────────────────────────────────┼──────────────────────────────┤
  │ components/ScoreChips.tsx        │ NEW — OPP/FRIC/COST chips    │
  ├──────────────────────────────────┼──────────────────────────────┤
  │ components/CorridorHint.tsx      │ NEW — corridor message       │
  ├──────────────────────────────────┼──────────────────────────────┤
  │ components/DispatchView.tsx      │ NEW — strategic view         │
  ├──────────────────────────────────┼──────────────────────────────┤
  │ components/CorridorIndicator.tsx │ NEW — status dots            │
  ├──────────────────────────────────┼──────────────────────────────┤
  │ components/SessionProgress.tsx   │ NEW — earnings bar           │
  ├──────────────────────────────────┼──────────────────────────────┤
  │ components/Map.tsx               │ UPDATE — add driver marker   │
  ├──────────────────────────────────┼──────────────────────────────┤
  │ hooks/useDriverPosition.ts       │ NEW — geolocation hook       │
  ├──────────────────────────────────┼──────────────────────────────┤
  │ hooks/useFlowState.ts            │ UPDATE — pass lat/lng        │
  ├──────────────────────────────────┼──────────────────────────────┤
  │ hooks/useDispatch.ts             │ NEW — fetch dispatch data    │
  └──────────────────────────────────┴──────────────────────────────┘