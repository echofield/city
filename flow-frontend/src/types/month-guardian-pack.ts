/**
 * MonthGuardianPack — schema for data/city-signals/monthly/{month}.paris-idf.json
 * Used by LLM pack generation to inject day anchors and recurring context.
 */

export interface MonthGuardianAnchor {
  date: string; // YYYY-MM-DD
  title: string;
  type: string; // expo | transport | cluster | concert | sport | marathon | festival | etc.
  venue: string;
  startTime: string | null;
  endTime: string | null;
  zoneImpact: string[];
  notes: string;
}

export interface MonthGuardianRecurring {
  title: string;
  type: string;
  pattern: string;
  zones: string[];
  notes: string;
}

export interface MonthGuardianTransportDisruption {
  line: string;
  type: string; // closure | etc.
  dates: string[]; // YYYY-MM-DD
  timeWindow: { start: string | null; end: string | null };
  impactZones: string[];
  notes: string;
}

export interface MonthGuardianKeyVenue {
  name: string;
  zone: string;
  aliases: string[];
  defaultImpactZones: string[];
}

export interface MonthGuardianHighRiskDay {
  date: string; // YYYY-MM-DD
  reason: string;
  zones: string[];
}

export interface MonthGuardianPack {
  month: string; // YYYY-MM
  scope: string;
  generatedAt: string; // ISO
  anchors: MonthGuardianAnchor[];
  recurring: MonthGuardianRecurring[];
  transportDisruptions: MonthGuardianTransportDisruption[];
  keyVenues: MonthGuardianKeyVenue[];
  highRiskDays: MonthGuardianHighRiskDay[];
}
