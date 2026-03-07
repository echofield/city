// FLOW — Forced Mobility Wave Engine
// Core conversion model: People Released x Transport Weakness x Time Pressure x Ride Quality
// This is what separates "activity" from "actual ride demand."
// A restaurant being full is not enough. A concert ending is not enough.
// But: people released + weak alternatives + urgency = real VTC demand.

import type { TrainWave } from "./SncfService";

// ── Types ──

export type ForcedMobilityCategory =
  | "station_release"
  | "airport_release"
  | "event_exit"
  | "nightlife_closure"
  | "banlieue_return_constraint"
  | "office_release"
  | "transport_disruption"
  | "compound";

export type RideProfile = "short_fast" | "mixed" | "long" | "premium_long";

export interface ForcedMobilityWave {
  id: string;
  category: ForcedMobilityCategory;
  subtype: string;
  zone: string;
  venue?: string;
  venue_id?: string;
  wave_start: string;        // "HH:MM"
  wave_end: string;
  people_released_score: number;     // 0..100
  transport_weakness_score: number;  // 0..100
  time_pressure_score: number;       // 0..100
  ride_quality_score: number;        // 0..100
  final_forced_mobility_score: number; // 0..100
  likely_ride_profile: RideProfile;
  positioning_hint: string;
  confidence: "low" | "medium" | "high";
  factors: string[];
  // Internal
  is_compound: boolean;
  compound_sources?: string[];
  priority_rank: number;   // 1 = highest (compound), 7 = lowest (office)
}

// ── Scoring ──

function computeFinalScore(
  released: number,
  weakness: number,
  pressure: number,
  quality: number,
): number {
  return Math.round(
    0.35 * released + 0.30 * weakness + 0.20 * pressure + 0.15 * quality
  );
}

function categoryPriorityRank(cat: ForcedMobilityCategory): number {
  switch (cat) {
    case "compound": return 1;
    case "airport_release": return 2;
    case "station_release": return 3;
    case "banlieue_return_constraint": return 4;
    case "event_exit": return 5;
    case "nightlife_closure": return 6;
    case "office_release": return 7;
    case "transport_disruption": return 3; // reactive, can be very high
  }
}

