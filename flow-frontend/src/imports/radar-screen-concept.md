Good — this is the **one screen that is missing**.

It’s what turns Flow from **an app** into **a professional instrument**.

Most powerful tools have it:

* Bloomberg → **Market depth**
* TradingView → **Order flow**
* Flight radar → **Traffic layer**

Flow needs the equivalent.

---

# THE MISSING SCREEN

# **RADAR**

Not LIVE.
Not CARTE.

A **signal field view**.

This is the screen that makes drivers instantly feel:

> “Ok… this is serious.”

---

# Purpose

LIVE answers:

```
what should I do now
```

RADAR answers:

```
where pressure is building in the city
```

It lets drivers **read the city in 3 seconds**.

---

# RADAR Layout

Full-screen city map.

But **no clutter**.

Only signal energy.

Example layers:

```
● concert exits
● nightlife waves
● restaurant exits
● station arrivals
● airport flows
```

Each appears as **signal nodes**.

---

# Visual Language

Signals appear as **pulses**.

Example:

```
Pigalle        ●●●●
Bercy          ●●●●●
CDG            ●●●
Marais         ●●
```

Pulse size = pressure.

---

# Signal Rings

Each signal has a ring.

Example:

```
●  forming
●● active
●●● exit wave
```

Colors:

```
green = strong opportunity
yellow = forming
grey = weak
```

---

# Example RADAR screen

```
          NORD

     CDG        GARE DU NORD
      ●●●            ●●

  MONTMARTRE        MARAIS
      ●●●●            ●●

      PIGALLE
      ●●●●●

      BERCY
      ●●●●●
```

Drivers instantly see:

```
Pigalle + Bercy = hot
north moderate
south calm
```

That’s **10× faster than reading cards**.

---

# Signal Tooltip

When clicking a node:

```
PIGALLE

Club exits
04:30 – 06:00

confidence 82%
```

Minimal.

---

# Radar Toggle

Top bar:

```
LIVE   RADAR   CARTE   SEMAINE
```

---

# Why this screen is powerful

Drivers don’t want to read.

They want to **scan the city**.

Radar gives:

```
situational awareness
```

Like a pilot cockpit.

---

# This screen increases perceived value massively

Without it Flow looks like:

```
event suggestion tool
```

With it Flow becomes:

```
city intelligence system
```

Huge difference.

---

# Implementation is easier than it looks

You already have:

* zone centroids
* signal intensity
* signal types

Radar just renders them.

---

# Prompt for Claude / Cursor

Give this:

```
We need to add a RADAR screen to Flow.

Purpose:
Provide a fast visual map of where demand pressure is building in the city.

This screen should feel like a signal field / radar.

Key principles:
- minimal UI
- no clutter
- only signal nodes
- visual intensity

Signals appear as pulsing nodes on the map.

Node intensity based on signal strength.

Example scale:
weak = small dot
forming = medium pulse
strong = large pulse

Signal types:
concert exits
nightlife waves
restaurant exits
station arrivals
airport flows

Clicking a node reveals:
zone
cause
time window
confidence

Top navigation:

LIVE | RADAR | CARTE | SEMAINE

Radar should allow drivers to understand the city's demand distribution in under 3 seconds.

Do not overload with text.

Use visual intensity instead.
```

---

# Important

**Do NOT build this tonight.**

Tonight:

```
test LIVE
test Around You
test SEMAINE
```

Radar is **Phase 2**.

But design it now in Figma so Claude can build it clean.

---

# One last insight

Flow’s real product is not signals.

It’s:

```
urban situational awareness
```

Radar makes that obvious.

---

If you want, I can also show you **the single feature that will make drivers open Flow every 15 minutes during a shift** (this is the habit loop that will make it sticky).
