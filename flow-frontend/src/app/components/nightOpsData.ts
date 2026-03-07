// FLOW — Night Ops: Driver survival infrastructure
// Curated nodes a driver actually needs at 3:00 AM.
// Categories restricted to what matters during a night shift.
// No fluff. Real addresses. Real knowledge.

export type NightOpsCategory = "toilet_24h" | "food_24h" | "gas_ev_24h" | "safe_zone";

export interface NightOpsNode {
  id: string;
  category: NightOpsCategory;
  name: string;
  address: string;
  zone: string;           // matches signal zones
  lat: number;
  lng: number;
  hours: string;          // e.g. "24/7" or "22:00-06:00"
  note?: string;          // driver-specific intel
  verified: boolean;      // community-verified
}

export const NIGHT_OPS_CATEGORIES: Record<NightOpsCategory, { label: string; icon: string; color: string }> = {
  toilet_24h:  { label: "WC",       icon: "droplet",    color: "#4a7aaa" },
  food_24h:    { label: "FOOD",     icon: "coffee",     color: "#C9A24A" },
  gas_ev_24h:  { label: "ENERGY",   icon: "zap",        color: "#00B14F" },
  safe_zone:   { label: "SAFE",     icon: "shield",     color: "#8a8890" },
};

// ── Curated Paris night infrastructure ──
// Real locations that drivers actually use at 3 AM

