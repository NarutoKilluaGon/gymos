# AI gateway: gymos-proxy as the single intelligence layer

Status: **app side documented and tested. Proxy side NOT yet verified**
(the `gymos-proxy` folder had not been provided when this was written).
Nothing here adds endpoints or changes runtime behavior.

## 1. Principles

1. The app never calls an AI vendor. No Gemini (or any model) SDK, key, or
   URL appears in the app. The only AI network call is to `gymos-proxy`.
2. The proxy is the **replaceable intelligence layer**: swapping the model
   or vendor must not require an app release.
3. **AI interprets; local code computes.** AI turns messy human language
   into structure. Arithmetic, database lookups, classification and
   progress maths stay deterministic, offline, testable, and free.
4. Every AI call has a local fallback. The app is fully usable with the
   proxy down, cold, or unconfigured.

## 2. Boundary

| Through gymos-proxy (AI) | Local, deterministic |
| --- | --- |
| Food understanding from natural language | Nutrition maths for known foods |
| Ingredient extraction | Macro arithmetic, 4P+4C+9F reconciliation |
| Unknown-food interpretation | Calorie budget, cardio add-back |
| Mixed-dish decomposition | Food-catalog lookups (82 entries today) |
| Uncertain portion estimation | Saved foods, saved meals, recipes per serving |
| Eating-out interpretation | Meal-slot classification (time, message text) |
| Recipe understanding | Progress, trends, weight slope, calorie suggestion |

Honest note on coverage: the local catalog has only **82** foods, so today
the AI carries most of the long tail. "Known foods are local" will grow
mainly through the user's own saved foods (every confirmed food is
remembered with their portion and numbers), not through the catalog.

Not moved to AI yet (by decision): nutrition suggestions, weekly
summaries, recipe assistance, deeper insights. These are local today
(`services/nourish/suggestions.ts`, `weekly-read.ts`).

## 3. Current architecture (app side)

```
UI (today dock, FAB LogFoodSheet, Kitchen recipe)
   |
   v
hooks/use-food-logger.ts  --- looksLikeCardio? --> cardio sheet (local MET maths)
   |
   v
services/nourish/resolve-log.ts :: resolveLogText(text, {saved, eatingOut})
   1. split into segments
   2. bare name matching a SAVED food        -> user's own numbers  (local)
   3. remaining segments, joined, to the provider:
        getDescriptionAiProvider()           -> POST {proxy}/estimate   <-- ONLY AI call
          applyFoodDbPrecedence()            -> exact catalog match overrides AI numbers (local)
   4. provider null / error / invalid        -> offline: catalog, then typical-values table
   5. nothing resolves                       -> manual entry (never silently drops a food)
   6. sanity pass (local): checkCountables, reconcileEnergy, eating-out confidence cap
   |
   v
ReviewSheet (user confirms)  ->  saveDraft -> meals store + rememberFoods
```

The single seam is `DescriptionAiProvider.estimate(description)` in
`services/meal-description-ai-provider.ts`. It is the only file that knows
HTTP exists. `EXPO_PUBLIC_VISION_API_URL` (a public value) selects the
proxy; unset means AI is off and the offline path is used.

## 4. The v1 contract the app enforces today

**Request**: `POST {EXPO_PUBLIC_VISION_API_URL}/estimate` (the app appends
`/estimate` unless the URL already ends with it; trailing slashes are
stripped).

```
headers: accept: application/json, content-type: application/json
body:    { "description": "<free text>" }     <- the ONLY field. No key, no image.
timeout: 60 s (client side)
```

**Success (200)**, validated strictly:

```json
{ "foods": [ {
  "name": "Roti (phulka)",
  "estimatedAmount": 2,
  "unit": "piece",
  "calories": 160, "protein": 6, "carbs": 32, "fat": 1.6,
  "fiber": 4, "sodium": 4, "potassium": 120, "calcium": 20, "iron": 1.6,
  "magnesium": 40, "zinc": 1,
  "vitaminA": 0, "vitaminC": 0, "vitaminD": 0, "vitaminB12": 0, "folate": 24
} ] }
```

