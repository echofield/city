/**
 * PROFILE-INTERPRETER System Prompt
 * Classifies driver profiles into variants and computes personalization weights
 */

export const PROFILE_INTERPRETER_SYSTEM = `ROLE: PROFILE-INTERPRETER
You classify driver profiles into a small number of product variants and compute personalization weights.

AVAILABLE VARIANTS (do not create new ones)
- NIGHT_CHASER: Prefers evening/night shifts, events, nightlife areas
- SAFE_STEADY: Risk-averse, prefers predictable commute patterns, avoids friction
- AIRPORT_LONG: Focuses on CDG/Orly, prefers longer high-value rides
- EAST_NIGHTLIFE: Specializes in East Paris (Oberkampf, Bastille, Nation, République)
- WEST_BUSINESS: Focuses on La Défense, 8th, 16th, business clientele
- BALANCED: No strong preference, adapts to daily opportunities

WEIGHT DEFINITIONS (all 0.0 to 1.0)
- nightlife: Interest in bars, clubs, late-night pickup zones
- events_big: Interest in large events (concerts, sports, >5000 capacity)
- micro_events: Interest in small events (galleries, theaters, restaurants)
- commute: Interest in rush-hour commute patterns
- airport: Interest in airport runs (CDG, Orly)
- business: Interest in business districts and corporate clientele
- rain_uplift: Willingness to work during bad weather for surge
- friction_avoidance: Preference to avoid traffic, protests, roadworks
- dead_km_penalty: Sensitivity to empty repositioning kilometers
- saturation_penalty: Aversion to crowded hotspots

MAPPING RULES
- "I hate traffic" → high friction_avoidance (0.8+), high dead_km_penalty
- "I work nights" → high nightlife (0.7+), low commute (0.2)
- "I prefer long rides" → high airport (0.7+), low micro_events
- "I want stability" → variant SAFE_STEADY, high commute, low events_big
- "I chase events" → variant NIGHT_CHASER, high events_big, high nightlife

OUTPUT FORMAT (STRICT JSON ONLY)
{
  "profile_variant": "NIGHT_CHASER|SAFE_STEADY|AIRPORT_LONG|EAST_NIGHTLIFE|WEST_BUSINESS|BALANCED",
  "weights": {
    "nightlife": 0.0-1.0,
    "events_big": 0.0-1.0,
    "micro_events": 0.0-1.0,
    "commute": 0.0-1.0,
    "airport": 0.0-1.0,
    "business": 0.0-1.0,
    "rain_uplift": 0.0-1.0,
    "friction_avoidance": 0.0-1.0,
    "dead_km_penalty": 0.0-1.0,
    "saturation_penalty": 0.0-1.0
  },
  "constraints": {
    "preferred_areas": ["area1", "area2"],
    "avoid_areas": ["area1"],
    "shift_window": {"start": "HH:MM", "end": "HH:MM"},
    "traffic_tolerance": "LOW|MED|HIGH"
  },
  "reasoning": "1-2 sentences explaining the classification"
}

IMPORTANT: Return ONLY the JSON object. No markdown, no explanation.`

export const PROFILE_INTERPRETER_USER_TEMPLATE = (
  onboardingAnswers: string,
  historicalBehavior?: string
) => `Interpret this driver profile:

ONBOARDING ANSWERS
${onboardingAnswers}

${historicalBehavior ? `HISTORICAL BEHAVIOR\n${historicalBehavior}` : ''}

Output the profile classification as JSON.`

/**
 * Onboarding questions that map to profile weights
 */
export const ONBOARDING_QUESTIONS = [
  {
    id: 'ride_preference',
    question: 'Tu préfères courses longues ou volume rapide ?',
    options: [
      { label: 'Longues courses (aéroports, banlieue)', maps_to: { airport: 0.8, micro_events: 0.2 } },
      { label: 'Volume rapide (centre ville)', maps_to: { airport: 0.2, micro_events: 0.7 } },
      { label: 'Mix équilibré', maps_to: { airport: 0.5, micro_events: 0.5 } },
    ],
  },
  {
    id: 'shift_timing',
    question: 'Tu conduis quand ça sort ou quand ça rentre ?',
    options: [
      { label: 'Matin (ça rentre au travail)', maps_to: { commute: 0.8, nightlife: 0.1 } },
      { label: 'Soir/Nuit (ça sort)', maps_to: { commute: 0.2, nightlife: 0.8 } },
      { label: 'Journée complète', maps_to: { commute: 0.5, nightlife: 0.5 } },
    ],
  },
  {
    id: 'traffic_tolerance',
    question: 'Tu évites le trafic ou tu l\'assumes ?',
    options: [
      { label: 'J\'évite absolument', maps_to: { friction_avoidance: 0.9, traffic_tolerance: 'LOW' } },
      { label: 'Je gère si ça vaut le coup', maps_to: { friction_avoidance: 0.5, traffic_tolerance: 'MED' } },
      { label: 'Le trafic ne me dérange pas', maps_to: { friction_avoidance: 0.2, traffic_tolerance: 'HIGH' } },
    ],
  },
  {
    id: 'risk_appetite',
    question: 'Tu veux stabilité ou pics ?',
    options: [
      { label: 'Stabilité prévisible', maps_to: { events_big: 0.3, saturation_penalty: 0.7 } },
      { label: 'Je chasse les pics (events, surge)', maps_to: { events_big: 0.8, saturation_penalty: 0.3 } },
      { label: 'Mix des deux', maps_to: { events_big: 0.5, saturation_penalty: 0.5 } },
    ],
  },
  {
    id: 'weather_work',
    question: 'Tu travailles quand il pleut ?',
    options: [
      { label: 'Oui, c\'est là que ça surge', maps_to: { rain_uplift: 0.9 } },
      { label: 'Parfois', maps_to: { rain_uplift: 0.5 } },
      { label: 'Non, trop dangereux', maps_to: { rain_uplift: 0.1 } },
    ],
  },
]
