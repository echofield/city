/**
 * Load MonthGuardianPack from data/city-signals/monthly/.
 * Node-only (fs). Used by scripts/generate-city-signals-llm.ts.
 */

import * as fs from "fs";
import * as path from "path";
import type { MonthGuardianPack } from "../../types/month-guardian-pack";

const MONTHLY_DIR = "data/city-signals/monthly";
const SUFFIX = ".paris-idf.json";

/** Current month in Europe/Paris as YYYY-MM */
function getCurrentMonthParis(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  return `${year}-${month}`;
}

/**
 * Load month guardian pack.
 * @param month - YYYY-MM; default = current month (Europe/Paris)
 * @param rootDir - Project root (default process.cwd())
 * @returns Pack or null if missing and no fallback
 */
export function loadMonthGuardian(
  month?: string,
  rootDir: string = process.cwd()
): MonthGuardianPack | null {
  const dir = path.join(rootDir, MONTHLY_DIR);
  if (!fs.existsSync(dir)) return null;

  const requested = month ?? getCurrentMonthParis();
  const file = path.join(dir, `${requested}${SUFFIX}`);

  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw) as MonthGuardianPack;
  }

  // Fallback: latest file in folder (by name descending)
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const jsonFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(SUFFIX))
    .map((e) => e.name)
    .sort((a, b) => b.localeCompare(a));
  if (jsonFiles.length === 0) return null;

  const fallbackPath = path.join(dir, jsonFiles[0]);
  const raw = fs.readFileSync(fallbackPath, "utf-8");
  return JSON.parse(raw) as MonthGuardianPack;
}
