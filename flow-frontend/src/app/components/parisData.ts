// FLOW — Paris territory data
// 20 arrondissements + 2 islands, adjacency graph, spatial properties

export interface TerritoryDef {
  id: string;
  name: string;
  displayName: string;
  subtitle: string; // historical / atmospheric note
  center: [number, number];
  path: string; // SVG path
  neighbors: { id: string; bridge?: boolean }[];
  density: number; // 0-1, resistance to change
  culturalWeight: number; // 0-1, point value
  riverEdge: boolean;
}

// Helper to build SVG polygon path from points
function poly(pts: [number, number][]): string {
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") + " Z";
}

// Seine path for visual rendering (north bank and south bank)
export const SEINE_NORTH: [number, number][] = [
  [755, 445], [700, 420], [645, 398], [590, 378],
  [545, 362], [505, 350], [470, 342], [435, 338],
  [400, 338], [365, 342], [325, 355], [280, 378], [240, 405],
];

export const SEINE_SOUTH: [number, number][] = [
  [755, 468], [700, 445], [645, 423], [590, 404],
  [545, 390], [505, 380], [470, 374], [435, 370],
  [400, 370], [365, 374], [325, 387], [280, 408], [240, 432],
];

// The territories of Paris
// Coordinates in a 1000x700 viewBox
// Arrondissements spiral clockwise from center

