# Simulation mode — product spine

## One input contract

Simulation must **not** use a separate “compiledBrief generator” or special path.

**Correct:** Generate a **synthetic daily pack** (same shape as `CitySignalsPackV1`), then run the existing pipeline:

```
syntheticPack
  → normalizeCitySignalsPack()
  → compiledFromCitySignalsPackV1()
  → orchestrate()
  → FlowState
```

**Why:** One input contract forever; simulation automatically evolves when the engine evolves; zero special-case logic.

## Separation of concerns

- **Supabase** = canonical truth, gating, payments, audit.
- **Simulation** = ephemeral, local, no DB writes, 10‑min TTL.

## Onboarding = tuning, not profiling

Calibration questions must feel like **setting the instrument**, not filling a form.

- Use **taps, sliders, choices**.
- **No text input** for simulation calibration.

## Layered model

```
Decision Gate (Simuler | Activer LIVE)
   ↓
Simulation (synthetic pack → same pipeline, local)
   ↓
Conversion
   ↓
LIVE Field (Supabase canonical)
```
