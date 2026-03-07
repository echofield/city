Flow Architecture Update — Implementation Directive

Greenlight this architecture.

We are restructuring Flow around three core driver screens with a simplified intelligence surface and a strong backend signal engine.

The goal is maximum decision compression for drivers: show only what helps them position and earn.

Core Structure

Flow will have 3 main screens:

LIVE
CARTE
SEMAINE

Dispatch moves to the secondary menu.

Navigation:

[LIVE]   [CARTE]   [SEMAINE]

Menu:

Dispatch
Paramètres
Feedback
Signal Model (Important)

Before UI rendering, normalize all surfaced intelligence into a unified signal model.

Every surfaced item must follow a consistent structure so it can be ranked and reused across screens.

Signal schema:

type
title
zone
time_window
reason
action
priority_score
proximity_minutes
confidence
signal_kind (live | nearby | soon | week)

Signals must be ranked by decision value, not by category.

Ranking factors can include:

• immediacy
• confidence
• overlap strength
• proximity
• earning potential

LIVE should always show the most actionable signals first.

LIVE Screen

LIVE is a tactical priority feed, not a tabbed dashboard.

Replace current tabs with a scrollable card feed.

Cards must answer:

WHAT
WHERE
WHEN
WHY
ACTION

Example card:

SIGNAL FORT
Accor Arena — 22:40

Concert exit + rain overlap

→ Position: Bercy / Gare de Lyon

Example nearby signal:

PROCHE DE TOI
George V — hotel outflow ~19:30

Tu es à 4 min

→ Entrée côté Champs

LIVE cards should include types such as:

• Signal fort
• Proche de toi
• Alerte
• Bientôt

But the feed should not be grouped by type.
It should be ranked by decision value.

CARTE Screen

CARTE remains the spatial positioning tool.

Map elements:

• driver GPS position
• signal pins (max 3–5 visible)
• hot zones (green glow)
• friction / blocked zones (subtle red)

Add proximity intelligence.

When a driver is within a certain travel time of a signal zone, show a proximity card.

Example:

Signal proche
Palais des Congrès — sortie 22 min

Tu es à 6 min

Important:

Use travel-time estimation, not raw distance.

Example:

2 min
5 min
8 min
12 min

This reflects real driving conditions in Paris better than kilometers.

SEMAINE Screen

SEMAINE must not be a generic event calendar.

It must behave like a money calendar.

Show Money Windows, not just events.

Each entry should indicate:

• time window
• zones
• demand cause
• positioning strategy
• confidence level

Example:

MONEY WINDOW

Samedi
22:45 – 23:30

Accor Arena concert exit

Zones
Bercy
Gare de Lyon

Strategy
Position 15 min before exit

Confidence: HIGH

Example:

Vendredi

22:00 – 03:00
Nightlife wave

Zones
Pigalle
Bastille
Oberkampf

Amplifier
Rain forecast

Confidence: HIGH

SEMAINE should highlight Best Night This Week at the top.

Example:

BEST NIGHT THIS WEEK

Samedi

Concert + Rain + Nightlife

Expected demand: VERY HIGH

This allows drivers to plan their working schedule.

Ramification Engine

Signals must incorporate ramification logic.

Strong signals come from overlapping triggers, such as:

event exit
+
rain
+
transport disruption

Example compound signal:

COMPOUND SIGNAL
Bercy — 22:45

Concert exit
Rain starting
Metro congestion

Expected demand: VERY HIGH

Signal strength should derive from overlapping layers:

Layer 1 — events
Layer 2 — time-of-day patterns
Layer 3 — weather
Layer 4 — transport disruptions
Layer 5 — driver network signals (future)

Backend can compute a ramification score to determine signal priority.

Dispatch (Secondary View)

Dispatch remains available in the menu as macro corridor intelligence.

Simplify it and remove fake stats.

Remove:

0m
1 / 120 EUR
1 courses
Efficacité 80%

Keep a simplified corridor view:

AXES

NORD  ● DENSE
EST   ○ FLUIDE
SUD   ○ FLUIDE
OUEST ● DENSE

Dispatch should help drivers understand macro city movement, not micro actions.

Design Philosophy

Flow must function as a predictive city signal instrument, not a dashboard.

Drivers should feel they:

• see demand before surge appears
• understand where to move
• understand when money windows open

Surface must stay simple.

Depth stays in the backend intelligence engine.

One Sentence Summary

Replace tabs with a tactical LIVE feed, add proximity intelligence to the map, build SEMAINE as a money calendar powered by ramification signals, and simplify Dispatch into macro corridor intelligence while keeping the deep engine behind the surface.