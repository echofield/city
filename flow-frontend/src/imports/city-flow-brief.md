# CITY-FLOW — Brief pour Figma AI

> App mobile pour chauffeurs VTC Paris.
> Objectif: savoir ou aller en 2 secondes.

---

## IDENTITE

**Ton:** Pro, sobre, operationnel. Pas startup, pas gaming.
**Reference visuelle:** Terminal Bloomberg, cockpit aviation, outil pro.
**Langue:** Francais. Mots courts. Zero jargon tech.

---

## ONBOARDING (3 ecrans)

### Ecran 1 — Promesse
**Titre:** "Sais ou aller. Avant les autres."
**Sous-titre:** Une phrase max sur le positionnement intelligent.
**Action:** Bouton continuer

### Ecran 2 — Localisation
**Titre:** "Ta position, tes recommandations"
**Explication:** Une phrase sur pourquoi la localisation aide.
**Actions:**
- Autoriser (principal)
- Plus tard (secondaire, discret)

### Ecran 3 — Mode
**Titre:** "Comment utiliser Flow?"
**Choix:**
- Demo — donnees simulees, gratuit
- Live — donnees reelles, abonnement
**Action:** Commencer

---

## VUE PRINCIPALE — GUIDE

C'est l'ecran principal. Le chauffeur passe 90% de son temps ici.

### Structure

```
HEADER
- Indicateur mode (Guide/Dispatch)
- Phase actuelle (Calme/Montee/Pic/Dispersion)

CARTE (gauche ou haut sur mobile)
- Paris avec arrondissements
- Zone recommandee mise en evidence
- Point "toi ici" si localisation active

PANNEAU ACTION (droite ou bas)
- Divisé en 3 blocs
```

### Bloc 1 — ACTION (le plus grand, le plus visible)

**Contenu:**
- Nom de zone (ex: "BERCY")
- Arrondissement (ex: "XII")
- Distance + temps (ex: "5 km — 12 min")
- Fenetre optimale (ex: "22:35–23:10")
- Entree conseillee (ex: "cote Nation")
- 3 indicateurs chiffres:
  - Opportunite (0-100)
  - Friction (0-100)
  - Cout repositionnement (0-100)
- Message contextuel si pertinent (ex: "Tu es deja dans le bon corridor")

**Intention:** Le chauffeur sait immediatement OU aller et si ca vaut le coup.

### Bloc 2 — FRICTION (plus petit)

**Contenu:**
- Type de friction (ex: "RER A perturbe")
- Implication (ex: "Bonus VTC banlieue Est")

**Intention:** Une alerte, pas une liste. Un seul element.

### Bloc 3 — ALTERNATIVE (plus petit)

**Contenu:**
- Zone alternative (ex: "Gare de Lyon")
- Distance + temps (ex: "3 km — 8 min")
- Condition (ex: "si saturation Bercy")

**Intention:** Plan B en un coup d'oeil.

### Barre Timeline (bas)

**Contenu:**
```
CALME — MONTEE — PIC — DISPERSION
```
Avec indicateur de position actuelle.

**Intention:** Ou on en est dans la soiree.

---

## VUE DISPATCH — Strategie

Accessible depuis le header. Vue complementaire, pas concurrente.

### Structure

```
HEADER
- Meme que Guide

SESSION
- Duree active (ex: "2h 34min")
- Gains vs objectif (ex: "72€ / 120€")
- Barre de progression
- Efficacite (ex: "71%")

CORRIDORS
- 4 directions: Nord, Est, Sud, Ouest
- Etat chacun: fluide / dense / sature
- Raison si pertinent (ex: "sortie concert")

TIMELINE +2H
- 3 evenements max
- Heure + type + zone
- Ex: "23:00 — pic — Bercy"
```

**Intention:** Vision strategique. Pas d'action immediate mais contexte pour decider.

---

## TEMPLATES JOUR (optionnel, pre-session)

Avant de commencer sa session, le chauffeur peut voir la journee.

