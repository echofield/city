Good. Let’s do the **UI tightening spec** so Claude (or you) can implement it directly without redesigning everything.

You are not redesigning Flow — you are **sharpening the decision engine**.

Think of this as:

**Dashboard → Tactical Instrument**

---

# FLOW — UI Tightening Spec (v1 Decision Layer)

Goal:

> Drivers must understand **what to do in under 2 seconds**.

Every signal must answer:

1️⃣ What is happening
2️⃣ What should I do
3️⃣ When
4️⃣ What type of ride it produces

---

# 1 — LIVE SIGNAL CARD (Core Screen)

This is the **money screen**.

Current structure is good but hierarchy must change.

## New Signal Card Layout

```
┌───────────────────────────────────────┐
│ CDG — Terminal 2E                    │
│ AIRPORT RELEASE                      │
│                                       │
│ ACTION                                │
│ ► RESTE EN POSITION                   │
│                                       │
│ WINDOW                                │
│ 20:51 → 21:36  |  PEAK: 21:10         │
│                                       │
│ EXPECTED RIDES                        │
│ LONG / HOTEL / BANLIEUE               │
│                                       │
│ WHY                                   │
│ arrivals bank · metro weak · luggage  │
│                                       │
│ SCORE                     CONFIDENCE  │
│ 72                         HIGH       │
│                                       │
│ [ NAVIGUER ]                          │
└───────────────────────────────────────┘
```

---

## Key Change 1 — Action becomes dominant

Instead of subtle text:

Current:

> Reste en position

New:

```
► RESTE EN POSITION
```

or

```
► MONTE PIGALLE
```

or

```
► ANTICIPE BERCY
```

Make it **the biggest line in the card**.

Because this is what makes money.

---

## Key Change 2 — Introduce Ride Outcome

Add a tiny block:

```
EXPECTED RIDES
LONG
PREMIUM
MIXED
SHORT FAST
```

Examples:

Airport:

```
LONG / HOTEL / BUSINESS
```

Nightlife:

```
SHORT FAST / HIGH FREQUENCY
```

Banlieue:

```
LONG / PARIS RETURN
```

Drivers instantly know **if it's worth the time**.

---

## Key Change 3 — Wave Window

Instead of just times:

Add **phase logic**.

Example:

```
WINDOW
20:51 → 21:36
PEAK: 21:10
```

Or:

```
STARTS IN 12 MIN
PEAK 22:05
ENDS 22:30
```

This helps positioning.

---

## Key Change 4 — Why compression

Instead of sentences:

Use **3 tags max**.

Example:

```
WHY
arrivals bank · metro weak · luggage
```

or

```
concert exit · rain · metro saturated
```

---

## Key Change 5 — Confidence vs Score

Right now score exists but not interpreted.

Add explicit confidence.

```
SCORE: 91
CONFIDENCE: HIGH
```

This prevents chasing unstable signals.

---

# 2 — LIVE SIGNAL LIST (below main card)

Current structure is good but needs **one extra layer of compression**.

Example:

Current:

```
La Cigale
Sortie concert — Montmartre
```

Upgrade:

```
La Cigale
CONCERT EXIT

► ANTICIPE ROCHERCHOUART

22:50 → 23:30
SHORT FAST
Score 91
```

So the eye sees instantly:

* event type
* action
* ride profile
* timing

---

# 3 — MAP (CARTE)

Your map is already **very strong visually**.

Just add **reading cues**.

## Map Legend

Small top-left legend:

```
GREEN  = strong conversion
YELLOW = moderate opportunity
RED    = saturation risk
```

Right now users will learn but legend speeds onboarding.

---

## Map Tooltip

When clicking a zone:

Example:

```
XI — BASTILLE

ACTIVE WAVE
concert exits + nightlife

ACTION
► POSITION EAST BERCY

RIDES
mixed / medium

WINDOW
22:30 → 23:15
```

This links map → action.

---

## Map Micro Signals

Small dots for waves:

Example:

```
● Airport
▲ Concert
■ Station
◆ Nightlife
⚠ Disruption
```

Minimal but powerful.

---

# 4 — WEEK VIEW

The **Semaine Forte** screen is good but should guide decisions more.

Current text is descriptive.

Make it **tactical**.

---

## Weekly Structure Panel

Instead of paragraph:

```
SEMAINE FORTE
Score: 81

KEY PATTERNS

Vendredi – Samedi
Concert exits + nightlife cascade
Bastille / Pigalle strong

Lundi matin
Station arrivals dominate
Gare du Nord / Gare de Lyon

Risk zones
Oberkampf saturation after midnight
```

Shorter, clearer.

---

## Weekly Best Windows

Add a section:

```
BEST WINDOWS

Sat 22:30–23:30
Accor Arena exits

Fri 00:30–01:10
Eurostar release — Gare du Nord

Sat 04:00–05:15
Pigalle nightlife closure
```

Drivers can **plan shifts**.

---

# 5 — Global Navigation

Current bottom nav:

```
LIVE
RADAR
CARTE
SEMAINE
```

Good but small tweak:

```
LIVE
MAP
WEEK
RADAR
```

More intuitive.

But honestly **not critical**.

---

# 6 — Micro Interaction Improvements

Small but powerful.

## Countdown badges

Example:

```
STARTS IN 12 MIN
PEAK IN 18 MIN
```

or

```
LIVE NOW
```

Drivers love time signals.

---

## Ride Profile Icons

Tiny icons help scanning.

Example:

```
✈ airport
🎵 concert
🚆 station
🍸 nightlife
⚠ disruption
```

But keep minimal.

---

# 7 — The One Feature That Would Make Flow Feel Genius

Add **Decision Tags**.

Small labels like:

```
BEST LONG RIDES
HIGH FREQUENCY
LOW COMPETITION
AVOID
```

Example:

```
Villepinte festival

► MOVE NOW

BEST LONG RIDES
LOW COMPETITION
```

This is powerful.

---

# 8 — The Ultimate Compression Principle

Every signal must compress to this structure:

```
EVENT

ACTION

WINDOW

RIDES

WHY
```

Example:

```
ACCORD ARENA

► POSITION BERCY EAST

22:45 → 23:25

RIDES
MIXED / MEDIUM

WHY
concert exit · metro weak
```

If a driver understands this in **1–2 seconds**, Flow wins.

---

# Final Verdict on Your UI

You are **not far from a serious product**.

What remains is not:

❌ redesign
❌ new graphics
❌ fancy animation

What remains is:

✔ **decision hierarchy**
✔ **action clarity**
✔ **ride outcome visibility**
✔ **timing emphasis**

Once that is done, Flow becomes what it should be:

> **a tactical instrument for urban mobility hunting.**

---

If you want, I can also show you something important:

**the 3 UI features that would make Flow almost impossible to copy by competitors.**

Those are not obvious but extremely powerful.
