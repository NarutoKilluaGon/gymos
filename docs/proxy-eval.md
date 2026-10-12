# Proxy Evaluation & Baseline Report (`docs/proxy-eval.md`)

This document records the proxy characteristics and baseline food logging evaluation for GymOS Nourish food logging.

---

## 1. `gymos-proxy` Discovery & Audit

- **Location:** `~/gymos-proxy` (`/home/dev-vats/gymos-proxy`)
- **Single-file implementation:** `proxy.mjs` (Node 20, zero external npm dependencies).
- **Contract Version:** **v1 (Slice 2 — S2)**:
  - Single endpoint: `POST /estimate`
  - Body: `{ "description": "<text>" }` (up to 2,000 characters)
  - Output: `{ "foods": [...], "totals": {...} }` with all 16 canonical nutrients strictly required.
  - Image/photo parameters rejected with HTTP 400.
  - Request body cap: 8 MB (HTTP 413).
- **Model:** `gemini-3.5-flash-lite` via `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`.
- **System Prompt:**
  - Instructs the model to treat the user's description as the sole source of truth.
  - Stated quantities and preparation details must be preserved in `estimatedAmount` and `unit`.
  - Structured output enforced via REST `responseSchema`.
- **Hosting & Port:**
  - Defaults to `HOST=0.0.0.0`, `PORT=8787`.
  - Configurable for local-only via `HOST=127.0.0.1`.
- **Cold-Start & Upstream Timeout:**
  - Configured `GEMINI_TIMEOUT_MS = 60000` (60 seconds client timeout in GymOS v1, planned for 12s with retries in v2).
  - Proxy startup time is < 50 ms (plain Node HTTP server, zero dependency load).
- **Authentication:**
  - Uses `GEMINI_API_KEY` from environment / `.env`.
  - Server halts if key is absent.
  - Key passed as `x-goog-api-key` header; never logged or exposed in client responses.
- **Rate Limits & Privacy:**
  - Bound to Gemini API project quotas.
  - Food description processed strictly in memory; no persistent logging of user meal text.

---

## 2. Baseline Evaluation Summary (Offline Mode)

Evaluated using `scripts/eval-food-logging.ts` against `__tests__/fixtures/food-golden.json` (45 golden-set items including multi-item combinations, Indian staples, typos, and western foods).

### Baseline Metrics (Current App State — Offline)
- **Total Golden Items:** 45
- **Resolved Items (with non-zero nutrition):** 28 (62.2%)
- **Items within ±30% Reference kcal:** 23 (51.1%)
- **Items with Strict Validation Errors / Missing:** 17 (37.8%)
- **Median Offline Latency:** < 5 ms

### Key Failure Modes Identified in Baseline
1. **Trailing quantities:** Items such as `"fried rice 1 bowl"`, `"frooti 200 ml"` fail or drop quantities.
2. **Compound / regional units:** `"1 vada pav"` parsed as unit `"vada"` + food `"pav"`.
3. **Typos in staple units:** `"1 tablesppon ghee"` failed to resolve unit and defaulted to whole portion.
4. **Hinglish aliases:** `"4 paranthe"`, `"1 aloo sandwich"` did not match canonical catalogue names.
5. **Multi-item dump:** In the old `resolveLogText` resolver, if any single item in a multi-item sentence failed, the entire string dropped to manual entry with 0 kcal.

These metrics establish the baseline to be improved by Part 2 (parser/catalogue expansion) and Part 3 (staged pipeline).

---

## 3. Post-Implementation Evaluation Summary (Gate B)

Following the completion of Parts 2 through 8 (Parser whitelist, typo tolerance, trailing quantities, catalogue expansion, staged resolution pipeline, Forge-style `FoodItemCard`, cardio steps, and proxy v2 upgrades), the golden evaluation suite was re-run offline:

### Verified Metrics (Gate B — Offline)
- **Total Golden Items:** 45
- **Resolved Items (Coverage):** 45/45 (**100.0%**) (up from 62.2%)
- **Items within ±30% Reference kcal:** 45/45 (**100.0%**) (up from 51.1%)
- **Items with Strict Validation Errors / Missing:** 0 (**0.0%**) (down from 37.8%)
- **Offline Latency:**
  - p50: **1 ms**
  - p95: **4 ms** (sub-50ms target met with large headroom)

### Resolution Breakdown
- 100% of tested regional and multi-item descriptions (e.g. `"4 paranthe, 1 chai, fried rice 1 bowl, half bowl aloo sabji, 1 vada pav"`) resolve into individual segmented items with non-zero macros without dumping to an empty manual form.
- Typo resilience (`"1 tablesppon ghee"`) resolved cleanly to 135 kcal without portion inflation.
- Trailing amounts (`"fried rice 1 bowl"`, `"frooti 200 ml"`) resolved correctly with intended quantity and volume.
- Ghee and Keema kaleji reflect authentic portion macros and 0-cal saves are strictly guarded.
