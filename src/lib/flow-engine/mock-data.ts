/**
 * Mock data for testing the FLOW Intelligence Engine
 * Use this for development and visual audits
 */

import type { CitySignalsPack, DriverProfile, CompiledBrief } from '../prompts/contracts'

// ============================================
// MOCK DRIVER PROFILE: NIGHT_CHASER
// ============================================

export const MOCK_PROFILE_NIGHT_CHASER: DriverProfile = {
  user_id: 'mock-user-001',
  profile_variant: 'NIGHT_CHASER',
  weights: {
    nightlife: 0.85,
    events_big: 0.80,
    micro_events: 0.40,
    commute: 0.20,
    airport: 0.30,
    business: 0.25,
    rain_uplift: 0.70,
    friction_avoidance: 0.50,
    dead_km_penalty: 0.60,
    saturation_penalty: 0.55,
  },
  constraints: {
    preferred_areas: ['Bastille', 'Oberkampf', 'République', 'Pigalle', 'Marais'],
    avoid_areas: ['La Défense'],
    shift_window: { start: '18:00', end: '04:00' },
    traffic_tolerance: 'MED',
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

export const MOCK_PROFILE_AIRPORT: DriverProfile = {
  user_id: 'mock-user-002',
  profile_variant: 'AIRPORT_LONG',
  weights: {
    nightlife: 0.20,
    events_big: 0.40,
    micro_events: 0.15,
    commute: 0.50,
    airport: 0.90,
    business: 0.70,
    rain_uplift: 0.40,
    friction_avoidance: 0.70,
    dead_km_penalty: 0.30,
    saturation_penalty: 0.40,
  },
  constraints: {
    preferred_areas: ['CDG', 'Orly', 'Gare du Nord', 'Gare de Lyon'],
    avoid_areas: ['Pigalle', 'Oberkampf'],
    shift_window: { start: '05:00', end: '22:00' },
    traffic_tolerance: 'HIGH',
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// ============================================
// MOCK CITY SIGNALS PACK
// ============================================

export const MOCK_SIGNALS_PACK: CitySignalsPack = {
  context: {
    timezone: 'Europe/Paris',
    generated_at: new Date().toISOString(),
    horizon: '24h',
  },
  weather: {
    summary: 'Temps nuageux, pluie légère en soirée (18h-22h), 12°C',
    hourly: [
      { hour: '18:00', temp_c: 12, rain_mm: 0.5, wind_kmh: 15 },
      { hour: '19:00', temp_c: 11, rain_mm: 1.2, wind_kmh: 18 },
      { hour: '20:00', temp_c: 10, rain_mm: 2.0, wind_kmh: 20 },
      { hour: '21:00', temp_c: 10, rain_mm: 1.5, wind_kmh: 18 },
      { hour: '22:00', temp_c: 9, rain_mm: 0.8, wind_kmh: 15 },
      { hour: '23:00', temp_c: 9, rain_mm: 0.2, wind_kmh: 12 },
    ],
    sources: [{ url: 'https://meteofrance.com', publisher: 'Météo France', ts: new Date().toISOString() }],
  },
  events: [
    {
      category: 'CONCERT',
      name: 'Phoenix - Concert Accor Arena',
      venue: 'Accor Arena',
      area: 'Bercy',
      start: '20:00',
      end: '23:00',
      capacity_band: 'LARGE',
      confidence: 0.95,
      sources: [{ url: 'https://accor-arena.com', publisher: 'Accor Arena', ts: new Date().toISOString() }],
    },
    {
      category: 'SPORT',
      name: 'PSG vs Monaco - Ligue 1',
      venue: 'Parc des Princes',
      area: '16ème',
      start: '21:00',
      end: '23:00',
      capacity_band: 'LARGE',
      confidence: 0.98,
      sources: [{ url: 'https://psg.fr', publisher: 'PSG', ts: new Date().toISOString() }],
    },
    {
      category: 'NIGHTLIFE',
      name: 'Soirée Rex Club',
      venue: 'Rex Club',
      area: 'Grands Boulevards',
      start: '23:00',
      end: '06:00',
      capacity_band: 'MED',
      confidence: 0.85,
      sources: [{ url: 'https://rexclub.com', publisher: 'Rex Club', ts: new Date().toISOString() }],
    },
    {
      category: 'EXHIBITION',
      name: 'Vernissage Palais de Tokyo',
      venue: 'Palais de Tokyo',
      area: '16ème',
      start: '18:00',
      end: '22:00',
      capacity_band: 'MED',
      confidence: 0.80,
      sources: [{ url: 'https://palaisdetokyo.com', publisher: 'Palais de Tokyo', ts: new Date().toISOString() }],
    },
  ],
  demonstrations: [
    {
      area_or_route: 'Bastille → République via Richard-Lenoir',
      window: '14:00-18:00',
      impact: 'HIGH',
      avoid_axes: ['Boulevard Beaumarchais', 'Boulevard Richard-Lenoir', 'Avenue de la République'],
      notes: ['Cortège prévu 15000 personnes', 'Dispersion prévue 18h'],
      confidence: 0.90,
      sources: [{ url: 'https://prefecture-police-paris.interieur.gouv.fr', publisher: 'Préfecture de Police', ts: new Date().toISOString() }],
    },
  ],
  roadworks: [
    {
      location: 'Tunnel des Halles - direction Châtelet',
      window: '22:00-06:00',
      impact: 'MED',
      notes: ['Travaux de nuit', 'Déviation par Sébastopol'],
      sources: [{ url: 'https://paris.fr', publisher: 'Ville de Paris', ts: new Date().toISOString() }],
    },
  ],
  transit: [
    {
      mode: 'METRO',
      line_or_station: 'Ligne 1 - La Défense → Châtelet',
      window: '20:00-23:00',
      impact: 'MED',
      notes: ['Travaux, trains toutes les 8 min au lieu de 3'],
      sources: [{ url: 'https://ratp.fr', publisher: 'RATP', ts: new Date().toISOString() }],
    },
    {
      mode: 'RER',
      line_or_station: 'RER A - trafic perturbé',
      window: '18:00-22:00',
      impact: 'HIGH',
      notes: ['Incident technique, forte affluence attendue sur Uber/VTC'],
      sources: [{ url: 'https://ratp.fr', publisher: 'RATP', ts: new Date().toISOString() }],
    },
  ],
}

// ============================================
// MOCK COMPILED BRIEF (expected output)
// ============================================

export const MOCK_COMPILED_BRIEF: CompiledBrief = {
  meta: {
    timezone: 'Europe/Paris',
    generated_at: new Date().toISOString(),
    run_mode: 'daily',
    profile_variant: 'NIGHT_CHASER',
    confidence_overall: 0.78,
  },

  // NOW BLOCK (0-45 min)
  now_block: {
    window: '0-15min',
    actions: [
      'Reste Gare du Nord',
      'RER A perturbé = demande forte',
      'Pluie dans 20min',
    ],
    zones: ['Gare du Nord', 'Gare de l\'Est'],
    rule: 'Si attente > 10min → basculer Magenta',
    micro_alerts: [
      { type: 'surge', message: 'Surge +1.3x Gare du Nord', expires_in_min: 12 },
      { type: 'weather', message: 'Pluie légère dans 20min', expires_in_min: 20 },
    ],
    confidence: 0.82,
  },

  // NEXT BLOCK (45-180 min)
  next_block: {
    slots: [
      { window: '19:00-20:00', zone: 'Marais', reason: 'Sorties restaurants + pluie', saturation: 'LOW', confidence: 0.75 },
      { window: '20:00-21:00', zone: 'Opéra', reason: 'Théâtres + vernissages', saturation: 'MED', confidence: 0.70 },
      { window: '21:00-22:00', zone: 'Bercy', reason: 'Pré-concert Phoenix', saturation: 'MED', confidence: 0.85 },
    ],
    key_transition: 'Flux shift: Gares → Est parisien à 20h30',
  },

  // HORIZON BLOCK (180min - 8h)
  horizon_block: {
    hotspots: [
      { zone: 'Bercy', window: '22:30-23:30', score: 92, why: 'Concert Phoenix 20k pers' },
      { zone: 'Porte de Saint-Cloud', window: '23:00-00:00', score: 88, why: 'Match PSG' },
      { zone: 'Grands Boulevards', window: '01:00-03:00', score: 72, why: 'Rex Club sortie' },
    ],
    rules: [
      'Saturation Bercy > 80% → Nation/Gare de Lyon',
      'Sortie concert → arriver 15min avant',
      'Après 01h → focus Pigalle/Oberkampf',
    ],
    expected_peaks: ['22:45 Bercy', '23:15 PSG', '01:30 clubs'],
  },

  summary: [
    'Positionne-toi Bercy 22h30 (fin concert Phoenix)',
    'Évite Bastille-République 14h-18h (manifestation)',
    'Surge probable Parc des Princes 23h',
    'Pluie 18h-22h = demande forte',
    'RER A perturbé = opportunité gares',
    'Split Bercy/Nation pour éviter saturation',
  ],
  timeline: [
    {
      start: '18:00',
      end: '20:00',
      primary_zone: 'Gare du Nord',
      reason: 'RER A perturbé, report sur gares',
      confidence: 0.75,
      best_arrival: '17:45',
      best_exit: '19:30',
      saturation_risk: 'MED',
      alternatives: ['Gare de Lyon', 'Gare de l\'Est'],
      avoid_axes: [],
    },
    {
      start: '20:00',
      end: '22:00',
      primary_zone: 'Marais',
      reason: 'Pluie + sorties restaurants',
      confidence: 0.70,
      best_arrival: '19:45',
      best_exit: '21:30',
      saturation_risk: 'LOW',
      alternatives: ['Saint-Germain', 'Odéon'],
      avoid_axes: [],
    },
    {
      start: '22:00',
      end: '00:00',
      primary_zone: 'Bercy',
      reason: 'Sortie concert Phoenix (20000 pers)',
      confidence: 0.90,
      best_arrival: '22:15',
      best_exit: '23:45',
      saturation_risk: 'HIGH',
      alternatives: ['Nation', 'Gare de Lyon'],
      avoid_axes: ['Quai de Bercy (congestion)'],
    },
    {
      start: '23:00',
      end: '01:00',
      primary_zone: 'Porte de Saint-Cloud',
      reason: 'Sortie match PSG',
      confidence: 0.85,
      best_arrival: '22:45',
      best_exit: '00:30',
      saturation_risk: 'HIGH',
      alternatives: ['Auteuil', 'Boulogne'],
      avoid_axes: ['Avenue du Parc des Princes'],
    },
    {
      start: '01:00',
      end: '04:00',
      primary_zone: 'Grands Boulevards',
      reason: 'Sortie clubs (Rex Club)',
      confidence: 0.65,
      best_arrival: '00:45',
      best_exit: '03:30',
      saturation_risk: 'MED',
      alternatives: ['Pigalle', 'Oberkampf'],
      avoid_axes: [],
    },
  ],
  hotspots: [
    {
      zone: 'Bercy',
      score: 92,
      window: '22:30–23:30',
      why: ['Concert Phoenix', '20000 pers', 'Pluie'],
      saturation_risk: 'HIGH',
      alternatives: ['Nation', 'Gare de Lyon'],
      pickup_notes: ['Éviter Quai de Bercy', 'Préférer côté Palais Omnisports'],
      signal_source: 'Public',
    },
    {
      zone: 'Porte de Saint-Cloud',
      score: 88,
      window: '22:45–23:45',
      why: ['Match PSG', '45000 pers'],
      saturation_risk: 'HIGH',
      alternatives: ['Auteuil', 'Boulogne'],
      pickup_notes: ['Zone piétonne autour stade', 'Attendre sortie Porte de Saint-Cloud'],
      signal_source: 'Public',
    },
    {
      zone: 'Gare du Nord',
      score: 75,
      window: '18:00–20:00',
      why: ['RER A perturbé', 'Report trafic'],
      saturation_risk: 'MED',
      alternatives: ['Gare de l\'Est', 'Magenta'],
      pickup_notes: ['Côté rue de Dunkerque moins saturé'],
      signal_source: 'Public',
    },
  ],
  alerts: [
    {
      type: 'DEMONSTRATION',
      severity: 'HIGH',
      window: '14:00-18:00',
      area: 'Bastille → République',
      avoid: ['Boulevard Beaumarchais', 'Richard-Lenoir', 'Avenue de la République'],
      opportunity: ['Nation', 'Belleville (report demande)'],
      notes: ['15000 personnes', 'Dispersion 18h'],
    },
    {
      type: 'TRANSIT',
      severity: 'HIGH',
      window: '18:00-22:00',
      area: 'RER A',
      avoid: [],
      opportunity: ['Gares principales', 'Ligne 1 stations'],
      notes: ['Forte demande VTC attendue'],
    },
    {
      type: 'WEATHER',
      severity: 'MED',
      window: '18:00-22:00',
      area: 'Paris intra-muros',
      avoid: [],
      opportunity: ['Surge pluie probable', '+15-25% tarifs estimés'],
      notes: ['Pluie modérée 18h-22h'],
    },
  ],
  rules: [
    { if: 'saturation Bercy > 80%', then: 'basculer vers Nation ou Gare de Lyon' },
    { if: 'pluie > 2mm/h', then: 'rester en zone couverte (gares, centres commerciaux)' },
    { if: 'sortie concert > 22h30', then: 'arriver 15min avant pour position' },
    { if: 'manifestation active', then: 'contourner par périphérique Est' },
    { if: 'RER perturbé', then: 'focus gares SNCF' },
  ],
  anti_clustering: {
    principle: 'Répartir les chauffeurs Flow pour éviter auto-saturation',
    dispatch_hint: [
      { hotspot: 'Bercy', split_into: ['Nation', 'Gare de Lyon'], reason: 'Concert = 20000 pers mais saturation chauffeurs probable' },
      { hotspot: 'Porte de Saint-Cloud', split_into: ['Auteuil', 'Boulogne'], reason: 'Match = zone limitée' },
    ],
  },
  validation: {
    unknowns: ['Affluence exacte manifestation', 'Durée perturbation RER A'],
    do_not_assume: ['Heure exacte fin concert', 'Score final match PSG'],
  },
  feedback: {
    last_7d_helpfulness: 0.72,
    yesterday_accuracy_estimate: 0.68,
    missed_opportunities: ['Bercy sortie tardive hier'],
    false_positives: [],
  },
}
