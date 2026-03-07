Goal: Refine the FLOW driver interface to prioritize actionable, real-world triggers instead of generic signals.

Principles:

* Drivers must understand the opportunity in less than 1 second.
* Replace vague indicators with concrete event causes.
* The interface should behave like a proximity radar around the driver.

Changes to implement:

1. Replace generic signals like:
   “Demande accrue centre” or “Pluie +15min”

   With structured triggers such as:

   * “Sortie Théâtre Châtelet · ~900 personnes · 4 min”
   * “Arrivée TGV Gare du Nord · 12 trains · 8 min”
   * “Fin concert La Cigale · ~1200 personnes · 6 min”

2. Introduce a proximity radar layer:
   Show nearby events within:

   * 500 m
   * 1 km
   * 2 km

3. When a driver is near an event zone, display a contextual radar panel showing:

   * venue name
   * type (theatre, concert, train arrival, nightlife cluster)
   * expected exit time
   * estimated crowd size

4. Monetary indicators like “+2€ / +3€” should be removed or minimized.
   Decision drivers should instead focus on:

   * crowd magnitude
   * timing window
   * proximity

5. Maintain the core action hierarchy:
   ACTION
   LOCATION
   CAUSE

Example main instruction:

SE POSITIONNER
Châtelet

Cause:
Sortie Théâtre Châtelet
~900 personnes · 4 min