### Structure

4 blocs pour 4 moments:
- MATIN
- MIDI
- SOIR
- NUIT

**Chaque bloc contient:**
- Titre descriptif (ex: "Stade/Arena")
- Fourchette gains (ex: "~20-35€")
- Niveau stress (1-3)
- Zones suggerees (ex: "Bercy, Accor Arena")
- Raisons si jour special (ex: "Concert Phoenix 22h45")

**Intention:** Planifier sa soiree avant de demarrer.

---

## ELEMENTS RECURRENTS

### Indicateurs chiffres (OPP / FRIC / COST)

3 petits badges avec:
- Label court (3-4 lettres)
- Valeur (0-100)
- Couleur selon valeur (vert/jaune/rouge)

Logique couleur:
- OPP: haut = vert, bas = rouge
- FRIC: bas = vert, haut = rouge
- COST: bas = vert, haut = rouge

### Zone sur la carte

- Zone recommandee: mise en evidence forte
- Zones actives: mise en evidence moyenne
- Zones froides: neutres
- Position chauffeur: marqueur distinct

### Messages contextuels

Courts. Une ligne max.
Ex:
- "Tu es dans le corridor EST. Opportunite naturelle."
- "Repositionnement couteux. Reste en zone."
- "Fenetre active. Bouge maintenant."

---

## CE QUI N'EST PAS DANS L'APP

- Pas de chat
- Pas de feed social
- Pas de notifications push excessives
- Pas de gamification (badges, scores, classements)
- Pas de publicite
- Pas de map interactive complexe (zoom/layers/filters)
- Pas d'historique detaille des courses
- Pas de parametres avances

---

## MOTS A UTILISER

**Oui:**
- Zone
- Corridor
- Fenetre
- Opportunite
- Friction
- Pic
- Dispersion
- Actif
- Fluide / Dense / Sature

**Non:**
- Dashboard
- Analytics
- Insights
- Smart / IA / Intelligence
- Monetisation
- Premium
- Boost

---

## HIERARCHIE VISUELLE

```
1. Zone recommandee (GROS, CLAIR)
2. Distance/temps (visible immediatement)
3. Indicateurs (OPP/FRIC/COST)
4. Contexte (fenetre, entree, message)
5. Friction (alerte secondaire)
6. Alternative (plan B)
7. Timeline (orientation temporelle)
```

---

## INTERACTIONS PRINCIPALES

1. **Ouvrir app** → Vue Guide avec recommandation
2. **Taper sur zone carte** → Highlight + infos distance
3. **Taper sur Dispatch** → Vue strategique
4. **Tirer vers le bas** → Rafraichir donnees
5. **Taper sur template jour** → Voir details moment

---

## ETATS SPECIAUX

### Pas de localisation
- Masquer distances/temps
- Afficher message discret "Localisation desactivee"
- Garder recommandations zones

### Pas de donnees
- Message "Journee calme" ou "Pas de signal"
- Suggerer de revenir plus tard

### Erreur connexion
- Afficher dernieres donnees
- Indicateur "Donnees de [heure]"
- Bouton reessayer

### Mode demo
- Bandeau discret "Simulation"
- Memes fonctionnalites que live

---

## RESUME EN UNE PHRASE

> Un ecran principal avec UNE zone recommandee, SA distance, et TROIS indicateurs de decision.
> Le reste est contexte.# FRONTEND HANDOFF — CITY-FLOW

> Pour construire un frontend alternatif sur le backend existant.
> Focus: organisation, practicality, room for creativity.

---

## 1. PHILOSOPHY

### Ce que c'est
- **Instrument de positionnement** pour chauffeurs VTC Paris/IDF
- Pas un dashboard analytics
- Pas une heatmap decorative
- Pas un feed d'infos

### Le test ultime
> "Le chauffeur comprend quoi faire en 2 secondes"