Rules (all enforced by `parseDescriptionAiEstimate`, all covered by
`__tests__/proxy-contract.test.ts`):

- `foods` must be a non-empty array.
- Each food: non-empty `name`; `estimatedAmount` a finite number `> 0`;
  non-empty `unit`.
- **All 16 nutrients must be present, numeric, finite, `>= 0`.**
- Nutrition is for the **whole stated amount**, never per 100 g.
- **All-or-nothing:** one bad field in one food rejects the entire
  response. The app then falls back to offline estimation.
- Extra fields are ignored (so additive changes are safe).
- The app ignores any `totals` the proxy sends and recomputes them.

**Failure**: any non-2xx is an `http` error, a network/timeout failure is
`network`, unparseable or schema-invalid JSON is `invalid-response`. All
three trigger the offline fallback. The response body is never shown to
the user.

## 5. Where Nourish expects AI -> mapping

The Nourish prototype called one function, `ai(prompt)`, from seven places.

| Prototype call | What it did | Today in GymOS | Mapped to proxy |
| --- | --- | --- | --- |
| `parse log` | NL food -> items with macros, fibre, sodium, etc. | `resolveLogText` -> `/estimate` | **`/estimate` (exists)** |
| `sane` | Re-ask AI when kcal disagrees with macros | Local `reconcileEnergy` + `checkCountables` | Stay local. Optional retry later |
| `cardioEst` | Calories for free-text exercise | Local MET / distance / stair formulas | Stay local. Optional AI only when local returns null |
| `sugg` | Protein-gap ideas | Local ranking from saved foods + catalog | Future `/suggest` |
| `wk` | Weekly read | Local pattern analysis | Future `/summarize` |
| `recipe` | Per-serving nutrition from method | Kitchen -> `/estimate` on the ingredient list, local sum / servings | `/estimate` now; future `/recipe` for method and cooking-fat reasoning |
| `groc` | Grocery list | Dropped (no UI in the prototype) | Out of scope |

Fields the prototype's food prompt returned that the v1 contract cannot
carry: `sugar`, `cost` (rupees), and per-item `confidence`. The app derives
confidence from the *source* (saved 0.9, catalog 0.85, AI 0.6) rather
than from the model.

## 6. Observations that affect the proxy

1. **Strictness is a reliability cliff.** Missing one micronutrient on one
   food discards an otherwise-good answer. The proxy should validate with
   the same schema before responding, repair or retry, and prefer a clean
   error over a partial food.
2. **Cold starts.** The client allows 60 s. Free hosting (e.g. Render) can
   sleep; the first request after idle may be slow. A cheap `GET /health`
   the app can fire on foreground would hide this (future).
3. **No authentication, by design.** The key is only in the proxy, but the
   endpoint is public, so anyone with the URL can spend your quota. The app
   cannot hold a real secret (`EXPO_PUBLIC_*` is readable). Mitigations
   belong in the proxy: per-IP rate limit, max `description` length,
   request-size cap, daily spend cap, optionally a non-secret app token as
   a deterrent only.
4. **Context is not sent.** The prototype sent user notes ("vegetarian"),
   known foods, and an eating-out flag to the model. v1 sends none. Today
   notes only filter suggestions and eating-out only caps confidence.
5. **Catalog matching is exact-name.** `applyFoodDbPrecedence` only
   overrides AI numbers when the AI's food name equals a catalog name, so
   "Roti (phulka)" vs "Phulka roti" silently skips the local-first rule.
6. **Description is user text** and goes to a third-party model. Decide
   whether the proxy logs it, and say so in the privacy copy.

## 7. Proposed future contract (v2). Not implemented.

