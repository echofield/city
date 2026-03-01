/**
 * Generate city-signals LLM pack: load prompt template, inject date + MonthGuardianPack, output.
 * Node-only (fs). No backend.
 * Run from project root: npx tsx scripts/generate-city-signals-llm.ts [YYYY-MM-DD | YYYY-MM]
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { loadMonthGuardian } from "../src/lib/city-signals/loadMonthGuardian";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PROMPT_PATH = path.join(__dirname, "prompts", "city-signals-pack-v1.md");

/** Today in Europe/Paris as YYYY-MM-DD */
function getTodayParis(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

function main() {
  const arg = process.argv[2];
  let dateStr: string;
  let month: string | undefined;

  if (arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) {
    dateStr = arg;
    month = arg.slice(0, 7); // YYYY-MM for guardian
  } else if (arg && /^\d{4}-\d{2}$/.test(arg)) {
    month = arg;
    dateStr = getTodayParis(); // use today, guardian for given month
  } else {
    dateStr = getTodayParis();
    month = dateStr.slice(0, 7);
  }

  const pack = loadMonthGuardian(month, ROOT);
  const monthGuardianJson = pack ? JSON.stringify(pack, null, 2) : "";

  let template: string;
  try {
    template = fs.readFileSync(PROMPT_PATH, "utf-8");
  } catch (e) {
    console.error("Prompt file not found:", PROMPT_PATH);
    process.exit(1);
  }

  const filled = template
    .replace("{{date}}", dateStr)
    .replace("{{monthGuardianJson}}", monthGuardianJson);
  process.stdout.write(filled);
}

main();
