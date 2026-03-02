# City Flow: Behavioral Loop Components

This document explains the three new components that close the behavioral loop:
**Night Replay**, **Shift Arc**, and **Field Model**.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      FLOW-COMPILER (Engine 1)                    │
│                    Strategic Intelligence                        │
│                    Generates: CompiledBrief                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FIELD MODEL (NEW)                           │
│                    Living Interpretation                         │
│                                                                  │
│   brief + drift + trajectory → evolving field state              │
│                                                                  │
│   Tracks:                                                        │
│   • Confidence decay over time                                   │
│   • Signal changes (rain, events, transit)                       │
│   • Driver position relative to target                           │
│   • Saturation levels                                            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SHIFT-CONDUCTOR (Engine 2)                     │
│                    Tactical Execution                            │
│                                                                  │
│   Reads from FieldModel (not directly from brief)                │
│   Generates: NextMove every 60-120 seconds                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SHIFT ARC (NEW)                             │
│                    Temporal Rhythm                               │
│                                                                  │
│   Shows: Calm → Build → Peak → Release                           │
│   "Where am I in the night's rhythm?"                            │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NIGHT REPLAY (NEW)                          │
│                    Perception Feedback                           │
│                                                                  │
│   End of shift: cause → effect narrative                         │
│   "You didn't get lucky. You understood the city."               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Night Replay

**Purpose**: Create narrative continuity from shift randomness. Build trust through perception feedback.

**Location**: `src/lib/shift-conductor/replay.ts` + `src/app/replay/page.tsx`

### Usage

```typescript
import { generateReplayNarrative } from '@/lib/shift-conductor'

const replay = generateReplayNarrative(session)

// Returns:
{
  items: ReplayItem[]           // 5-10 key moments
  alignment: {
    score: number               // 0-100
    followed: number
    favorable: number
  }
  top_win: ReplayItem | null
  top_miss: ReplayItem | null
  rule_learned: string          // What tonight teaches
  shift_date: string
  shift_duration_hours: number
}
```

### Testing

1. Navigate to `/replay` in the browser
2. Observe mock data rendering:
   - Alignment score at top
   - Replay items with cause → effect
   - Top win / Top miss cards
   - Rule learned

### Key Design Principles

- **Never say "Flow predicted correctly"** — always "The window opened"
- Field remains the actor, driver remains the reader
- No charts, no AI tone — just cause → effect memory

---

## 2. Shift Arc

**Purpose**: Show drivers where they are in the night's rhythm. Creates emotional scaffold.

**Location**: `src/lib/shift-conductor/shift-arc.ts` + `src/components/ui/shift-arc.tsx`

### Phases

| Phase | Label | Color | Meaning |
|-------|-------|-------|---------|
| `calm` | Calme | ghost | Low activity |
| `build` | Montée | intent (amber) | Demand forming |
| `peak` | Pic | signal (green) | Maximum opportunity |
| `release` | Dispersion | calm (blue) | Post-peak scatter |

### Usage

```typescript
import { calculateShiftArc } from '@/lib/shift-conductor'

const arc = calculateShiftArc({
  now: new Date(),
  dayOfWeek: new Date().getDay(),
  majorEvents: [...],        // Optional
  rainExpectedIn: 30,        // Optional: minutes until rain
  transitDisruptions: [...]  // Optional
})

// Returns:
{
  current_phase: 'build'
  phase_progress: 65          // 0-100
  next_phase: 'peak'
  next_phase_in_minutes: 42
  phase_reason: 'Concert Bercy 21h'
  energy: 'RISING'
}
```

### Component

```tsx
import { ShiftArc } from '@/components/ui/shift-arc'

// Full version (dashboard)
<ShiftArc arc={arc} />

// Compact version (header)
<ShiftArc arc={arc} compact />
```

### Testing

1. Open `/dashboard`
2. Observe ShiftArc below header
3. Phases shown as bar with progress indicator
4. Current phase label + time to next phase

---

## 3. Field Model