function scoreToConfidence(score: number): "low" | "medium" | "high" {
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function profileToFlow(profile: RideProfile): string {
  switch (profile) {
    case "premium_long": return "Courses longues garanties";
    case "long": return "Courses longues probables";
    case "mixed": return "Courses mixtes";
    case "short_fast": return "Courses courtes rapides";
  }
}

// ── Time helpers ──

function formatHM(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isWeekend(now: Date): boolean {
  const d = now.getDay();
  return d === 0 || d === 5 || d === 6; // Fri, Sat, Sun
}

function metroWeakness(hour: number): number {
  // Metro weakness curve: strong during service, degrades after 23h, dead 1-5h
  if (hour >= 6 && hour <= 22) return 10;
  if (hour === 23) return 40;
  if (hour === 0) return 70;
  if (hour >= 1 && hour <= 4) return 95;
  if (hour === 5) return 60;
  return 20;
}

function lateNightPressure(hour: number): number {
  if (hour >= 1 && hour <= 4) return 90;
  if (hour === 0 || hour === 5) return 65;
  if (hour === 23) return 45;
  return 15;
}

// ── Wave Builders ──

function buildStationReleaseWaves(
  now: Date,
  trainWaves?: TrainWave[],
): ForcedMobilityWave[] {
  const hour = now.getHours();
  const waves: ForcedMobilityWave[] = [];

  if (!trainWaves || trainWaves.length === 0) return waves;

  for (const tw of trainWaves) {
    if (!tw.isActive || tw.arrivals.length === 0) continue;

    const hasInternational = tw.arrivals.some(
      a => a.commercialMode === "Eurostar" || a.commercialMode === "Thalys"
    );
    const hasLongDistance = tw.arrivals.some(a => a.isLongDistance);
    const isLate = hour >= 22 || hour <= 2;

    // People released score
    const paxNorm = Math.min(100, Math.round((tw.passengerEstimate / 3000) * 100));
    const released = Math.min(100, paxNorm + (tw.arrivals.length >= 3 ? 15 : 0));

    // Transport weakness
    const weakness = metroWeakness(hour) + (isLate ? 10 : 0);

    // Time pressure
    const pressure = lateNightPressure(hour) +
      (hasInternational ? 15 : 0) +   // luggage, unfamiliar
      (hasLongDistance ? 10 : 0);       // fatigue

    // Ride quality
    const quality = (hasLongDistance ? 40 : 20) +
      (hasInternational ? 30 : 0) +
      (isLate ? 15 : 0);               // premium probability

    const clampedWeakness = Math.min(100, weakness);
    const clampedPressure = Math.min(100, pressure);
    const clampedQuality = Math.min(100, quality);

    const finalScore = computeFinalScore(released, clampedWeakness, clampedPressure, clampedQuality);

    // Determine subtype
    let subtype = "station_tgv_release";
    if (hasInternational && isLate) subtype = "station_late_release";
    else if (hasInternational) subtype = "station_international_release";
    else if (isLate) subtype = "station_late_release";

    // Factors
    const factors: string[] = [];
    if (hasInternational) factors.push("International");
    if (hasLongDistance) factors.push("Grande ligne");
    if (isLate) factors.push("Heure tardive");
    if (tw.arrivals.length >= 3) factors.push("Cluster arrivees");
    if (clampedWeakness >= 50) factors.push("Metro faible");
    factors.push(`${tw.arrivals.length} trains`);

    const waveStartH = tw.arrivals[0].arrivalTime.getHours();
    const waveStartM = tw.arrivals[0].arrivalTime.getMinutes();
    const waveEndTime = new Date(tw.waveEnd);

    const rideProfile: RideProfile =
      hasInternational && isLate ? "premium_long" :
      hasLongDistance ? "long" : "mixed";

    // Positioning hint based on station
    let hint = "";
    if (tw.stationId === "gare-du-nord") hint = "Rue de Dunkerque — sortie Eurostar";
    else if (tw.stationId === "gare-de-lyon") hint = "Hall 1 — Rue de Bercy";
    else if (tw.stationId === "gare-montparnasse") hint = "Boulevard de Vaugirard";

    waves.push({
      id: `fmw-station-${tw.stationId}-${hour}`,
      category: "station_release",
      subtype,
      zone: tw.stationName,
      venue: tw.stationName,
      venue_id: tw.stationId,
      wave_start: formatHM(waveStartH, waveStartM),
      wave_end: formatHM(waveEndTime.getHours(), waveEndTime.getMinutes()),
      people_released_score: released,
      transport_weakness_score: clampedWeakness,
      time_pressure_score: clampedPressure,
      ride_quality_score: clampedQuality,
      final_forced_mobility_score: finalScore,
      likely_ride_profile: rideProfile,
      positioning_hint: hint,
      confidence: scoreToConfidence(finalScore),
      factors,
      is_compound: false,
      priority_rank: categoryPriorityRank("station_release"),
    });
  }

  return waves;
}

function buildAirportReleaseWaves(now: Date): ForcedMobilityWave[] {
  const hour = now.getHours();
  const waves: ForcedMobilityWave[] = [];

  // CDG arrival banks
  const cdgBanks: { hours: number[]; subtype: string; longhaul: boolean; released: number }[] = [
    { hours: [5, 6, 7], subtype: "airport_longhaul_release", longhaul: true, released: 85 },
    { hours: [8, 9, 10], subtype: "airport_terminal_bank", longhaul: false, released: 60 },
    { hours: [14, 15, 16], subtype: "airport_terminal_bank", longhaul: false, released: 50 },
    { hours: [17, 18, 19, 20], subtype: "airport_terminal_bank", longhaul: false, released: 65 },
    { hours: [21, 22, 23], subtype: "airport_late_arrival_release", longhaul: true, released: 75 },
  ];

  for (const bank of cdgBanks) {
    if (!bank.hours.includes(hour)) continue;

    const weakness = metroWeakness(hour) + 20; // RER B always fragile
    const pressure = lateNightPressure(hour) + (bank.longhaul ? 25 : 10); // luggage + fatigue
    const quality = bank.longhaul ? 85 : 55; // long rides to Paris center

    const clampedWeakness = Math.min(100, weakness);
    const clampedPressure = Math.min(100, pressure);

    const finalScore = computeFinalScore(bank.released, clampedWeakness, clampedPressure, quality);

    const factors: string[] = [];
    if (bank.longhaul) factors.push("Long-courrier");
    factors.push("Bagages");
    if (hour >= 21 || hour <= 6) factors.push("Heure tardive");
    if (clampedWeakness >= 50) factors.push("RER B faible");
    factors.push("Courses longues Paris");

    waves.push({
      id: `fmw-airport-cdg-${hour}`,
      category: "airport_release",
      subtype: bank.subtype,
      zone: "CDG",
      venue: "CDG T2E",
      venue_id: "cdg-airport",
      wave_start: formatHM(hour, 0),
      wave_end: formatHM(hour, 50),
      people_released_score: bank.released,
      transport_weakness_score: clampedWeakness,
      time_pressure_score: clampedPressure,
      ride_quality_score: quality,
      final_forced_mobility_score: finalScore,
      likely_ride_profile: bank.longhaul ? "premium_long" : "long",
      positioning_hint: "Terminal 2E — Arrivees internationales",
      confidence: scoreToConfidence(finalScore),
      factors,
      is_compound: false,
      priority_rank: categoryPriorityRank("airport_release"),
    });
  }

  // Orly — simpler pattern
  const orlyActive = (hour >= 6 && hour <= 10) || (hour >= 17 && hour <= 23);
  if (orlyActive) {
    const isLate = hour >= 21;
    const released = isLate ? 60 : 45;
    const weakness = Math.min(100, metroWeakness(hour) + 15); // OrlyVal
    const pressure = Math.min(100, lateNightPressure(hour) + 15);
    const quality = isLate ? 70 : 50;

    const finalScore = computeFinalScore(released, weakness, pressure, quality);

    waves.push({
      id: `fmw-airport-orly-${hour}`,
      category: "airport_release",
      subtype: isLate ? "airport_late_arrival_release" : "airport_terminal_bank",
      zone: "Orly",
      venue: "Orly T4",
      venue_id: "orly-airport",
      wave_start: formatHM(hour, 10),
      wave_end: formatHM(hour, 55),
      people_released_score: released,
      transport_weakness_score: weakness,
      time_pressure_score: pressure,
      ride_quality_score: quality,
      final_forced_mobility_score: finalScore,
      likely_ride_profile: isLate ? "long" : "mixed",
      positioning_hint: "Terminal 4 — Arrivees",
      confidence: scoreToConfidence(finalScore),
      factors: isLate
        ? ["Arrivees tardives", "Transport faible", "Courses sud Paris"]
        : ["Arrivees domestiques", "Courses mixtes"],
      is_compound: false,
      priority_rank: categoryPriorityRank("airport_release"),
    });
  }

  return waves;
}

function buildEventExitWaves(now: Date): ForcedMobilityWave[] {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const waves: ForcedMobilityWave[] = [];

  // Event venues with end windows
  interface EventConfig {
    id: string;
    venue: string;
    zone: string;
    venue_id: string;
    capacity: number;
    endHour: number;
    endMinute: number;
    exitWindowMin: number; // minutes of exit flow
    subtype: string;
    hint: string;
    metroQuality: "good" | "ok" | "weak";
  }

  const events: EventConfig[] = [
    { id: "accor", venue: "Accor Arena", zone: "Bastille", venue_id: "accor-arena", capacity: 15000, endHour: 23, endMinute: 0, exitWindowMin: 35, subtype: "arena_exit_forced", hint: "Boulevard de Bercy", metroQuality: "weak" },
    { id: "zenith", venue: "Zenith Paris", zone: "Villette", venue_id: "zenith-paris", capacity: 6300, endHour: 23, endMinute: 0, exitWindowMin: 30, subtype: "arena_exit_forced", hint: "Avenue Jean-Jaures", metroQuality: "weak" },
    { id: "stade", venue: "Stade de France", zone: "Saint-Denis", venue_id: "stade-france", capacity: 80000, endHour: 22, endMinute: 45, exitWindowMin: 45, subtype: "stadium_exit_forced", hint: "Porte de Paris RER", metroQuality: "ok" },
    { id: "olympia", venue: "L'Olympia", zone: "Opera", venue_id: "olympia", capacity: 2000, endHour: 22, endMinute: 30, exitWindowMin: 20, subtype: "theatre_exit_forced", hint: "Boulevard des Capucines", metroQuality: "good" },
    { id: "chatelet-th", venue: "Theatre du Chatelet", zone: "Chatelet", venue_id: "chatelet-theatre", capacity: 1200, endHour: 22, endMinute: 15, exitWindowMin: 20, subtype: "theatre_exit_forced", hint: "Place du Chatelet", metroQuality: "good" },
    { id: "bataclan", venue: "Bataclan", zone: "Bastille", venue_id: "bataclan", capacity: 1500, endHour: 23, endMinute: 0, exitWindowMin: 25, subtype: "arena_exit_forced", hint: "Boulevard Voltaire", metroQuality: "ok" },
    { id: "cigale", venue: "La Cigale", zone: "Montmartre", venue_id: "la-cigale", capacity: 1400, endHour: 23, endMinute: 0, exitWindowMin: 20, subtype: "arena_exit_forced", hint: "Boulevard de Rochechouart", metroQuality: "ok" },
  ];

  for (const ev of events) {
    // Is the event in its exit window? (endHour:endMinute - 15min → endHour:endMinute + exitWindowMin)
    const endTimeMin = ev.endHour * 60 + ev.endMinute;
    const nowMin = hour * 60 + minute;
    const windowStart = endTimeMin - 15;
    const windowEnd = endTimeMin + ev.exitWindowMin;

    if (nowMin < windowStart || nowMin > windowEnd) continue;

    const released = Math.min(100, Math.round((ev.capacity / 80000) * 100) + 20);
    const metroWeak = metroWeakness(hour);
    const venueMetroMod = ev.metroQuality === "weak" ? 20 : ev.metroQuality === "ok" ? 10 : 0;
    const weakness = Math.min(100, metroWeak + venueMetroMod);
    const pressure = Math.min(100, lateNightPressure(hour) + (ev.capacity > 5000 ? 15 : 5));
    const quality = ev.capacity > 5000 ? 55 : 40;

    const finalScore = computeFinalScore(released, weakness, pressure, quality);

    const factors: string[] = [`Sortie ${ev.venue}`];
    if (weakness >= 50) factors.push("Metro faible");
    if (ev.capacity > 5000) factors.push("Sortie massive");
    if (hour >= 23) factors.push("Heure tardive");

    waves.push({
      id: `fmw-event-${ev.id}-${hour}`,
      category: "event_exit",
      subtype: ev.subtype,
      zone: ev.zone,
      venue: ev.venue,
      venue_id: ev.venue_id,
      wave_start: formatHM(Math.floor(windowStart / 60), windowStart % 60),
      wave_end: formatHM(Math.floor(windowEnd / 60), windowEnd % 60),
      people_released_score: released,
      transport_weakness_score: weakness,
      time_pressure_score: pressure,
      ride_quality_score: quality,
      final_forced_mobility_score: finalScore,
      likely_ride_profile: ev.capacity > 5000 ? "mixed" : "mixed",
      positioning_hint: ev.hint,
      confidence: scoreToConfidence(finalScore),
      factors,
      is_compound: false,
      priority_rank: categoryPriorityRank("event_exit"),
    });
  }

  return waves;
}

function buildNightlifeClosureWaves(now: Date): ForcedMobilityWave[] {
  const hour = now.getHours();
  const waves: ForcedMobilityWave[] = [];

  if (!isWeekend(now) && hour < 23) return waves; // weeknight: only late
  if (hour >= 6 && hour <= 21) return waves; // daytime: no nightlife closure

  interface NightDistrict {
    id: string;
    zone: string;
    venue_id: string;
    barCloseHour: number;
    clubCloseHour: number;
    density: number; // 0..100
    hint: string;
  }

  const districts: NightDistrict[] = [
    { id: "bastille", zone: "Bastille", venue_id: "bastille-bars", barCloseHour: 2, clubCloseHour: 5, density: 80, hint: "Rue de Lappe / Roquette" },
    { id: "oberkampf", zone: "Oberkampf", venue_id: "oberkampf-bars", barCloseHour: 2, clubCloseHour: 4, density: 65, hint: "Rue Oberkampf" },
    { id: "pigalle", zone: "Pigalle", venue_id: "pigalle-bars", barCloseHour: 2, clubCloseHour: 5, density: 70, hint: "Rue de Douai" },
  ];

  for (const d of districts) {
    // Bar closure wave: around barCloseHour +-30min
    const isBarWindow = (hour === d.barCloseHour || hour === d.barCloseHour - 1) && (hour < d.clubCloseHour);
    // Club closure wave: around clubCloseHour +-30min
    const isClubWindow = hour >= d.clubCloseHour - 1 && hour <= d.clubCloseHour;
    // Last metro miss wave: 0:30-1:30
    const isLastMetroMiss = hour === 0 || hour === 1;

    if (!isBarWindow && !isClubWindow && !isLastMetroMiss) continue;

    let subtype: string;
    let released: number;
    let rideProfile: RideProfile;

    if (isClubWindow) {
      subtype = "club_closure_wave";
      released = Math.min(100, d.density + 15);
      rideProfile = "short_fast";
    } else if (isBarWindow) {
      subtype = "bar_closure_wave";
      released = Math.min(100, d.density);
      rideProfile = "short_fast";
    } else {
      subtype = "last_metro_miss_wave";
      released = Math.min(100, d.density - 10);
      rideProfile = "mixed";
    }

    const weakness = metroWeakness(hour);
    const pressure = lateNightPressure(hour);
    const quality = rideProfile === "short_fast" ? 30 : 45;

    const finalScore = computeFinalScore(released, weakness, pressure, quality);

    const factors: string[] = [];
    if (isClubWindow) factors.push("Fermeture clubs");
    if (isBarWindow) factors.push("Fermeture bars");
    if (isLastMetroMiss) factors.push("Derniers metros rates");
    factors.push("Frequence forte");
    if (weakness >= 70) factors.push("Metro arrete");
    if (isWeekend(now)) factors.push("Nuit weekend");

    waves.push({
      id: `fmw-nightlife-${d.id}-${subtype}-${hour}`,
      category: "nightlife_closure",
      subtype,
      zone: d.zone,
      venue: `${d.zone} bars/clubs`,
      venue_id: d.venue_id,
      wave_start: formatHM(hour, 0),
      wave_end: formatHM((hour + 1) % 24, 15),
      people_released_score: released,
      transport_weakness_score: weakness,
      time_pressure_score: pressure,
      ride_quality_score: quality,
      final_forced_mobility_score: finalScore,
      likely_ride_profile: rideProfile,
      positioning_hint: d.hint,
      confidence: scoreToConfidence(finalScore),
      factors,
      is_compound: false,
      priority_rank: categoryPriorityRank("nightlife_closure"),
    });
  }

  return waves;
}

function buildOfficeReleaseWaves(now: Date): ForcedMobilityWave[] {
  const hour = now.getHours();
  const day = now.getDay();
  const waves: ForcedMobilityWave[] = [];

  // Only weekdays 17-20
  if (day === 0 || day === 6) return waves; // weekend
  if (hour < 17 || hour > 20) return waves;

  interface OfficeDistrict {
    id: string;
    zone: string;
    venue_id: string;
    density: number;
    hint: string;
    peakHour: number;
  }

  const districts: OfficeDistrict[] = [
    { id: "defense", zone: "La Defense", venue_id: "la-defense-offices", density: 75, hint: "Esplanade — Parvis", peakHour: 18 },
    { id: "opera", zone: "Opera", venue_id: "palais-garnier", density: 55, hint: "Place de l'Opera", peakHour: 19 },
  ];

  // Check for rain boost (use same hash as FlowEngine)
  const dayHash = Math.floor(now.getTime() / 86400000);
  const rainSeed = Math.sin(dayHash * 12.9898 + 78.233) * 43758.5453;
  const hasRain = (rainSeed - Math.floor(rainSeed)) > 0.55;

  for (const d of districts) {
    const isPeakWindow = Math.abs(hour - d.peakHour) <= 1;
    if (!isPeakWindow) continue;

    const released = d.density;
    const weakness = hasRain ? 40 : 15; // rain makes taxis more attractive
    const pressure = hour === d.peakHour ? 45 : 30;
    const quality = 35 + (hasRain ? 15 : 0);

    const finalScore = computeFinalScore(released, weakness, pressure, quality);

    const factors: string[] = ["Sortie bureaux"];
    if (hasRain) factors.push("Pluie");
    factors.push("Demande reguliere");

    let subtype = "office_evening_release";
    if (hasRain) subtype = "rain_office_release";

    waves.push({
      id: `fmw-office-${d.id}-${hour}`,
      category: "office_release",
      subtype,
      zone: d.zone,
      venue: d.zone,
      venue_id: d.venue_id,
      wave_start: formatHM(hour, 30),
      wave_end: formatHM(hour + 1, 20),
      people_released_score: released,
      transport_weakness_score: weakness,
      time_pressure_score: pressure,
      ride_quality_score: quality,
      final_forced_mobility_score: finalScore,
      likely_ride_profile: "mixed",
      positioning_hint: d.hint,
      confidence: scoreToConfidence(finalScore),
      factors,
      is_compound: false,
      priority_rank: categoryPriorityRank("office_release"),
    });
  }

  return waves;
}

function buildBanlieueReturnWaves(now: Date): ForcedMobilityWave[] {
  const hour = now.getHours();
  const waves: ForcedMobilityWave[] = [];

  // Only relevant late night / early morning, mostly weekends
  if (hour >= 6 && hour <= 22) return waves;

  interface BanlieueEvent {
    id: string;
    zone: string;
    venue: string;
    exitHour: number;
    released: number;
    hint: string;
    isWeekendOnly: boolean;
  }

  const scenarios: BanlieueEvent[] = [
    { id: "villepinte", zone: "Villepinte", venue: "Parc des Expositions", exitHour: 23, released: 65, hint: "Sortie Parc des Expositions", isWeekendOnly: false },
    { id: "saint-denis-late", zone: "Saint-Denis", venue: "Stade de France", exitHour: 23, released: 80, hint: "Porte de Paris RER", isWeekendOnly: false },
  ];

  for (const s of scenarios) {
    if (s.isWeekendOnly && !isWeekend(now)) continue;
    if (Math.abs(hour - s.exitHour) > 2 && !(hour <= 2 && s.exitHour >= 22)) continue;

    const weakness = metroWeakness(hour) + 25; // banlieue = always weaker transport
    const pressure = lateNightPressure(hour) + 20; // stranded probability
    const quality = 80; // long rides back to Paris, low competition

    const clampedWeakness = Math.min(100, weakness);
    const clampedPressure = Math.min(100, pressure);

    const finalScore = computeFinalScore(s.released, clampedWeakness, clampedPressure, quality);

    waves.push({
      id: `fmw-banlieue-${s.id}-${hour}`,
      category: "banlieue_return_constraint",
      subtype: "remote_event_release",
      zone: s.zone,
      venue: s.venue,
      venue_id: s.id,
      wave_start: formatHM(s.exitHour, 0),
      wave_end: formatHM((s.exitHour + 2) % 24, 20),
      people_released_score: s.released,
      transport_weakness_score: clampedWeakness,
      time_pressure_score: clampedPressure,
      ride_quality_score: quality,
      final_forced_mobility_score: finalScore,
      likely_ride_profile: "premium_long",
      positioning_hint: s.hint,
      confidence: scoreToConfidence(finalScore),
      factors: ["Retour faible", "Concurrence faible", "Courses longues Paris"],
      is_compound: false,
      priority_rank: categoryPriorityRank("banlieue_return_constraint"),
    });
  }

  return waves;
}

function buildTransportDisruptionWaves(now: Date): ForcedMobilityWave[] {
  const hour = now.getHours();
  const waves: ForcedMobilityWave[] = [];

  // Simulated disruption: use deterministic noise (same pattern as FlowEngine)
  const halfDaySeed = Math.floor(now.getTime() / 43200000);
  const disruptionNoise = Math.sin(halfDaySeed * 12.9898 + 78.233) * 43758.5453;
  const hasDisruption = (disruptionNoise - Math.floor(disruptionNoise)) > 0.7;

  if (!hasDisruption) return waves;
  if (hour < 7 || hour > 22) return waves; // disruptions matter most during service

  // Rain check
  const dayHash = Math.floor(now.getTime() / 86400000);
  const rainSeed = Math.sin(dayHash * 12.9898 + 78.233) * 43758.5453;
  const hasRain = (rainSeed - Math.floor(rainSeed)) > 0.55;

  const released = 70;
  const weakness = 80; // the disruption IS the weakness
  const pressure = 55 + (hasRain ? 15 : 0);
  const quality = 45;

  const finalScore = computeFinalScore(released, weakness, pressure, quality);

  const factors: string[] = ["Ligne perturbee"];
  if (hasRain) factors.push("Pluie");
  factors.push("Demande reportee VTC");

  waves.push({
    id: `fmw-disruption-${hour}`,
    category: "transport_disruption",
    subtype: hasRain ? "metro_failure_spill" : "metro_failure_spill",
    zone: "Republique / Bastille",
    venue: "Ligne perturbee",
    wave_start: formatHM(hour, 0),
    wave_end: formatHM(Math.min(23, hour + 2), 0),
    people_released_score: released,
    transport_weakness_score: weakness,
    time_pressure_score: pressure,
    ride_quality_score: quality,
    final_forced_mobility_score: finalScore,
    likely_ride_profile: "mixed",
    positioning_hint: "Axes Republique — Bastille",
    confidence: scoreToConfidence(finalScore),
    factors,
    is_compound: false,
    priority_rank: categoryPriorityRank("transport_disruption"),
  });

  return waves;
}

// ── Compound Detection ──

function detectCompounds(waves: ForcedMobilityWave[], now: Date): ForcedMobilityWave[] {
  if (waves.length < 2) return [];

  const hour = now.getHours();
  const compounds: ForcedMobilityWave[] = [];

  // Check for overlapping waves in the same zone or nearby zones
  for (let i = 0; i < waves.length; i++) {
    for (let j = i + 1; j < waves.length; j++) {
      const a = waves[i];
      const b = waves[j];

      // Same zone or related (station + rain, event + last metro, etc.)
      const sameZone = a.zone === b.zone;
      const bothTransport = a.category === "station_release" && b.category === "transport_disruption";
      const eventPlusMetro = a.category === "event_exit" && b.category === "nightlife_closure";
      const stationPlusWeather = a.category === "station_release" &&
        (b.factors.includes("Pluie") || a.factors.includes("Pluie"));
      const airportPlusDisruption = a.category === "airport_release" && b.category === "transport_disruption";

      if (!sameZone && !bothTransport && !eventPlusMetro && !stationPlusWeather && !airportPlusDisruption) continue;

      // Compute compound score: boost over individual
      const baseScore = Math.max(a.final_forced_mobility_score, b.final_forced_mobility_score);
      const compoundBoost = Math.min(100, baseScore + 15 + Math.min(a.final_forced_mobility_score, b.final_forced_mobility_score) * 0.2);

      // Combine factors (deduplicated)
      const allFactors = [...new Set([...a.factors, ...b.factors])];

      // Determine subtype
      let subtype = "compound_overlap";
      if (stationPlusWeather) subtype = "station_release_plus_rain";
      if (eventPlusMetro) subtype = "event_exit_plus_last_metro";
      if (airportPlusDisruption) subtype = "airport_arrivals_plus_strike";
      if (a.category === "nightlife_closure" && b.factors.includes("Pluie")) subtype = "nightlife_closure_plus_rain";

      // Best ride profile from either
      const rideRank: Record<RideProfile, number> = { premium_long: 4, long: 3, mixed: 2, short_fast: 1 };
      const bestProfile = rideRank[a.likely_ride_profile] >= rideRank[b.likely_ride_profile]
        ? a.likely_ride_profile : b.likely_ride_profile;

      compounds.push({
        id: `fmw-compound-${a.id}-${b.id}`,
        category: "compound",
        subtype,
        zone: a.zone,
        venue: a.venue,
        venue_id: a.venue_id,
        wave_start: a.wave_start < b.wave_start ? a.wave_start : b.wave_start,
        wave_end: a.wave_end > b.wave_end ? a.wave_end : b.wave_end,
        people_released_score: Math.max(a.people_released_score, b.people_released_score),
        transport_weakness_score: Math.max(a.transport_weakness_score, b.transport_weakness_score),
        time_pressure_score: Math.max(a.time_pressure_score, b.time_pressure_score),
        ride_quality_score: Math.max(a.ride_quality_score, b.ride_quality_score),
        final_forced_mobility_score: Math.round(compoundBoost),
        likely_ride_profile: bestProfile,
        positioning_hint: a.positioning_hint || b.positioning_hint,
        confidence: "high",
        factors: allFactors,
        is_compound: true,
        compound_sources: [a.category, b.category],
        priority_rank: 1,
      });
    }
  }

  return compounds;
}

// ── Public API ──

export interface ForcedMobilitySnapshot {
  waves: ForcedMobilityWave[];
  activeCount: number;
  strongestWave: ForcedMobilityWave | null;
  hasCompound: boolean;
  computedAt: Date;
}

/**
 * Compute all currently active Forced Mobility Waves.
 * Call every 2s from Dashboard (alongside FlowEngine tick).
 */
export function computeForcedMobilityWaves(
  trainWaves?: TrainWave[],
): ForcedMobilitySnapshot {
  const now = new Date();

  // Build all wave types
  const stationWaves = buildStationReleaseWaves(now, trainWaves);
  const airportWaves = buildAirportReleaseWaves(now);
  const eventWaves = buildEventExitWaves(now);
  const nightlifeWaves = buildNightlifeClosureWaves(now);
  const officeWaves = buildOfficeReleaseWaves(now);
  const banlieueWaves = buildBanlieueReturnWaves(now);
  const disruptionWaves = buildTransportDisruptionWaves(now);

  const allBase = [
    ...stationWaves,
    ...airportWaves,
    ...eventWaves,
    ...nightlifeWaves,
    ...officeWaves,
    ...banlieueWaves,
    ...disruptionWaves,
  ];

  // Detect compounds
  const compounds = detectCompounds(allBase, now);

  // Merge all
  const allWaves = [...compounds, ...allBase];

  // Sort by: priority_rank ASC, then final_score DESC
  allWaves.sort((a, b) => {
    if (a.priority_rank !== b.priority_rank) return a.priority_rank - b.priority_rank;
    return b.final_forced_mobility_score - a.final_forced_mobility_score;
  });

  return {
    waves: allWaves,
    activeCount: allWaves.length,
    strongestWave: allWaves.length > 0 ? allWaves[0] : null,
    hasCompound: compounds.length > 0,
    computedAt: now,
  };
}

/**
 * Find the strongest FMW matching a venue ID.
 */
export function findWaveForVenue(
  snapshot: ForcedMobilitySnapshot,
  venueId: string,
): ForcedMobilityWave | undefined {
  return snapshot.waves.find(w => w.venue_id === venueId);
}

/**
 * Get a compact display label for a wave.
 * e.g. "Release Eurostar + pluie + metro faible"
 */
export function waveDisplayLabel(wave: ForcedMobilityWave): string {
  if (wave.is_compound && wave.factors.length >= 2) {
    return wave.factors.slice(0, 3).join(" + ");
  }
  switch (wave.category) {
    case "station_release": return `Release ${wave.zone}`;
    case "airport_release": return `Arrivees ${wave.zone}`;
    case "event_exit": return `Sortie ${wave.venue}`;
    case "nightlife_closure": return `Fin ${wave.zone}`;
    case "banlieue_return_constraint": return `Retour ${wave.zone}`;
    case "office_release": return `Bureaux ${wave.zone}`;
    case "transport_disruption": return "Perturbation transport";
    case "compound": return wave.factors.slice(0, 2).join(" + ");
  }
}

/**
 * Get the ride conversion hint for display.
 */
export function waveConversionLabel(wave: ForcedMobilityWave): string {
  if (wave.final_forced_mobility_score >= 70) return "Conversion VTC tres forte";
  if (wave.final_forced_mobility_score >= 50) return "Conversion VTC forte";
  if (wave.final_forced_mobility_score >= 35) return "Conversion VTC moderee";
  return "Conversion faible";
}

/**
 * Category display label for UI badges.
 */
export function waveCategoryLabel(cat: ForcedMobilityCategory): string {
  switch (cat) {
    case "station_release": return "RELEASE GARE";
    case "airport_release": return "RELEASE AEROPORT";
    case "event_exit": return "SORTIE EVENT";
    case "nightlife_closure": return "FIN NUIT";
    case "banlieue_return_constraint": return "RETOUR BANLIEUE";
    case "office_release": return "SORTIE BUREAUX";
    case "transport_disruption": return "PERTURBATION";
    case "compound": return "COMPOSE";
  }
}
