Give it this exact instruction (this is optimized for Claude integration):

FLOW — UI System Cleanup & Componentization

Goal:
Prepare the FLOW interface for clean developer handoff. Do NOT redesign the product. Preserve the current visual identity (dark radar interface, neon green signals). Focus on structure, consistency, and reusable components.

1. Normalize the Screen Architecture

FLOW has 4 main screens:

LIVE – real-time signals

RADAR – upcoming waves (0–60 minutes)

CARTE – spatial map of Paris

SEMAINE – weekly pattern view

Create one frame per screen with consistent layout rules.

Frame width:
Desktop prototype 1440px

2. Build a Reusable Component System

Create reusable components for:

Signal Card (Primary component)

Variants:

live

forming

soon

week

Structure:

SignalCard
 ├ intensity indicator
 ├ title
 ├ time window
 ├ reason
 ├ sublabel
 └ action

States:

active

forming

upcoming

weak

Signal Intensity

Component:

SignalIntensity

Variants:

1 dot
2 dots
3 dots
4 dots
Signal Type Color

Create color tokens:

event_exit
transport_wave
airport
nightlife
compound

Use colors:

#3B82F6   airport
#F97316   transport
#8B5CF6   event
#EC4899   nightlife
#EF4444   compound
3. Typography System

Create type styles:

Flow / Title
Flow / Signal Title
Flow / Signal Action
Flow / Body
Flow / Label
Flow / Micro

Font hierarchy should prioritize:

signal title

action

time window

Drivers must read quickly.

4. Spacing System

Define spacing tokens:

4
8
12
16
24
32
48

Use auto-layout for all cards.

5. Radar Layout

Radar should represent time horizon.

Rings:

inner = 0–15 min
middle = 15–30 min
outer = 30–60 min

Nodes show:

location
intensity
T- countdown
6. Live Screen Layout

Structure:

Top: city pressure bar
Main: primary signal
Below: stacked signals
Bottom: quick utilities

Utilities include:

WC
Food
Energy
Safe
7. Map Screen

Map should show:

Paris arrondissement outlines

heat overlay

signal pins

Pin states:

forming
active
weak

Tap → slide-up signal card.

8. Component Library

Create page:

FLOW / Components

Include:

SignalCard

SignalIntensity

RadarNode

MapPin

NavigationBar

UtilityItem

9. Dev Handoff Requirements

All components must include:

auto-layout

constraints

variants

naming conventions

Example:

SignalCard / Live / Active
SignalCard / Forming
RadarNode / Strong
RadarNode / Weak
10. Important Rule

Do NOT redesign the interface.

Keep:

dark radar aesthetic

neon green signals

tactical interface feel

Focus only on:

clean structure
consistent spacing
reusable components
developer-ready frames