### Hierarchy of information
```
1. ACTION (what to do now)
2. CONTEXT (why)
3. ALTERNATIVES (if not)
4. STRATEGY (when needed)
```

---

## 2. API ENDPOINTS

### Primary: `/api/flow/state`

**Params:**
```
?lat={number}&lng={number}  // Driver GPS position (optional but recommended)
?sessionStart={timestamp}   // Session start for progress tracking
```

**Returns:** Complete state for GUIDED view

### Secondary: `/api/flow/dispatch`

**Params:**
```
?sessionStart={timestamp}
?courses={number}           // Manual course count
?earnings={number}          // Manual earnings
```

**Returns:** Strategic context (corridors, session metrics, timeline)

---

## 3. DATA CONTRACTS

### FlowState (main)

```typescript
interface FlowState {
  // === TEMPORAL ===
  windowState: "forming" | "active" | "closing" | "stable"
  windowLabel: string           // "FENETRE ACTIVE"
  windowCountdownSec: number
  windowMinutes: number
  shiftPhase: "calme" | "montee" | "pic" | "dispersion"
  shiftProgress: number         // 0-1

  // === ACTION ===
  action: "hold" | "prepare" | "move" | "rest"
  actionLabel: string           // "BOUGER"
  confidence: number            // 0-100

  // === MESSAGES ===
  fieldMessage: string          // "Bercy actif."
  temporalMessage: string       // "Fenetre ouverte - 7 min restantes."

  // === TARGET ===
  targetZone: string
  targetZoneArr: string         // "XII"
  favoredCorridor: string       // "est"
  favoredZoneIds: string[]
  alternatives: string[]

  // === MAP DATA ===
  zoneHeat: Record<string, number>        // 0-1 per zone
  zoneSaturation: Record<string, number>  // 0-100
  zoneState: Record<string, "cold"|"warm"|"hot"|"blocked">

  // === EARNINGS ===
  earningsEstimate: [number, number]      // [min, max]
  sessionEarnings: number

  // === SIGNALS ===
  signals: { text: string; type: "event"|"weather"|"transport"|"surge" }[]
  upcoming: { time: string; zone: string; saturation: number; earnings: number; distance_km?: number; eta_min?: number }[]
  peaks: { time: string; zone: string; reason: string; score: number; distance_km?: number; eta_min?: number }[]

  // === PRIMARY ACTION (structured) ===
  primaryAction?: {
    zone: string
    arrondissement: string
    distance_km: number
    eta_min: number
    entry_side: string           // "cote Nation"
    optimal_window: string       // "22:35-23:10"
    opportunity_score: number    // 0-100
    friction_risk: number        // 0-100
    reposition_cost: number      // 0-100 (lower = better)
    saturation_risk_delta: number // positive = good
    reason: string
  }

  // === DRIVER CONTEXT ===
  driverContext?: {
    corridor: "nord" | "est" | "sud" | "ouest" | "centre"
    same_corridor: boolean
    corridor_hint?: string       // "Tu es dans le corridor EST..."
  }

  // === FRICTIONS ===
  activeFrictions?: {
    type: "transit" | "weather" | "saturation" | "event"
    label: string
    implication: string
    corridor?: string
  }[]

  // === ALTERNATIVES ===
  alternativeActions?: {
    zone: string
    distance_km: number
    eta_min: number
    condition: string            // "si saturation Bercy"
  }[]

  // === TEMPLATES (day planning) ===
  templates?: {
    id: string
    title: string
    window: "morning" | "midday" | "evening" | "night"
    description: string
    fuelBand: string
    movement: number
    stress: number
    potential: number
    suggestedZones: string[]
    reasons: string[]
  }[]

  // === RAMIFICATIONS ===
  ramifications?: {
    id: string
    kind: string
    effect_zone: string
    explanation: string
    confidence: "high" | "medium" | "low"
    corridor?: string
    tone?: string
  }[]

  // === DRIVER POSITION (echo) ===
  driverPosition?: { lat: number; lng: number }
}
```

### DispatchView (strategic)