export const NIGHT_OPS_NODES: NightOpsNode[] = [
  // ─── TOILET 24H ───
  {
    id: "wc-chatelet",
    category: "toilet_24h",
    name: "Sanisette Chatelet",
    address: "Place du Chatelet, 75001",
    zone: "Chatelet",
    lat: 48.8584,
    lng: 2.3474,
    hours: "24/7",
    note: "Fiable. Bien eclairee.",
    verified: true,
  },
  {
    id: "wc-republique",
    category: "toilet_24h",
    name: "Sanisette Republique",
    address: "Place de la Republique, 75011",
    zone: "Oberkampf",
    lat: 48.8675,
    lng: 2.3637,
    hours: "24/7",
    note: "Fonctionnelle la nuit",
    verified: true,
  },
  {
    id: "wc-bastille",
    category: "toilet_24h",
    name: "Sanisette Bastille",
    address: "Bd Richard-Lenoir, 75011",
    zone: "Bastille",
    lat: 48.8533,
    lng: 2.3692,
    hours: "24/7",
    note: "Cote canal, bien eclairee",
    verified: true,
  },
  {
    id: "wc-opera",
    category: "toilet_24h",
    name: "Sanisette Opera",
    address: "Bd des Capucines, 75009",
    zone: "Opera",
    lat: 48.8706,
    lng: 2.3318,
    hours: "24/7",
    verified: true,
  },
  {
    id: "wc-montmartre",
    category: "toilet_24h",
    name: "Sanisette Anvers",
    address: "Sq. d'Anvers, 75009",
    zone: "Montmartre",
    lat: 48.8831,
    lng: 2.3449,
    hours: "24/7",
    note: "En bas de la butte",
    verified: true,
  },

  // ─── FOOD 24H ───
  {
    id: "food-kebab-gdn",
    category: "food_24h",
    name: "Istanbul Kebab",
    address: "18 Bd de Denain, 75010",
    zone: "Gare du Nord",
    lat: 48.8805,
    lng: 2.3555,
    hours: "24/7",
    note: "Reference chauffeurs. Stationnement facile",
    verified: true,
  },
  {
    id: "food-mcdrive-porte-italie",
    category: "food_24h",
    name: "McDonald's Drive",
    address: "Porte d'Italie, 75013",
    zone: "Montparnasse",
    lat: 48.8180,
    lng: 2.3560,
    hours: "24/7",
    note: "Drive accessible VTC. Rapide apres minuit",
    verified: true,
  },
  {
    id: "food-boulangerie-bastille",
    category: "food_24h",
    name: "Boulangerie du Faubourg",
    address: "71 Rue du Faubourg Saint-Antoine, 75011",
    zone: "Bastille",
    lat: 48.8522,
    lng: 2.3720,
    hours: "04:00-21:00",
    note: "Ouvre a 4h. Croissants frais",
    verified: true,
  },
  {
    id: "food-kebab-pigalle",
    category: "food_24h",
    name: "Anatolie Grill",
    address: "42 Bd de Clichy, 75018",
    zone: "Pigalle",
    lat: 48.8828,
    lng: 2.3340,
    hours: "11:00-06:00",
    note: "Ouvert tard. Zone animee",
    verified: true,
  },
  {
    id: "food-paul-cdg",
    category: "food_24h",
    name: "Paul Terminal 2E",
    address: "CDG Terminal 2E, 95700",
    zone: "CDG",
    lat: 49.0097,
    lng: 2.5479,
    hours: "04:00-23:00",
    note: "Acces zone arrivees. Cafe correct",
    verified: true,
  },

  // ─── GAS / EV 24H ───
  {
    id: "gas-total-porte-maillot",
    category: "gas_ev_24h",
    name: "TotalEnergies Porte Maillot",
    address: "2 Bd Gouvion-Saint-Cyr, 75017",
    zone: "Trocadero",
    lat: 48.8778,
    lng: 2.2828,
    hours: "24/7",
    note: "Boutique ouverte la nuit. Bon cafe",
    verified: true,
  },
  {
    id: "gas-bp-nation",
    category: "gas_ev_24h",
    name: "BP Nation",
    address: "Place de la Nation, 75012",
    zone: "Bastille",
    lat: 48.8482,
    lng: 2.3960,
    hours: "24/7",
    note: "Rapide. Peu de queue la nuit",
    verified: true,
  },
  {
    id: "ev-tesla-bercy",
    category: "gas_ev_24h",
    name: "Tesla Supercharger Bercy",
    address: "Cour Saint-Emilion, 75012",
    zone: "Gare de Lyon",
    lat: 48.8340,
    lng: 2.3870,
    hours: "24/7",
    note: "8 bornes. 20min charge pendant pause",
    verified: true,
  },
  {
    id: "ev-ionity-defense",
    category: "gas_ev_24h",
    name: "Ionity La Defense",
    address: "Centre commercial Les 4 Temps",
    zone: "La Defense",
    lat: 48.8920,
    lng: 2.2384,
    hours: "24/7",
    note: "Parking sous-terrain. 350kW",
    verified: true,
  },

  // ─── SAFE ZONES ───
  {
    id: "safe-champs",
    category: "safe_zone",
    name: "Avenue Champs-Elysees",
    address: "Champs-Elysees, 75008",
    zone: "Opera",
    lat: 48.8698,
    lng: 2.3075,
    hours: "24/7",
    note: "Large avenue eclairee. Presence police. Stationnement tolere cote pair",
    verified: true,
  },
  {
    id: "safe-invalides",
    category: "safe_zone",
    name: "Esplanade des Invalides",
    address: "Esplanade des Invalides, 75007",
    zone: "Trocadero",
    lat: 48.8567,
    lng: 2.3124,
    hours: "24/7",
    note: "Tres calme la nuit. Eclairage correct. Pas de PV",
    verified: true,
  },
  {
    id: "safe-quai-seine",
    category: "safe_zone",
    name: "Quai Henri IV",
    address: "Quai Henri IV, 75004",
    zone: "Bastille",
    lat: 48.8502,
    lng: 2.3605,
    hours: "24/7",
    note: "Bord de Seine. Vue degagee. Chauffeurs se retrouvent ici",
    verified: true,
  },
  {
    id: "safe-bercy-village",
    category: "safe_zone",
    name: "Bercy Village",
    address: "Cour Saint-Emilion, 75012",
    zone: "Gare de Lyon",
    lat: 48.8340,
    lng: 2.3870,
    hours: "24/7",
    note: "Zone pietonne. Calme apres 2h. Bon spot de pause",
    verified: true,
  },
];

// ── Helper: get nodes near a zone ──