Principles: additive, versioned, backward compatible. v1 clients keep
working untouched.

**Shared envelope** (all endpoints):

```
request  header: x-gymos-contract: 2
response header: x-gymos-request-id, x-gymos-model   (observability only)
errors:  { "error": { "code": "invalid_request|rate_limited|upstream|invalid_model_output",
                       "message": "...", "retryable": true|false } }
         400/422 bad input, 429 rate limited (+ Retry-After), 502 model failure, 504 timeout
limits:  description <= 500 chars, one request body <= 4 KB
```

**`POST /estimate`**: unchanged shape, plus optional input and output.

```
+ request.context  (optional, all fields optional)
    { "eatingOut": true,
      "dietNotes": "vegetarian, no mushrooms",          // only if the user opts in
      "usualFoods": ["Dal", "Boiled egg"] }             // names only, never numbers
+ response.foods[].kind            "known" | "unknown"
+ response.foods[].canonicalName   catalog-style name when kind = "known"
+ response.foods[].portion         { amount, unit, grams?, basis: "stated" | "assumed" }
+ response.foods[].confidence      0..1 (the model's, shown beside our source-based one)
+ response.assumptions[]           ["assumed home-cooked, 1 tsp oil"]  // shown in review
```

**`POST /interpret`** (the cleanest realisation of "AI interprets, local
computes"): returns *structure only*; nutrition only for foods the model
marks `unknown`.

```
-> { "items": [ { "kind": "known",   "canonicalName": "Roti (phulka)",
                  "portion": { "amount": 2, "unit": "piece", "grams": 70, "basis": "stated" } },
                { "kind": "unknown", "name": "Paneer bhurji",
                  "portion": { ... "basis": "assumed" },
                  "nutrition": { ...16 nutrients for the whole portion... } } ],
     "assumptions": [] }
```

The app then computes known items from the local catalog and the user's
saved foods, and uses model nutrition only for unknowns. This reduces
hallucinated numbers and tokens, and makes results reproducible. It needs
(a) `canonicalName` values constrained to a list the app supplies or the
proxy mirrors, and (b) more catalog coverage than 82 foods. **Decision to
make before building it.**

**Later endpoints** (shapes sketched only; design when needed):
`POST /suggest` (protein-gap ideas, takes remaining kcal/protein, notes,
usual foods), `POST /summarize` (weekly read, takes aggregated numbers,
never raw logs), `POST /recipe` (method + ingredients -> per-serving),
`POST /insights`. All follow the shared envelope and must degrade to the
existing local implementation when unavailable.

## 8. Rollout order (when the proxy is available)

1. Verify v1 against the real proxy: run
   `GYMOS_PROXY_URL=https://... npx jest proxy-contract`. Fix only mismatches.
2. Add proxy-side schema validation, limits and rate limiting (section 6).
3. Add `x-gymos-contract` and the error envelope, still serving v1 shapes.
4. v2 `/estimate` additions (`context`, `kind`, `assumptions`).
5. Decide on `/interpret` after measuring how often known foods go wrong.
6. Only then, new feature endpoints, each behind a local fallback.

## 9. Checklist for reviewing the proxy folder

- Route path and method really are `POST /estimate`; body field is
  `description` and nothing else is required.
- Response schema: all 16 nutrients, positive `estimatedAmount`, `unit`,
  and is it validated before sending (zod or similar)?
- Whole-amount nutrition, not per 100 g, in the prompt and in the schema.
- Error behavior: status codes, does it ever return 200 with an error body?
- Env var names for the key and model; nothing sensitive in the repo.
- Timeouts vs the client's 60 s; retry policy; cold-start behavior.
- Rate limiting, input length caps, spend cap, CORS irrelevant (native).
- Whether descriptions are logged.
- Where the prototype's Indian-food reference prompt (egg 72 kcal, roti
  100 kcal, 1 tsp oil 45 kcal, etc.) lives and whether it is used.