```typescript
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
}
```

---

## 4. SCREEN ARCHITECTURE

### 4.1 ONBOARDING (3 screens max)

**Screen 1: Value Prop**
```
"Sais ou aller. Avant les autres."

[Single illustration: driver + target zone highlighted]

[Continuer]
```

**Screen 2: Permission GPS**
```
"Pour des recommandations precises,
on a besoin de ta position."

[Illustration: position marker on map]

[Autoriser la localisation]
[Plus tard]
```

**Screen 3: Mode Selection**
```
"Comment veux-tu utiliser Flow?"

[ ] Demo (simulation, donnees fictives)
[ ] Live (donnees reelles, abonnement)

[Commencer]
```

**Design notes:**
- Max 3 screens
- One action per screen
- Skip option always visible
- No lengthy explanations

---

### 4.2 GUIDED VIEW (main)

**Layout:**
```
+------------------------------------------+
|  HEADER                                  |
|  [GUIDE] [DISPATCH]     Phase: PIC       |
+------------------+-----------------------+
|                  |                       |
|                  |   PRIMARY ACTION      |
|                  |   ================    |
|      MAP         |   BERCY         XII   |
|                  |   5 km - 12 min       |
|    [zones]       |                       |
|    [driver dot]  |   Fenetre: 22:35-23:10|
|                  |   Entree: cote Nation |
|                  |                       |
|                  |   [OPP 64] [FRIC 15]  |
|                  |   [COST 13]           |
|                  |                       |
|                  |   "Tu es dans le      |
|                  |    corridor EST."     |
|                  +-----------------------|
|                  |   FRICTION            |
|                  |   RER A perturbe      |
|                  |   > Bonus VTC Est     |
|                  +-----------------------|
|                  |   ALTERNATIVE         |
|                  |   Gare de Lyon        |
|                  |   3 km - 8 min        |
|                  |   si saturation       |
+------------------+-----------------------+
|  TIMELINE BAR                            |
|  o CALME --- MONTEE --- [PIC] --- DISP   |
+------------------------------------------+
```

**Key interactions:**
- Tap zone on map → highlight + show distance
- Tap PRIMARY ACTION → expand details
- Tap DISPATCH → switch to strategic view
- Pull down → refresh

**Data mapping:**
```
PRIMARY ACTION:
  - zone: primaryAction.zone
  - arrondissement: primaryAction.arrondissement
  - distance: primaryAction.distance_km + " km"
  - eta: primaryAction.eta_min + " min"
  - window: primaryAction.optimal_window
  - entry: primaryAction.entry_side
  - OPP: primaryAction.opportunity_score
  - FRIC: primaryAction.friction_risk
  - COST: primaryAction.reposition_cost
  - hint: driverContext.corridor_hint

FRICTION:
  - label: activeFrictions[0].label
  - implication: activeFrictions[0].implication

ALTERNATIVE:
  - zone: alternativeActions[0].zone
  - distance: alternativeActions[0].distance_km
  - eta: alternativeActions[0].eta_min
  - condition: alternativeActions[0].condition
```

---

### 4.3 DISPATCH VIEW (strategic)

**Layout:**
```
+------------------------------------------+
|  HEADER                                  |
|  [GUIDE] [DISPATCH*]    Phase: PIC       |
+------------------------------------------+
|                                          |
|  SESSION                                 |
|  ========================================|
|  Duree: 2h 34m                           |
|  [=================-----] 72E / 120E     |
|  Efficiency: 71%                         |
|                                          |
+------------------------------------------+
|                                          |
|  CORRIDORS                               |
|  ========================================|
|  NORD    o fluide                        |
|  EST     * sature    Sortie concert      |
|  SUD     o fluide                        |
|  OUEST   . dense     PSG sortie          |
|                                          |
+------------------------------------------+
|                                          |
|  +2H TIMELINE                            |
|  ========================================|
|  23:00   pic         Bercy               |
|  00:00   dispersion  banlieue            |
|  01:00   nuit        gares               |
|                                          |
+------------------------------------------+
```

