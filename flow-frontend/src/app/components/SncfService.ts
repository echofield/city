// FLOW — SNCF Open Data Integration
// Real-time train arrivals for Paris major stations.
// Falls back to realistic schedule-based simulation when API key is not set.
// Produces TrainWave objects consumed by FlowEngine to boost station signals.
//
// To connect: get a free API key at https://numerique.sncf.com/startup/api/
// Then set SNCF_API_KEY below or in environment.

const SNCF_API_KEY = "YOUR_API_KEY_HERE"; // Replace with real key from api.sncf.com

// ── Types ──

export interface TrainArrival {
  trainNumber: string;       // "TGV 6234", "Eurostar 9015"
  commercialMode: string;    // "TGV", "Eurostar", "Thalys", "TER", "Intercites"
  origin: string;            // "Lyon Part-Dieu", "London St Pancras"
  arrivalTime: Date;
  minutesUntil: number;
  isLongDistance: boolean;    // TGV/Eurostar/Thalys = true → long rides probable
}

export interface TrainWave {
  stationId: string;         // matches PARIS_VENUES ids: "gare-du-nord", "gare-de-lyon", "gare-montparnasse"
  stationName: string;
  arrivals: TrainArrival[];
  waveStart: Date;           // first arrival in cluster
  waveEnd: Date;             // last arrival in cluster + exit buffer
  passengerEstimate: number; // rough estimate based on train types
  dominantType: string;      // "TGV", "Eurostar", etc.
  isActive: boolean;         // are trains arriving now or within 30min?
  confidence: number;        // 0..1 — higher when based on real API data
}

// ── SNCF Station IDs ──

interface StationConfig {
  sncfId: string;
  flowId: string;
  name: string;
  defaultTrains: ScheduledTrain[];
}

interface ScheduledTrain {
  trainNumber: string;
  commercialMode: string;
  origin: string;
  minuteOffset: number; // minutes from the top of the hour
  hours: number[];      // which hours this train typically runs
  isLongDistance: boolean;
  passengerEstimate: number;
}

const STATIONS: StationConfig[] = [
  {
    sncfId: "stop_area:SNCF:87271007",
    flowId: "gare-du-nord",
    name: "Gare du Nord",
    defaultTrains: [
      // Eurostar — London
      { trainNumber: "Eurostar 9015", commercialMode: "Eurostar", origin: "London St Pancras", minuteOffset: 12, hours: [7, 9, 11, 13, 15, 17, 19], isLongDistance: true, passengerEstimate: 750 },
      { trainNumber: "Eurostar 9053", commercialMode: "Eurostar", origin: "London St Pancras", minuteOffset: 42, hours: [8, 10, 14, 16, 18, 20], isLongDistance: true, passengerEstimate: 750 },
      // Thalys — Brussels, Amsterdam
      { trainNumber: "Thalys 9321", commercialMode: "Thalys", origin: "Bruxelles-Midi", minuteOffset: 5, hours: [7, 8, 9, 10, 12, 14, 16, 17, 18, 19, 20, 21], isLongDistance: true, passengerEstimate: 500 },
      { trainNumber: "Thalys 9445", commercialMode: "Thalys", origin: "Amsterdam Centraal", minuteOffset: 28, hours: [8, 11, 14, 17, 20], isLongDistance: true, passengerEstimate: 500 },
      // TER Picardie
      { trainNumber: "TER 847521", commercialMode: "TER", origin: "Amiens", minuteOffset: 15, hours: [6, 7, 8, 17, 18, 19], isLongDistance: false, passengerEstimate: 200 },
      { trainNumber: "TER 847533", commercialMode: "TER", origin: "Compiegne", minuteOffset: 35, hours: [7, 8, 17, 18, 19], isLongDistance: false, passengerEstimate: 150 },
    ],
  },
  {
    sncfId: "stop_area:SNCF:87686006",
    flowId: "gare-de-lyon",
    name: "Gare de Lyon",
    defaultTrains: [
      // TGV Sud-Est
      { trainNumber: "TGV 6234", commercialMode: "TGV", origin: "Lyon Part-Dieu", minuteOffset: 8, hours: [7, 8, 9, 10, 12, 14, 16, 17, 18, 19, 20, 21], isLongDistance: true, passengerEstimate: 600 },
      { trainNumber: "TGV 6142", commercialMode: "TGV", origin: "Marseille St-Charles", minuteOffset: 22, hours: [8, 10, 12, 14, 16, 18, 20], isLongDistance: true, passengerEstimate: 600 },
      { trainNumber: "TGV 6844", commercialMode: "TGV", origin: "Nice Ville", minuteOffset: 45, hours: [9, 13, 17, 21], isLongDistance: true, passengerEstimate: 500 },
      { trainNumber: "TGV 9245", commercialMode: "TGV", origin: "Geneve", minuteOffset: 35, hours: [8, 11, 15, 19], isLongDistance: true, passengerEstimate: 450 },
      // TER Bourgogne
      { trainNumber: "TER 891205", commercialMode: "TER", origin: "Fontainebleau", minuteOffset: 20, hours: [7, 8, 17, 18, 19], isLongDistance: false, passengerEstimate: 180 },
    ],
  },
  {
    sncfId: "stop_area:SNCF:87391003",
    flowId: "gare-montparnasse",
    name: "Gare Montparnasse",
    defaultTrains: [
      // TGV Atlantique
      { trainNumber: "TGV 8634", commercialMode: "TGV", origin: "Bordeaux St-Jean", minuteOffset: 10, hours: [8, 10, 12, 14, 16, 18, 20], isLongDistance: true, passengerEstimate: 550 },
      { trainNumber: "TGV 8512", commercialMode: "TGV", origin: "Nantes", minuteOffset: 30, hours: [7, 9, 11, 15, 17, 19, 21], isLongDistance: true, passengerEstimate: 500 },
      { trainNumber: "TGV 8754", commercialMode: "TGV", origin: "Rennes", minuteOffset: 50, hours: [8, 10, 14, 16, 18, 20], isLongDistance: true, passengerEstimate: 450 },
      // TER Chartres
      { trainNumber: "TER 16421", commercialMode: "TER", origin: "Chartres", minuteOffset: 25, hours: [7, 8, 17, 18, 19], isLongDistance: false, passengerEstimate: 150 },
    ],
  },
];