export const TERRITORIES: TerritoryDef[] = [
  // ── 1er: Louvre, Châtelet ──
  {
    id: "1",
    name: "1er",
    displayName: "I",
    subtitle: "Louvre · Châtelet",
    center: [460, 315],
    path: poly([
      [425, 280], [495, 275], [505, 295], [505, 340],
      [470, 342], [435, 338], [420, 330],
    ]),
    neighbors: [
      { id: "2" }, { id: "4" }, { id: "8" }, { id: "9" },
      { id: "6", bridge: true }, { id: "7", bridge: true }, { id: "cite", bridge: true },
    ],
    density: 0.8,
    culturalWeight: 1.0,
    riverEdge: true,
  },
  // ── 2e: Bourse ──
  {
    id: "2",
    name: "2e",
    displayName: "II",
    subtitle: "Bourse · Sentier",
    center: [505, 268],
    path: poly([
      [495, 275], [480, 250], [515, 240], [540, 255],
      [535, 280], [505, 295],
    ]),
    neighbors: [{ id: "1" }, { id: "3" }, { id: "9" }, { id: "10" }],
    density: 0.7,
    culturalWeight: 0.5,
    riverEdge: false,
  },
  // ── 3e: Temple, Haut Marais ──
  {
    id: "3",
    name: "3e",
    displayName: "III",
    subtitle: "Temple · Haut Marais",
    center: [560, 300],
    path: poly([
      [535, 280], [540, 255], [575, 260], [595, 285],
      [585, 330], [555, 340], [540, 325],
    ]),
    neighbors: [{ id: "2" }, { id: "4" }, { id: "10" }, { id: "11" }],
    density: 0.75,
    culturalWeight: 0.7,
    riverEdge: false,
  },
  // ── 4e: Marais, Hôtel de Ville ──
  {
    id: "4",
    name: "4e",
    displayName: "IV",
    subtitle: "Marais · Hôtel de Ville",
    center: [555, 355],
    path: poly([
      [540, 325], [555, 340], [585, 330], [595, 355],
      [590, 378], [545, 362], [505, 350], [505, 340],
    ]),
    neighbors: [
      { id: "1" }, { id: "3" }, { id: "11" }, { id: "12" },
      { id: "5", bridge: true }, { id: "cite", bridge: true }, { id: "stlouis", bridge: true },
    ],
    density: 0.85,
    culturalWeight: 0.9,
    riverEdge: true,
  },
  // ── 5e: Panthéon, Latin Quarter ──
  {
    id: "5",
    name: "5e",
    displayName: "V",
    subtitle: "Panthéon · Quartier Latin",
    center: [530, 435],
    path: poly([
      [470, 374], [505, 380], [545, 390], [590, 404],
      [600, 440], [570, 475], [505, 470],
      [470, 448], [445, 420],
    ]),
    neighbors: [
      { id: "4", bridge: true }, { id: "6" }, { id: "13" }, { id: "14" },
      { id: "cite", bridge: true }, { id: "stlouis", bridge: true },
    ],
    density: 0.7,
    culturalWeight: 0.85,
    riverEdge: true,
  },
  // ── 6e: Luxembourg, Saint-Germain ──
  {
    id: "6",
    name: "6e",
    displayName: "VI",
    subtitle: "Luxembourg · Saint-Germain",
    center: [425, 425],
    path: poly([
      [400, 370], [435, 370], [470, 374], [445, 420],
      [470, 448], [440, 475], [395, 465],
      [370, 430], [365, 395],
    ]),
    neighbors: [
      { id: "1", bridge: true }, { id: "5" }, { id: "7" }, { id: "14" }, { id: "15" },
    ],
    density: 0.65,
    culturalWeight: 0.9,
    riverEdge: true,
  },
  // ── 7e: Tour Eiffel, Invalides ──
  {
    id: "7",
    name: "7e",
    displayName: "VII",
    subtitle: "Tour Eiffel · Invalides",
    center: [345, 395],
    path: poly([
      [325, 355], [365, 342], [400, 338], [400, 370],
      [365, 395], [370, 430], [340, 440],
      [300, 420], [280, 408], [280, 378],
    ]),
    neighbors: [
      { id: "1", bridge: true }, { id: "6" }, { id: "8", bridge: true },
      { id: "15" }, { id: "16", bridge: true },
    ],
    density: 0.5,
    culturalWeight: 0.95,
    riverEdge: true,
  },
  // ── 8e: Champs-Élysées ──
  {
    id: "8",
    name: "8e",
    displayName: "VIII",
    subtitle: "Champs-Élysées · Madeleine",
    center: [380, 285],
    path: poly([
      [340, 250], [395, 235], [425, 240], [425, 280],
      [420, 330], [400, 338], [365, 342],
      [325, 355], [310, 330], [320, 285],
    ]),
    neighbors: [
      { id: "1" }, { id: "7", bridge: true }, { id: "9" },
      { id: "16" }, { id: "17" },
    ],
    density: 0.4,
    culturalWeight: 0.85,
    riverEdge: true,
  },
  // ── 9e: Opéra ──
  {
    id: "9",
    name: "9e",
    displayName: "IX",
    subtitle: "Opéra · Grands Boulevards",
    center: [460, 240],
    path: poly([
      [425, 240], [395, 235], [400, 205], [440, 195],
      [480, 195], [480, 250], [495, 275], [425, 280],
    ]),
    neighbors: [
      { id: "1" }, { id: "2" }, { id: "8" }, { id: "10" },
      { id: "17" }, { id: "18" },
    ],
    density: 0.6,
    culturalWeight: 0.7,
    riverEdge: false,
  },
  // ── 10e: Canal Saint-Martin ──
  {
    id: "10",
    name: "10e",
    displayName: "X",
    subtitle: "Canal Saint-Martin · Gare du Nord",
    center: [540, 235],
    path: poly([
      [480, 195], [510, 185], [555, 190], [580, 210],
      [595, 250], [595, 285], [575, 260], [540, 255],
      [515, 240], [480, 250],
    ]),
    neighbors: [
      { id: "2" }, { id: "3" }, { id: "9" }, { id: "11" },
      { id: "18" }, { id: "19" },
    ],
    density: 0.55,
    culturalWeight: 0.5,
    riverEdge: false,
  },
  // ── 11e: Bastille, Oberkampf ──
  {
    id: "11",
    name: "11e",
    displayName: "XI",
    subtitle: "Bastille · Oberkampf",
    center: [620, 320],
    path: poly([
      [595, 285], [595, 250], [625, 245], [660, 270],
      [665, 320], [650, 360], [595, 355], [585, 330],
    ]),
    neighbors: [
      { id: "3" }, { id: "4" }, { id: "10" }, { id: "12" },
      { id: "19" }, { id: "20" },
    ],
    density: 0.6,
    culturalWeight: 0.6,
    riverEdge: false,
  },
  // ── 12e: Bercy, Bois de Vincennes ──
  {
    id: "12",
    name: "12e",
    displayName: "XII",
    subtitle: "Bercy · Nation",
    center: [690, 410],
    path: poly([
      [650, 360], [665, 320], [710, 310], [750, 360],
      [760, 420], [755, 445], [755, 468],
      [730, 505], [680, 480], [645, 423], [590, 404],
      [590, 378], [595, 355],
    ]),
    neighbors: [
      { id: "4" }, { id: "11" }, { id: "13", bridge: true },
      { id: "20" },
    ],
    density: 0.3,
    culturalWeight: 0.4,
    riverEdge: true,
  },
  // ── 13e: Gobelins, Bibliothèque ──
  {
    id: "13",
    name: "13e",
    displayName: "XIII",
    subtitle: "Gobelins · Bibliothèque",
    center: [590, 510],
    path: poly([
      [570, 475], [600, 440], [645, 423], [680, 480],
      [730, 505], [700, 560], [640, 580],
      [570, 560], [540, 520],
    ]),
    neighbors: [
      { id: "5" }, { id: "12", bridge: true }, { id: "14" },
    ],
    density: 0.35,
    culturalWeight: 0.35,
    riverEdge: true,
  },
  // ── 14e: Montparnasse ──
  {
    id: "14",
    name: "14e",
    displayName: "XIV",
    subtitle: "Montparnasse · Denfert",
    center: [465, 520],
    path: poly([
      [440, 475], [470, 448], [505, 470], [570, 475],
      [540, 520], [530, 570], [470, 590],
      [410, 575], [395, 530], [395, 465],
    ]),
    neighbors: [
      { id: "5" }, { id: "6" }, { id: "13" }, { id: "15" },
    ],
    density: 0.4,
    culturalWeight: 0.5,
    riverEdge: false,
  },
  // ── 15e: Vaugirard ──
  {
    id: "15",
    name: "15e",
    displayName: "XV",
    subtitle: "Vaugirard · Grenelle",
    center: [320, 475],
    path: poly([
      [340, 440], [370, 430], [365, 395], [395, 465],
      [395, 530], [410, 575], [360, 580],
      [290, 545], [255, 490], [248, 445],
      [280, 408], [300, 420],
    ]),
    neighbors: [
      { id: "6" }, { id: "7" }, { id: "14" }, { id: "16" },
    ],
    density: 0.35,
    culturalWeight: 0.3,
    riverEdge: true,
  },
  // ── 16e: Trocadéro, Passy ──
  {
    id: "16",
    name: "16e",
    displayName: "XVI",
    subtitle: "Trocadéro · Passy",
    center: [260, 340],
    path: poly([
      [270, 210], [320, 200], [340, 250], [320, 285],
      [310, 330], [325, 355], [280, 378],
      [240, 405], [248, 445], [225, 435],
      [210, 380], [215, 310], [225, 250],
    ]),
    neighbors: [
      { id: "7", bridge: true }, { id: "8" }, { id: "15" }, { id: "17" },
    ],
    density: 0.25,
    culturalWeight: 0.6,
    riverEdge: true,
  },
  // ── 17e: Batignolles ──
  {
    id: "17",
    name: "17e",
    displayName: "XVII",
    subtitle: "Batignolles · Ternes",
    center: [345, 190],
    path: poly([
      [270, 210], [225, 250], [230, 190], [270, 148],
      [330, 130], [400, 135], [420, 155],
      [400, 205], [395, 235], [340, 250], [320, 200],
    ]),
    neighbors: [
      { id: "8" }, { id: "9" }, { id: "16" }, { id: "18" },
    ],
    density: 0.35,
    culturalWeight: 0.35,
    riverEdge: false,
  },
  // ── 18e: Montmartre ──
  {
    id: "18",
    name: "18e",
    displayName: "XVIII",
    subtitle: "Montmartre · Sacré-Cœur",
    center: [480, 165],
    path: poly([
      [420, 155], [400, 135], [450, 125], [510, 120],
      [560, 130], [580, 155], [555, 190], [510, 185],
      [480, 195], [440, 195], [400, 205],
    ]),
    neighbors: [
      { id: "9" }, { id: "10" }, { id: "17" }, { id: "19" },
    ],
    density: 0.6,
    culturalWeight: 0.8,
    riverEdge: false,
  },
  // ── 19e: Buttes-Chaumont ──
  {
    id: "19",
    name: "19e",
    displayName: "XIX",
    subtitle: "Buttes-Chaumont · Villette",
    center: [620, 210],
    path: poly([
      [580, 155], [560, 130], [620, 140], [680, 165],
      [720, 210], [710, 260], [680, 280],
      [660, 270], [625, 245], [595, 250], [580, 210],
    ]),
    neighbors: [
      { id: "10" }, { id: "11" }, { id: "18" }, { id: "20" },
    ],
    density: 0.35,
    culturalWeight: 0.4,
    riverEdge: false,
  },
  // ── 20e: Père-Lachaise, Belleville ──
  {
    id: "20",
    name: "20e",
    displayName: "XX",
    subtitle: "Père-Lachaise · Belleville",
    center: [695, 300],
    path: poly([
      [680, 280], [710, 260], [720, 210], [755, 260],
      [770, 325], [760, 390], [750, 360],
      [710, 310], [665, 320], [660, 270],
    ]),
    neighbors: [
      { id: "11" }, { id: "12" }, { id: "19" },
    ],
    density: 0.4,
    culturalWeight: 0.45,
    riverEdge: false,
  },
  // ── Île de la Cité ──
  {
    id: "cite",
    name: "Cité",
    displayName: "Cité",
    subtitle: "Notre-Dame · Sainte-Chapelle",
    center: [488, 365],
    path: poly([
      [470, 358], [482, 350], [500, 350], [512, 358],
      [508, 370], [495, 376], [478, 376], [468, 368],
    ]),
    neighbors: [
      { id: "1", bridge: true }, { id: "4", bridge: true },
      { id: "5", bridge: true }, { id: "6", bridge: true },
      { id: "stlouis" },
    ],
    density: 0.95,
    culturalWeight: 1.0,
    riverEdge: true,
  },
  // ── Île Saint-Louis ──
  {
    id: "stlouis",
    name: "St-Louis",
    displayName: "St-Louis",
    subtitle: "Île Saint-Louis",
    center: [530, 370],
    path: poly([
      [518, 362], [528, 356], [540, 358], [548, 366],
      [544, 376], [534, 382], [522, 380], [516, 372],
    ]),
    neighbors: [
      { id: "4", bridge: true }, { id: "5", bridge: true },
      { id: "cite" },
    ],
    density: 0.9,
    culturalWeight: 0.75,
    riverEdge: true,
  },
];