**Key interactions:**
- Tap corridor → show corridor detail
- Tap timeline event → jump to that zone in GUIDED view
- Swipe right → back to GUIDED

**Data mapping:**
```
SESSION:
  - duration: dispatch.session.duration_min (format as Xh XXm)
  - earnings: dispatch.session.earnings
  - target: dispatch.session.target_earnings
  - efficiency: dispatch.session.efficiency

CORRIDORS:
  dispatch.corridors.map(c => {
    direction: c.direction
    status: c.status (o=fluide, .=dense, *=sature)
    reason: c.reason
  })

TIMELINE:
  dispatch.timeline_extended.slice(0, 3).map(t => {
    time: t.time
    type: t.type
    zone: t.zone
  })
```

---

### 4.4 DAY TEMPLATES (optional pre-session)

**Layout:**
```
+------------------------------------------+
|  AUJOURD'HUI                             |
+------------------------------------------+
|                                          |
|  [MATIN]     Ville Calme                 |
|              ~12-20E    Stress: *        |
|              Gare du Nord, Chatelet      |
|                                          |
|  [MIDI]      Boucles Courtes             |
|              ~15-25E    Stress: **       |
|              Chatelet, Marais            |
|                                          |
|  [SOIR]      Stade/Arena       <-- ACTIF |
|              ~20-35E    Stress: ***      |
|              Bercy, Accor Arena          |
|              > Concert Phoenix 22h45     |
|              > Match PSG 23h15           |
|                                          |
|  [NUIT]      Sorties                     |
|              ~20-35E    Stress: **       |
|              Gare du Nord, Chatelet      |
|                                          |
+------------------------------------------+
|  [COMMENCER SESSION]                     |
+------------------------------------------+
```

**Data mapping:**
```
templates.map(t => {
  id: t.id
  title: t.title
  window: t.window
  fuelBand: t.fuelBand
  stress: t.stress (render as * or bars)
  suggestedZones: t.suggestedZones.join(", ")
  reasons: t.reasons
})
```

---

## 5. MAP REQUIREMENTS

### Zones
- 20 Paris arrondissements (1-20)
- Special: "cite", "stlouis"
- Zone IDs must match: `zoneHeat`, `zoneSaturation`, `zoneState`

### Visualization
```
zoneState === "hot"     → Strong highlight (recommended)
zoneState === "warm"    → Medium highlight
zoneState === "cold"    → Dim/default
zoneState === "blocked" → Marked as unavailable
```

### Driver Marker
```
if (driverPosition) {
  show marker at (driverPosition.lat, driverPosition.lng)
  optionally show corridor indicator
}
```

### Banlieue (outside Paris)
- Backend provides data for: Defense, Nanterre, Boulogne, Issy, Saint-Denis, etc.
- Map can show simplified banlieue zones or just direction indicators
- Focus: corridors (nord/est/sud/ouest) not individual communes

---

## 6. SCORE CHIPS LOGIC

### Opportunity (OPP)
```
> 70: green  (high opportunity)
40-70: yellow (medium)
< 40: red    (low)
```

### Friction (FRIC)
```
< 30: green  (low friction)
30-60: yellow (medium)
> 60: red    (high friction - caution)
```

### Reposition Cost (COST)
```
< 30: green  (worth it)
30-60: yellow (consider)
> 60: red    (not worth the detour)
```

### Saturation Delta
```
> 20: green + checkmark  (opportunity >> saturation)
-20 to 20: neutral       (balanced)
< -20: red + warning     (saturation risk)
```

---

## 7. TIMELINE BAR

```
[CALME] --- [MONTEE] --- [PIC] --- [DISPERSION]
    o          o          *           o

* = current phase (from shiftPhase)
```

Visual: progress line with 4 nodes, current highlighted

---

## 8. GEOLOCATION

