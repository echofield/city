# City Signals — Engine Run

Flow consumes a daily artifact **CitySignalsPackV1** from `data/city-signals/YYYY-MM-DD.json`. When present, the compiler builds the brief from this pack instead of mock data.

## Scripts

| Script | Mode | Use |
|--------|------|-----|
| `npm run city-signals` | FULL | Default: LLM or drop-in (same as `:full`) |
| `npm run city-signals:mock` | — | Mock generator only; no LLM. |
| `npm run city-signals:full` | FULL | 06:00-style full day scan. |
| `npm run city-signals:evening` | EVENING | 17:00 recalibration. |
| `npm run city-signals:night` | NIGHT | 22:30 nightlife adjustment. |

Run modes (FULL, EVENING, NIGHT) are passed into the prompt; the LLM or drop-in JSON should reflect the intended scan time.

## Generate a pack

### Option 1: Mock (no LLM)

```bash
npm run city-signals:mock
```

Writes a valid pack using `generateMockCitySignalsPackV1()`. Use for local dev or when no API/drop-in is available.

### Option 2: LLM (OpenAI)

1. Set `OPENAI_API_KEY` in the environment.
2. Optionally set `OPENAI_MODEL` (default `gpt-4o-mini`).
3. Run:

```bash
npm run city-signals:full
```

The script reads the prompt from `scripts/prompts/city-signals-pack-v1.md` (with `{{date}}` and `{{runMode}}` substituted), calls the API, parses JSON from the response, validates, and writes only if valid.

### Option 3: Manual JSON drop-in

If no `OPENAI_API_KEY` is set, the script looks for a drop-in file:

- **Path:** `data/city-signals/.input.json`

Paste a valid CitySignalsPackV1 JSON into that file, then run:

```bash
npm run city-signals:full
```

The script reads the file, validates, and writes `data/city-signals/YYYY-MM-DD.json` (using the `date` field from the JSON). If validation fails, the existing pack is **not** overwritten and errors are logged.

## Validation

Before writing, the pack is validated against the CitySignalsPackV1 schema. If validation fails:

- The script logs errors and exits with code 1.
- The existing `data/city-signals/YYYY-MM-DD.json` (if any) is **not** overwritten.

## Intended schedule (documentation only)

No cron implementation. Planned runs:

- **06:00** — full day scan (`:full`)
- **17:00** — evening recalibration (`:evening`)
- **22:30** — optional nightlife update (`:night`)

## Loader behavior

- `/api/flow/state` and `/api/flow/brief` call `loadCitySignals()`.
- If today’s file exists → use it to build the brief.
- Fallback → most recent pack in `data/city-signals/`.
- If no pack exists → use `MOCK_COMPILED_BRIEF`.

UI and FlowState contract are unchanged; only the compiler input source is swapped.
