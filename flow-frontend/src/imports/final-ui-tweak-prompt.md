Good. Since you want **one last tweak prompt** before exporting the zip, the goal is:

* **do not redesign**
* **do not add features**
* **only polish**
* **lock mobile friendliness**
* **preserve signal philosophy**

Below is a **clean prompt you can give to Figma AI / Claude / designer** before export.

---

# Final UI Tweak Prompt (Flow V1 Freeze)

Do **not redesign the product**.
Only apply **minor clarity and consistency improvements** while keeping the existing structure.

The application is a **mobility intelligence tool for drivers**.
The UI must remain **minimal, calm, and instantly readable while driving**.

---

# Global UI Rules

1. Preserve the current structure:

```
CARTE
LIVE
RADAR
SEMAINE
```

Bottom navigation must remain **mobile-first**.

2. Maintain the dark minimal style:

```
Background: #0A0A0A
Primary signal: #10B981
Primary text: #FFFFFF
Secondary text: #9CA3AF
```

3. All screens must remain readable in **under 2 seconds**.

No additional UI components.

---

# RADAR Screen Adjustments

Radar represents **signals forming in the city**, not places.

Adjustments:

• Slightly increase radar circle contrast (10–15%)
• Limit visible signals to **maximum 3–5**
• Signal dots should have subtle glow
• Dot size may scale slightly with signal strength

Interaction:

```
tap signal → open signal card
```

Radar should feel like:

```
city scanning system
```

Not a map of venues.

---

# LIVE Screen Adjustments

Live is the **decision screen**.

Ensure:

• Large directive headline
• Distance + € range clearly visible
• Countdown to window closing visible
• Only **2 alternative signals maximum**

Remove visual clutter.

---

# CARTE Screen Adjustments

Purpose:

```
territorial awareness
```

Adjustments:

• Limit glowing zones to **maximum 4**
• Keep map minimal
• Maintain large NAVIGUER button
• Do not add additional overlays

---

# SEMAINE Screen Adjustments

Purpose:

```
driver planning
```

Keep:

• Weekly summary card
• Zone pressure bars
• Best windows

Optional small addition:

A minimal rhythm visualization:

```
Mon ░░
Tue ░░
Wed ░░▓
Thu ░▓▓
Fri ▓▓▓▓
Sat ▓▓▓▓▓
Sun ░▓
```

But keep it **subtle and compact**.

---

# Mobile Optimization

Ensure:

• bottom navigation reachable with thumb
• large tap targets
• no dense paragraphs
• cards stack cleanly vertically

---

# Loading States

Add minimal states:

```
Skeleton while loading
"Données en attente" if no signals
```

---

# Final Principle

Every screen must answer:

```
Where should the driver be?
```

If a UI element does not help answer that question, remove it.

---

# Export

Prepare assets for export with:

```
mobile-first layout
dark theme tokens
component consistency
```

No redesigns beyond the adjustments above.

---

If you apply this and export the zip, you are **ready for integration**.

And honestly: your UI is already **strong enough to test with real drivers now** — which is where the real insights will come from.