// ── Banlieue Strategic Hubs ──
// Not communes. Pressure poles. Corridor extensions.

export interface BanlieueHub {
  id: string;
  name: string;
  corridor: "nord" | "est" | "sud" | "ouest";
  subtitle: string;
  /** Position on map edge (SVG coords in 1000x700 viewBox) */
  edgePos: [number, number];
  /** Approximate lat/lng */
  coords: { lat: number; lng: number };
}

export const BANLIEUE_HUBS: BanlieueHub[] = [
  // NORD
  {
    id: "saint-denis",
    name: "Saint-Denis",
    corridor: "nord",
    subtitle: "Stade de France",
    edgePos: [480, 102],
    coords: { lat: 48.9362, lng: 2.3574 },
  },
  {
    id: "villepinte",
    name: "Villepinte",
    corridor: "nord",
    subtitle: "Parc des Expositions",
    edgePos: [560, 102],
    coords: { lat: 48.9691, lng: 2.5153 },
  },
  {
    id: "cdg",
    name: "CDG",
    corridor: "nord",
    subtitle: "Aeroport",
    edgePos: [640, 102],
    coords: { lat: 49.0097, lng: 2.5479 },
  },
  // OUEST
  {
    id: "la-defense",
    name: "La Defense",
    corridor: "ouest",
    subtitle: "Affaires · CNIT",
    edgePos: [168, 260],
    coords: { lat: 48.8918, lng: 2.2362 },
  },
  // SUD
  {
    id: "orly",
    name: "Orly",
    corridor: "sud",
    subtitle: "Aeroport",
    edgePos: [500, 640],
    coords: { lat: 48.7262, lng: 2.3652 },
  },
  // EST
  {
    id: "montreuil",
    name: "Montreuil",
    corridor: "est",
    subtitle: "Pantin · Vincennes",
    edgePos: [832, 320],
    coords: { lat: 48.8638, lng: 2.4433 },
  },
];