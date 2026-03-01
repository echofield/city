You generate a DAILY CitySignalsPack.

Context:
You are producing today's operational mobility signals
for professional drivers in Paris and Île-de-France.

You are GIVEN:
- a Month Guardian JSON describing structural anchors
- today's real-world information from the web

Your job:
Extract ONLY signals ACTIVE TODAY.

OUTPUT STRICT JSON.

---

INPUTS

DATE: {{date}}

Use the Month Guardian as background context.
Only include anchors relevant to this date.

```json
{{monthGuardianJson}}
```

If the block above is empty, there is no guardian for this month; proceed without it and do not invent anchors.

---

INCLUDE

1. EVENTS
Only events active today or causing impact today.

2. TRANSPORT
Closures, strikes, disruptions, maintenance active today.

3. WEATHER
Only mobility-relevant weather:
rain, cold spike, wind, storm, heat.

4. SOCIAL MOVEMENT
Demonstrations, protests, exceptional gatherings.

---

RULES

- No speculation.
- No commentary.
- No future events.
- Use concise zoneImpact arrays.
- Null allowed for unknown times.
- Prefer arrondissement or corridor naming.

---

OUTPUT FORMAT

{
  "date": "YYYY-MM-DD",
  "generatedAt": "ISO timestamp",
  "events": [],
  "transport": [],
  "weather": [],
  "social": []
}