// ── API Fetch (real SNCF data) ──

interface SncfApiResponse {
  arrivals?: {
    stop_date_time: {
      arrival_date_time: string; // "20260307T193200"
    };
    display_informations: {
      commercial_mode: string;
      direction: string;
      headsign: string;
      network: string;
    };
  }[];
}

function parseSncfDate(s: string): Date {
  // Format: "20260307T193200"
  const y = parseInt(s.slice(0, 4));
  const m = parseInt(s.slice(4, 6)) - 1;
  const d = parseInt(s.slice(6, 8));
  const h = parseInt(s.slice(9, 11));
  const min = parseInt(s.slice(11, 13));
  return new Date(y, m, d, h, min);
}

function isLongDistanceMode(mode: string): boolean {
  const m = mode.toLowerCase();
  return m.includes("tgv") || m.includes("eurostar") || m.includes("thalys") || m.includes("ice") || m.includes("intercit");
}

function estimatePassengers(mode: string): number {
  const m = mode.toLowerCase();
  if (m.includes("eurostar") || m.includes("thalys")) return 700;
  if (m.includes("tgv")) return 550;
  if (m.includes("intercit")) return 350;
  if (m.includes("ter")) return 180;
  return 200;
}

async function fetchRealArrivals(station: StationConfig): Promise<TrainArrival[] | null> {
  if (SNCF_API_KEY === "YOUR_API_KEY_HERE") return null;

  try {
    const url = `https://api.sncf.com/v1/coverage/sncf/stop_areas/${station.sncfId}/arrivals?count=15&duration=3600`;
    const resp = await fetch(url, {
      headers: {
        "Authorization": `Basic ${btoa(SNCF_API_KEY + ":")}`,
      },
    });

    if (!resp.ok) return null;

    const data: SncfApiResponse = await resp.json();
    if (!data.arrivals) return null;

    const now = new Date();
    return data.arrivals.map((a) => {
      const arrTime = parseSncfDate(a.stop_date_time.arrival_date_time);
      const mode = a.display_informations.commercial_mode;
      return {
        trainNumber: `${mode} ${a.display_informations.headsign}`,
        commercialMode: mode,
        origin: a.display_informations.direction.split(" (")[0], // clean up
        arrivalTime: arrTime,
        minutesUntil: Math.max(0, Math.round((arrTime.getTime() - now.getTime()) / 60000)),
        isLongDistance: isLongDistanceMode(mode),
      };
    });
  } catch {
    return null;
  }
}

// ── Simulated Schedule (fallback) ──

function buildSimulatedArrivals(station: StationConfig): TrainArrival[] {
  const now = new Date();
  const currentHour = now.getHours();
  const arrivals: TrainArrival[] = [];

  for (const train of station.defaultTrains) {
    // Check current hour and next hour
    for (const h of train.hours) {
      if (h === currentHour || h === (currentHour + 1) % 24) {
        const arrTime = new Date(now);
        arrTime.setHours(h, train.minuteOffset, 0, 0);

        // Only include future arrivals or very recent ones (within 5 min past)
        const diff = (arrTime.getTime() - now.getTime()) / 60000;
        if (diff >= -5 && diff <= 65) {
          arrivals.push({
            trainNumber: train.trainNumber,
            commercialMode: train.commercialMode,
            origin: train.origin,
            arrivalTime: arrTime,
            minutesUntil: Math.max(0, Math.round(diff)),
            isLongDistance: train.isLongDistance,
          });
        }
      }
    }
  }

  // Sort by arrival time
  arrivals.sort((a, b) => a.arrivalTime.getTime() - b.arrivalTime.getTime());
  return arrivals;
}

