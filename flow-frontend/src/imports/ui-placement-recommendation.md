You’re asking **where the confidence / strength indicator should be placed in the UI**. The placement matters a lot because drivers scan screens extremely fast (usually **<1 second**).

Here is the best placement for Flow.

---

# 1. Primary position (best)

Place it **to the right of the event name**.

Example:

```
THEATRE DU CHATELET                    88
```

or

```
THEATRE DU CHATELET               ●●●●
```

Why this works:

Drivers read in this order:

```
location → strength → action
```

So the eye sees instantly:

```
Theatre du Chatelet → strong signal → follow
```

You already almost have this structure.

---

# 2. Secondary confirmation (optional)

You can also repeat it inside the card:

```
Signal strength: 88
```

but this is **less important**.

Drivers won't read it often.

---

# 3. Color logic

Use color to reinforce the signal.

Example:

```
90–100   bright green
70–89    green
50–69    amber
<50      grey
```

Drivers should **recognize strength without reading numbers**.

---

# 4. Where NOT to put it

Avoid placing it:

• under the description
• in the bottom info area
• near the navigation button

Drivers won’t notice it there.

---

# 5. Example layout for Flow

Ideal card structure:

```
THEATRE DU CHATELET                88
Sortie theatre

RESTE EN POSITION
COTE PLACE DU CHATELET

~900 personnes
PIC 22:45
€15–40

NAVIGUER →
```

The score sits **top-right** like a stock signal.

---

# 6. Why this works psychologically

Drivers think like traders.

They scan:

```
signal → strength → move
```

The score acts like **a probability indicator**.

---

# 7. Bonus improvement (optional later)

Instead of just number:

```
88
```

you could show:

```
88 FORMATION
```

or

```
88 STRONG
```

Because drivers understand words faster than pure numbers.

---

# My recommendation for V1

Keep what you already have:

```
event name                88
```

It’s actually **the correct placement already**.

Just label it slightly clearer in the design system.

---

If you want, I can also show you **one UI adjustment that could make the LIVE screen feel 2× more premium without adding any new feature**. It’s purely layout psychology.
