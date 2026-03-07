Yes. Here is the **full taxonomy for Forced Mobility Waves** in Flow.

This should become a real internal model, because it’s one of the strongest ideas in the product.

# Core definition

A **Forced Mobility Wave** happens when:

* a group of people is released
* normal transport is weakened, saturated, delayed, or gone
* time pressure pushes them toward taxi/VTC

Formula:

`People Released × Transport Weakness × Time Pressure × Ride Quality Modifier`

This is what converts “activity” into **actual ride demand**.

---

# 1. Station Release Waves

## Definition

Train passengers arriving in bursts at major stations.

## Trigger sources

* SNCF / Navitia arrivals
* count of arrivals in next 15–30 min
* train type
* delay status

## Strong subtypes

* `station_international_release`
* `station_tgv_release`
* `station_late_release`
* `station_delay_release`

## Examples

* Gare du Nord Eurostar + Thalys
* Gare de Lyon TGV Sud-Est
* Montparnasse TGV Ouest

## Key modifiers

* luggage probability
* international passengers
* arrival clustering
* late hour
* metro weakness

## Ride profile

* long rides
* hotel rides
* suburb rides
* premium probability higher than average

## Flow output example

**Gare du Nord**
Eurostar + Thalys release
00:40–01:05
Metro faible — courses longues probables

---

# 2. Airport Release Waves

## Definition

Passenger banks exiting terminals, especially when landing clusters occur.

## Trigger sources

* ADP arrivals
* terminal arrival banks
* international vs domestic mix
* late-night arrival density

## Strong subtypes

* `airport_longhaul_release`
* `airport_terminal_bank`
* `airport_late_arrival_release`
* `airport_disrupted_release`

## Key modifiers

* terminal type
* long-haul ratio
* baggage delay
* late-night public transport weakness
* weather

## Ride profile

* very long rides
* luggage-heavy rides
* hotel / business destination rides
* premium conversion higher

## Flow output example

**CDG T2E**
Arrivées long-courrier
06:20–07:10
Flux élevé — courses longues garanties

---

# 3. Event Exit + Transit Weakness

## Definition

A structured event ends and public transport is weak enough that the crowd converts into rides.

## Trigger sources

* concert/match/show end time
* venue capacity
* exit window
* metro / RER availability
* weather

## Strong subtypes

* `arena_exit_forced`
* `stadium_exit_forced`
* `theatre_exit_forced`
* `expo_exit_forced`

## Key modifiers

* audience size
* simultaneous exit
* nearest metro quality
* weather multiplier
* area congestion
* ending after 23:00 / after last metro

## Ride profile

* mixed rides
* medium and long rides
* short burst but high intensity

## Flow output example

**Accor Arena**
Sortie concert + métro faible
22:50–23:25
Fort taux de conversion VTC

---

# 4. Nightlife Closure Waves

## Definition

Bars, clubs, and nightlife districts release people in stages after transit options degrade.

## Trigger sources

* nightlife district close windows
* club close times
* last metro / night transport quality
* weekend pattern
* weather

## Strong subtypes

* `bar_closure_wave`
* `club_closure_wave`
* `nightlife_cascade_wave`
* `last_metro_miss_wave`

## Key modifiers

* district density
* late-night hour
* weather
* weekend
* short-ride saturation risk
* local driver density

## Ride profile

* many short rides
* some medium rides
* high frequency, lower average ticket unless premium district

## Flow output example

**Pigalle**
Fermeture clubs après derniers métros
04:10–05:15
Courses courtes rapides — fréquence forte

---

# 5. Banlieue Return Constraint Waves

## Definition

An event ends in an area where return options are weak, sparse, or dead.

## Trigger sources

* banlieue venue end time
* RER / night bus weakness
* remote location
* event size

## Strong subtypes

* `banlieue_festival_release`
* `banlieue_wedding_release`
* `banlieue_expo_release`
* `remote_event_release`

## Key modifiers

* remoteness
* return transport weakness
* hour
* audience purchasing power
* weather
* competition scarcity

## Ride profile

* high-value long rides
* lower competition
* very strong niche opportunities

## Flow output example

**Villepinte**
Fin festival + retour faible
05:00–06:20
Courses longues Paris — concurrence faible

---

# 6. Office Release Waves

## Definition

Professional / office districts releasing workers at predictable hours.

## Trigger sources

* office district rhythm
* weekday patterns
* rain
* strikes / transport friction

## Strong subtypes

* `office_evening_release`
* `business_district_release`
* `rain_office_release`

## Key modifiers

