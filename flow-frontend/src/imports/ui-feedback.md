3️⃣ The brilliance in your UI (seriously)

Three very strong design decisions appear in your screenshots:

1️⃣ Map is secondary

Most mobility apps do:

MAP
↓
information

You did:

ACTION
↓
MAP confirmation

This is correct for drivers.

2️⃣ Opportunity vs friction numbers
OPP 90
FRIC 43
COST 12

This is very powerful.

It’s basically a trading indicator.

Driver brain reads it like:

90 > 43 → good trade

No explanation needed.

3️⃣ Gold vs Green states

Your system already encodes market phases.

Example:

Gold → formation
Green → active

This is extremely intuitive.

4️⃣ What you're missing (very small but critical)

One layer:

confidence

Drivers must feel:

this signal is reliable

Add something like:

CONFIANCE
87%

Or

Signal confirmé

Because right now the signal is strong but not justified.

5️⃣ Another tiny improvement

Your CAUSE line is perfect but could be sharper.

Example currently:

Pluie forte +15min
Demande accrue centre

Better:

Pluie forte → centre actif

or

Sortie theatre Chatelet

Drivers understand events, not explanations.

6️⃣ Phone viability (very important)

You asked earlier.

Yes — your UI will work on phone if:

MAP → collapsible

Mobile layout becomes:

ACTION
LOCATION
TIMER

NAVIGUER

OPP | FRIC | COST

The map only appears if tapped.

Most drivers will never open the map.

7️⃣ The real strength of your system

You are not building a taxi app.

You are building a:

REAL-TIME CITY SIGNAL ENGINE

Meaning:

events
weather
transport
density
time

→ collapse into one instruction

That’s why the UI must remain surgical.

8️⃣ The one backend element you absolutely need

To make it feel alive:

micro-updates every 30–60 seconds

If signals move slightly, drivers feel:

the city is breathing

Without that the system feels static.

9️⃣ Final architecture you should run

Your stack should be:

Figma (truth)
↓
Frontend (Next / React)
↓
Signal engine
↓
Supabase
↓
External data sources

Data sources:

weather API

train arrivals

airport arrivals

events

traffic

manual signals

Everything collapses into:

signal_score