### Permission Flow
```
1. Check if geolocation available
2. Request permission
3. If granted: watchPosition with high accuracy
4. If denied: show message, allow manual zone selection
5. Pass lat/lng to all API calls
```

### Fallback
```
If no position:
- Hide distance/ETA from cards
- Hide driver marker on map
- Hide corridor_hint
- Still show zone recommendations (without personalization)
```

---

## 9. REFRESH STRATEGY

### Auto-refresh
```
- GUIDED view: every 60 seconds
- DISPATCH view: every 120 seconds
- On app foreground: immediate refresh
```

### Manual refresh
```
- Pull-to-refresh on main view
- Clear visual indicator during refresh
```

### State preservation
```
- Keep last state visible during refresh
- Only update on successful response
- Show stale indicator if refresh fails
```

---

## 10. ERROR STATES

### No connection
```
"Pas de connexion"
[Afficher les dernieres donnees]
[Reessayer]
```

### No data for today
```
"Pas de donnees pour aujourd'hui"
"Verifiez demain ou contactez le support"
```

### GPS permission denied
```
"Localisation desactivee"
"Les recommandations seront moins precises"
[Continuer sans localisation]
[Activer dans les reglages]
```

---

## 11. SUBSCRIPTION MODES

### Demo Mode
- Simulated data (mock=1)
- Full feature access
- Watermark: "SIMULATION"
- No payment required

### Live Mode
- Real data
- Requires active subscription
- No watermark

### Check subscription
```
// Backend will handle auth
// Frontend should:
1. Check user auth state
2. If not subscribed: show upgrade prompt
3. If subscribed: load live data
```

---

## 12. ACCESSIBILITY

### Minimum requirements
- Touch targets: 44x44pt minimum
- Contrast: 4.5:1 for text
- Font size: user preference respected
- Screen reader: labels on all interactive elements

### One-hand operation
- Primary actions in thumb zone (bottom)
- Secondary actions top/corners
- Swipe gestures for navigation

---

## 13. CREATIVE FREEDOM

### Fixed (must match backend)
- Data structure
- Zone IDs
- API endpoints
- Score logic

### Flexible (your choice)
- Visual design language
- Animation style
- Color palette
- Typography
- Map style (dark/light/custom)
- Component layout within sections
- Micro-interactions
- Sound/haptics

### Encouraged experimentation
- Novel ways to show opportunity vs risk
- Compact information density
- Glanceable dashboard concepts
- Corridor visualization (not just text)
- Timeline representations

---

## 14. TECHNICAL NOTES

### API Base
```
Production: https://your-domain.vercel.app
Development: http://localhost:3000
```

### Headers
```
Content-Type: application/json
```

### Error handling
```
HTTP 200: Success
HTTP 404: No data
HTTP 500: Server error

All responses include:
- generatedAt: ISO timestamp
- version: API version (currently 1)
```

---

## 15. LAUNCH CHECKLIST

- [ ] Onboarding flow (3 screens)
- [ ] GPS permission handling
- [ ] GUIDED view with primaryAction
- [ ] DISPATCH view with corridors
- [ ] Map with zone highlighting
- [ ] Driver position marker
- [ ] Score chips (OPP/FRIC/COST)
- [ ] Timeline bar
- [ ] Refresh mechanism
- [ ] Error states
- [ ] Demo/Live mode toggle
- [ ] Pull-to-refresh
- [ ] Offline fallback

---

## 16. TEST CASES

### Happy path
1. Open app → Onboarding → GPS granted → GUIDED view loads
2. See primaryAction with distance/ETA
3. Switch to DISPATCH → see corridors
4. Pull refresh → data updates

### Edge cases
1. No GPS → Still shows recommendations without distance
2. No events today → Show "calme" state
3. API error → Show cached data + retry option
4. Session timeout → Prompt re-auth

---

## DONE

This handoff contains everything needed to build a complete alternative frontend. The backend is ready and tested. Focus on the 2-second test: can the driver understand the decision immediately?