**Purpose**: Thin layer between FLOW-COMPILER and SHIFT-CONDUCTOR. Makes the system feel alive by tracking drift.

**Location**: `src/lib/shift-conductor/field-model.ts`

### Why It Exists

Cities drift constantly:
- Concert ends early
- Rain arrives late
- Police reroute exits

Without Field Model, Shift-Conductor reads stale briefs.
With it, Flow adapts to reality.

### State Structure

```typescript
interface FieldModelState {
  field_state: FieldState
  energy: EnergyPhase
  confidence: number           // Decays over time

  active_window: {
    zone: string
    opened_at: string
    expected_close: string
    saturation_score: number
  } | null

  drift_flags: DriftFlag[]     // What changed
  signal_deltas: SignalDelta[] // Last 3 signal changes

  driver_zone: string | null
  driver_moving_toward_target: boolean
}
```

### Drift Detection

The Field Model detects:

| Drift Type | Trigger |
|------------|---------|
| `WINDOW_EXPIRED` | Window close time passed |
| `SATURATION_HIGH` | Zone saturation > 70% |
| `DRIVER_FAR` | Driver idle away from target |
| `TIME_DECAY` | Brief is > 60min old |
| `SIGNAL_CHANGED` | Event ended, rain started, etc. |

### Usage

```typescript
import {
  updateFieldModel,
  evaluateFieldModel,
  orchestrateWithFieldModel
} from '@/lib/shift-conductor'

// Update field model with live signals
const fieldModel = updateFieldModel(
  currentState,      // Previous FieldModelState or null
  compiledBrief,     // From FLOW-COMPILER
  liveSignals,       // Real-time updates
  driverContext      // Driver position, etc.
)

// Evaluate for decision support
const decision = evaluateFieldModel(fieldModel)
// { should_recompute, confidence_level, suggested_action }

// Orchestrate with field model awareness
const output = orchestrateWithFieldModel(fieldModel, driverContext)
// Returns move + field_model_decision
```

### Confidence Decay

- Base confidence from brief
- Decays 5% per 10 minutes
- Floor at 30%
- Low confidence triggers WAIT suggestion

---

## Testing All Components Together

### 1. Start Development Server

```bash
cd city-flow
npm run dev
```

### 2. Open Dashboard

Navigate to `http://localhost:3000/dashboard`

You should see:
- **ShiftArc** below header (shows current phase)
- **History icon** in header (links to Replay)
- **FlowActiveView** with live countdown

### 3. Test Replay

Click the History icon or navigate to `/replay`

You should see:
- Alignment score
- Replay items with outcomes
- Top win / Top miss
- Rule learned

### 4. Test Field Model (Code)

```typescript
import {
  createMockFieldModel,
  evaluateFieldModel
} from '@/lib/shift-conductor'

const model = createMockFieldModel()
console.log(model)

const decision = evaluateFieldModel(model)
console.log(decision)
```

---

## System Ready Checklist

The loop is closed when:

- [ ] FLOW-COMPILER generates briefs daily
- [ ] FIELD MODEL tracks drift in real-time
- [ ] SHIFT-CONDUCTOR reads from Field Model
- [ ] Driver actions are recorded
- [ ] SHIFT ARC shows temporal orientation
- [ ] NIGHT REPLAY generates automatically

**If Replay works → system is alive.**

---

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/shift-conductor/replay.ts` | Replay narrative generation |
| `src/lib/shift-conductor/shift-arc.ts` | Phase calculation logic |
| `src/lib/shift-conductor/field-model.ts` | State memory + drift detection |
| `src/app/replay/page.tsx` | Replay UI page |
| `src/components/ui/shift-arc.tsx` | ShiftArc component |
| `docs/BEHAVIORAL-LOOP.md` | This documentation |

---

## Design Principles

1. **Reduce thinking, don't replace thinking** — Driver remains pilot
2. **Ecological language** — "Window opening" not "78% probability"
3. **Field remains actor** — "The window opened" not "Flow predicted"
4. **Temporal compression** — 8 hours of uncertainty → confidence windows
5. **Narrative continuity** — Randomness becomes story