// ── Build Train Waves ──

function clusterToWave(station: StationConfig, arrivals: TrainArrival[], isRealData: boolean): TrainWave {
  const now = new Date();

  if (arrivals.length === 0) {
    return {
      stationId: station.flowId,
      stationName: station.name,
      arrivals: [],
      waveStart: now,
      waveEnd: now,
      passengerEstimate: 0,
      dominantType: "",
      isActive: false,
      confidence: 0.3,
    };
  }

  const waveStart = arrivals[0].arrivalTime;
  const lastArrival = arrivals[arrivals.length - 1].arrivalTime;
  const EXIT_BUFFER_MS = 20 * 60 * 1000; // 20 min exit buffer
  const waveEnd = new Date(lastArrival.getTime() + EXIT_BUFFER_MS);

  // Passenger estimate
  let passengerEstimate = 0;
  const modeCount: Record<string, number> = {};
  for (const a of arrivals) {
    passengerEstimate += estimatePassengers(a.commercialMode);
    modeCount[a.commercialMode] = (modeCount[a.commercialMode] ?? 0) + 1;
  }

  // Dominant type
  const dominantType = Object.entries(modeCount)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  // Is active? (first arrival within 30 min)
  const isActive = arrivals[0].minutesUntil <= 30;

  // Confidence: real data = high, simulated = moderate
  const baseConf = isRealData ? 0.88 : 0.68;
  const longDistanceBonus = arrivals.some(a => a.isLongDistance) ? 0.08 : 0;
  const volumeBonus = arrivals.length >= 3 ? 0.05 : 0;
  const confidence = Math.min(1, baseConf + longDistanceBonus + volumeBonus);

  return {
    stationId: station.flowId,
    stationName: station.name,
    arrivals,
    waveStart,
    waveEnd,
    passengerEstimate,
    dominantType,
    isActive,
    confidence,
  };
}

// ── Public API ──

export type SncfDataSource = "api" | "schedule" | "unavailable";

export interface SncfSnapshot {
  waves: TrainWave[];
  source: SncfDataSource;
  fetchedAt: Date;
  nextRefreshIn: number; // seconds
}

/**
 * Fetch train waves for all Paris major stations.
 * Tries real SNCF API first, falls back to schedule simulation.
 * Call every 60-120s from Dashboard.
 */
export async function fetchTrainWaves(): Promise<SncfSnapshot> {
  const waves: TrainWave[] = [];
  let source: SncfDataSource = "schedule";

  for (const station of STATIONS) {
    // Try real API
    const realArrivals = await fetchRealArrivals(station);

    if (realArrivals && realArrivals.length > 0) {
      waves.push(clusterToWave(station, realArrivals, true));
      source = "api";
    } else {
      // Fallback to schedule
      const simulated = buildSimulatedArrivals(station);
      waves.push(clusterToWave(station, simulated, false));
    }
  }

  return {
    waves,
    source,
    fetchedAt: new Date(),
    nextRefreshIn: source === "api" ? 60 : 120,
  };
}

/**
 * Get the next train arriving at a specific station.
 * Used by signal cards to show "TGV 6234 de Lyon — 8 min"
 */
export function getNextTrainLabel(wave: TrainWave): string | null {
  const next = wave.arrivals.find(a => a.minutesUntil > 0);
  if (!next) return null;

  const origin = next.origin.split("-")[0].trim(); // "Lyon Part-Dieu" → "Lyon Part"
  return `${next.commercialMode} de ${origin}`;
}

/**
 * Get a compact summary for signal card display.
 * e.g. "3 TGV + 1 Eurostar — 2100 pax"
 */
export function getWaveSummary(wave: TrainWave): string {
  if (wave.arrivals.length === 0) return "";

  const modeCount: Record<string, number> = {};
  for (const a of wave.arrivals) {
    modeCount[a.commercialMode] = (modeCount[a.commercialMode] ?? 0) + 1;
  }

  const parts = Object.entries(modeCount)
    .sort((a, b) => b[1] - a[1])
    .map(([mode, count]) => `${count} ${mode}`)
    .slice(0, 3);

  return parts.join(" + ");
}

/**
 * Get the countdown string for the next arrival.
 */
export function getNextArrivalCountdown(wave: TrainWave): string | null {
  const next = wave.arrivals.find(a => a.minutesUntil > 0);
  if (!next) return null;
  if (next.minutesUntil <= 1) return "Maintenant";
  return `dans ${next.minutesUntil}m`;
}