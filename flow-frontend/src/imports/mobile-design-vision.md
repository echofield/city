Good point mentioning **mobile** — that actually changes some design choices.
I’ll give you a **practical vision that works on phones**, not just desktop.

The idea of a **“breathing city” map** is powerful but it must remain **very light visually**, especially on a small screen.

---

# 1. The “breathing city” concept

Instead of static green zones, demand areas **pulse slowly**.

Not fast animation — just a **very subtle glow expansion** every few seconds.

Example behavior:

```
zone → soft glow
expand → fade → repeat
```

Drivers instantly feel:

```
this area is alive
```

It communicates **demand forming**, not just static information.

Control rooms (air traffic, logistics, etc.) use this trick.

---

# 2. What it looks like on mobile

On a phone screen the map might show only **3–5 active zones**.

Example:

```
● Olympia
◉ Bastille
◎ Montparnasse
```

Each one gently breathing.

Driver immediately sees:

```
where energy is forming
```

without reading text.

---

# 3. Anchors + breathing zones

Combine the two ideas:

**Zone = energy**

**Anchor = cause**

Example map:

```
glowing area → IX district
anchor → Olympia
```

Driver sees:

```
Olympia exit → demand zone
```

That builds trust.

---

# 4. Mobile interaction model

Since the screen is small, the UI should follow a **tap hierarchy**.

Step 1: map view

Driver sees:

```
zones
anchors
```

Step 2: tap anchor

A **bottom card slides up** (very mobile-friendly).

Example card:

```
OLYMPIA
Sortie 22:24
~1200 personnes

Opportunity: strong
ETA demand: 8–15 min

NAVIGUER →
```

Exactly like **Apple Maps bottom sheet**.

---

# 5. Keep the right panel only on desktop

Your current UI uses a **right column panel**.

On mobile that should become:

```
bottom sheet
```

Structure:

```
MAP
↑
bottom card
```

Very natural for drivers holding a phone.

---

# 6. Mobile-friendly radar idea

Radar should feel like **scanning nearby events**.

Example mobile radar list:

```
Olympia
exit 22:24

Chatelet
exit 22:45

Montparnasse
train 22:40
```

Very clean.

Tap → map centers on location.

---

# 7. Important mobile rule

Drivers glance at phones while driving.

So information must be readable in **1 second**.

Avoid:

```
long paragraphs
tiny numbers
complex graphs
```

Prefer:

```
event
time
opportunity
```

Example:

```
OLYMPIA
22:24
STRONG
```

---

# 8. Mobile navigation structure

Your current idea works well:

```
CARTE
LIVE
RADAR
SEMAINE
```

On mobile it becomes:

```
MAP
MOVE
SCAN
WEEK
```

Shorter labels may actually help.

---

# 9. Color discipline (important)

Your minimal color idea is good.

Use green only for:

```
action
energy
signal
```

Everything else:

```
grey
white
dim
```

This keeps the screen calm.

---

# 10. The real strength of Flow

Your product is becoming something like:

```
Waze
+
city demand radar
+
event intelligence
```

Drivers are basically seeing:

```
future rides forming
```

That’s a powerful idea.

---

# One last mobile insight

There is **one interaction pattern that drivers love** in mobility apps and Flow could benefit from it.

It’s the **“quick glance mode”** — a screen that shows the **single most important signal in huge readable format** when the phone is mounted.

If you want I can sketch how that would work in Flow.