export function getNightOpsNearZone(zone: string, maxResults = 4): NightOpsNode[] {
  // First: exact zone match
  const exact = NIGHT_OPS_NODES.filter(n => n.zone === zone);
  if (exact.length >= maxResults) return exact.slice(0, maxResults);

  // Fill with nearby zones (simple heuristic: adjacent popular zones)
  const adjacency: Record<string, string[]> = {
    "Chatelet": ["Marais", "Opera", "Bastille"],
    "Bastille": ["Marais", "Chatelet", "Oberkampf", "Gare de Lyon"],
    "Opera": ["Chatelet", "Grands Boulevards", "Montmartre", "Pigalle"],
    "Gare du Nord": ["Montmartre", "Pigalle", "Villette"],
    "Montmartre": ["Pigalle", "Gare du Nord", "Opera"],
    "Pigalle": ["Montmartre", "Opera", "Gare du Nord"],
    "Marais": ["Chatelet", "Bastille", "Oberkampf"],
    "Oberkampf": ["Bastille", "Marais", "Gare du Nord"],
    "Gare de Lyon": ["Bastille", "Chatelet"],
    "La Defense": ["Trocadero"],
    "Trocadero": ["Opera", "La Defense"],
    "Montparnasse": ["Chatelet", "Trocadero"],
    "CDG": ["Gare du Nord", "Villette"],
    "Orly": ["Montparnasse"],
    "Villette": ["Gare du Nord", "Oberkampf"],
    "Grands Boulevards": ["Opera", "Montmartre"],
    "Saint-Denis": ["Gare du Nord", "Villette"],
  };

  const nearby = adjacency[zone] ?? [];
  const nearbyNodes = NIGHT_OPS_NODES.filter(n => nearby.includes(n.zone));
  const combined = [...exact, ...nearbyNodes];

  // Deduplicate
  const seen = new Set<string>();
  const result: NightOpsNode[] = [];
  for (const n of combined) {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      result.push(n);
    }
  }

  return result.slice(0, maxResults);
}

// ── Helper: simulated driver count per zone (Heat Swarm) ──

export function simulateDriverCounts(hour: number): Record<string, number> {
  // Simulated supply density. In production this would come from telemetry.
  const base: Record<string, number> = {
    "CDG": 12,
    "Saint-Denis": 3,
    "Villette": 5,
    "Gare du Nord": 18,
    "Montmartre": 8,
    "Pigalle": 15,
    "Opera": 22,
    "Grands Boulevards": 10,
    "Chatelet": 25,
    "Marais": 12,
    "Bastille": 20,
    "Oberkampf": 14,
    "Gare de Lyon": 16,
    "La Defense": 6,
    "Trocadero": 8,
    "Montparnasse": 11,
    "Orly": 9,
  };

  // Adjust by time of night
  const nightMultiplier = hour >= 2 && hour < 6 ? 0.4
    : hour >= 22 || hour < 2 ? 1.2
    : hour >= 18 ? 0.9
    : 0.6;

  const result: Record<string, number> = {};
  for (const [zone, count] of Object.entries(base)) {
    // Add some noise
    const noise = Math.sin(Date.now() / 30000 + zone.length * 7) * 0.2 + 1;
    result[zone] = Math.max(1, Math.round(count * nightMultiplier * noise));
  }

  return result;
}

// ── Helper: micro-predictions ──

export function microPrediction(zone: string, confidence: number, demandLevel: string | undefined): number {
  // Estimated rides in next 20 min based on confidence + demand
  const basePrediction = confidence >= 0.85 ? 18
    : confidence >= 0.7 ? 12
    : confidence >= 0.55 ? 7
    : 3;

  const demandMultiplier = demandLevel === "very_high" ? 1.5
    : demandLevel === "high" ? 1.2
    : demandLevel === "moderate" ? 1.0
    : 0.6;

  // Zone size factor
  const zoneMultiplier = ["Chatelet", "Bastille", "Opera", "Gare du Nord"].includes(zone) ? 1.3
    : ["CDG", "Orly"].includes(zone) ? 0.8
    : 1.0;

  return Math.max(2, Math.round(basePrediction * demandMultiplier * zoneMultiplier));
}