* weekday
* rain
* rail disruption
* La Défense / 8e / Opéra density

## Ride profile

* mixed rides
* medium fare
* reliable but less explosive than forced late-night releases

## Flow output example

**La Défense**
Sortie bureaux
18:40–19:20
Courses mixtes — demande régulière

---

# 7. Transport Disruption Spill Waves

## Definition

A major transit failure dumps people into forced alternatives.

## Trigger sources

* RATP / IDFM disruptions
* line closure
* strike windows
* station congestion

## Strong subtypes

* `metro_failure_spill`
* `rer_failure_spill`
* `strike_spill_wave`

## Key modifiers

* size of affected line
* hour
* nearby districts
* rain
* event overlap

## Ride profile

* highly reactive demand
* chaotic but lucrative
* short and medium rides, sometimes bursts of long rides

## Flow output example

**République / Bastille**
Ligne perturbée + pluie
Demande reportée VTC
19:10–20:00

---

# 8. Compound Forced Mobility Waves

## Definition

When two or more release mechanisms overlap.

These are your highest-value signals.

## Strong subtypes

* `station_release_plus_rain`
* `event_exit_plus_last_metro`
* `airport_arrivals_plus_strike`
* `nightlife_closure_plus_rain`
* `banlieue_event_plus_no_return`

## Example

* Eurostar arrivals at 00:45
* rain
* weak onward transport

This is much stronger than each factor alone.

## Flow output example

**Gare du Nord**
Eurostar release + pluie + métro faible
00:40–01:10
Conversion VTC très forte

---

# Taxonomy fields for each wave

Use one unified schema:

```ts
type ForcedMobilityWave = {
  id: string
  category:
    | "station_release"
    | "airport_release"
    | "event_exit"
    | "nightlife_closure"
    | "banlieue_return_constraint"
    | "office_release"
    | "transport_disruption"
    | "compound"
  subtype: string
  zone: string
  venue?: string
  wave_start: string
  wave_end: string
  people_released_score: number
  transport_weakness_score: number
  time_pressure_score: number
  ride_quality_score: number
  final_forced_mobility_score: number
  likely_ride_profile:
    | "short_fast"
    | "mixed"
    | "long"
    | "premium_long"
  positioning_hint: string
  confidence: "low" | "medium" | "high"
  factors: string[]
}
```

---

# Recommended scoring dimensions

## A. People Released Score

Measures how many people are injected into the zone.

Inputs:

* train count
* venue capacity
* arrival bank size
* district closure density

Scale: 0–100

## B. Transport Weakness Score

Measures how weak alternatives are.

Inputs:

* last metro window
* RER / metro disruption
* remoteness
* night bus weakness

Scale: 0–100

## C. Time Pressure Score

Measures urgency.

Inputs:

* late hour
* stranded probability
* proximity to closure
* luggage / fatigue / weather pressure

Scale: 0–100

## D. Ride Quality Score

Measures desirability of resulting rides.

Inputs:

* long-ride probability
* premium probability
* luggage
* business/international audience
* low competition

Scale: 0–100

## Final score

At first keep it simple:

`0.35 * released + 0.30 * transport_weakness + 0.20 * time_pressure + 0.15 * ride_quality`

Then later boost compounds.

---

# Priority order in Flow

If two signals compete, prioritize roughly like this:

1. compound forced mobility
2. airport late release
3. station late international release
4. banlieue no-return release
5. stadium/arena exit with weak transit
6. nightlife closure
7. office release

That ordering is closer to **actual conversion quality**.

---

# How it should appear in Flow

## LIVE

Concrete and compressed.

Examples:

* **Gare du Nord — release Eurostar**
* **CDG T2E — arrivées long-courrier**
* **Pigalle — fin clubs après derniers métros**
* **Villepinte — retour faible après événement**

## CARTE

Show as pressure fields + ride type hints.

## SEMAINE

Summarize structurally:

* “Vendredi–samedi: fermeture nightlife + faibles alternatives”
* “Lundi matin: gares structurantes”
* “Banlieue forte samedi aube”

---

# The strategic insight

This taxonomy is powerful because it models the difference between:

* **activity**
  and
* **ride conversion**

That is the whole game.

A restaurant being full is not enough.
A concert ending is not enough.
Rain is not enough.

But:

**people released + weak alternatives + urgency**
is what creates real taxi/VTC demand.

That’s why this should become one of Flow’s core internal systems.

If you want, I can turn this into a **direct Claude-ready implementation spec** with file names, TS types, scoring functions, and UI mapping.
