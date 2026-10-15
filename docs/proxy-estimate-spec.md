# GymOS Food Estimation Proxy Specification & Contract (Phase C)

## Overview
This document specifies the communication contract, prompt engineering rules, and client-side handling for the GymOS AI food scanner proxy.

---

## 1. Proxy Architecture & Audit of Existing Implementation (`proxy.mjs`)

| Dimension | Existing Implementation (`gymos-proxy/proxy.mjs`) | Required Contract (Phase C) |
|---|---|---|
| **Model** | `gemini-3.5-flash-lite` (via `GEMINI_MODEL` env var) | `gemini-3.5-flash-lite` or `gemini-2.5-flash` with structured JSON output |
| **Endpoint** | `POST /estimate` | `POST /estimate` |
| **System Prompt** | Generic nutrition prompt instructing preservation of stated items and rough macro/micro estimates. | Explicit classification rules: classify category (`dish`, `drink`, `ingredient`, `spice`, `packaged`) before estimating; enforce non-zero kcal for caloric foods; apply standard Indian serving sizes. |
| **Web Search** | **None** (plain `generateContent` call without tool use) | Grounding with Google Search (`tools: [{ googleSearch: {} }]`) when confidence is low or the query refers to regional / branded FMCG items (e.g. "Lahori Jeera"). |
| **Cold Start / Timeout** | 60,000 ms timeout via `AbortController`. Spun-down serverless / free-tier containers can take ~50s to wake up. | Client has a 12s timeout with 1 retry before falling back to manual input. Proxy keeps 60s timeout. |
| **Root Causes for Failure** | **"lahori jeera"**: No category classification; Gemini confuses the beverage with cumin spice ("jeera") or assigns 0 kcal. <br/> **"chole bhature"**: Decomposes items inconsistently or returns 0 kcal for bhature because it lacks standard Indian portion defaults and allows 0 kcal through schema validation. | 1. Mandatory category classification (`drink` vs `spice` vs `dish`).<br/>2. Zero-calorie protection: proxy prompt and client validator reject 0 kcal for food items.<br/>3. Web search grounding for branded items. |

---

## 2. API Schema Contract

### Request: `POST /estimate`
```json
{
  "description": "1 bowl chole, 2 bhature"
}
```

### Response: `200 OK`
```json
{
  "foods": [
    {
      "name": "Chole Masala",
      "category": "dish",
      "estimatedAmount": 1,
      "unit": "bowl",
      "gramsOrMl": 200,
      "calories": 280,
      "protein": 11,
      "carbs": 38,
      "fat": 10,
      "fiber": 9,
      "confidence": 0.9,
      "source": "model",
      "assumption": "Cooked chickpeas in spiced gravy, standard 1 bowl (200g)",
      "sodium": 450,
      "potassium": 320,
      "calcium": 60,
      "iron": 3.2,
      "magnesium": 45,
      "zinc": 1.5,
      "vitaminA": 25,
      "vitaminC": 4,
      "vitaminD": 0,
      "vitaminB12": 0,
      "folate": 80
    },
    {
      "name": "Bhatura",
      "category": "dish",
      "estimatedAmount": 2,
      "unit": "piece",
      "gramsOrMl": 140,
      "calories": 440,
      "protein": 8,
      "carbs": 56,
      "fat": 20,
      "fiber": 2,
      "confidence": 0.88,
      "source": "model",
      "assumption": "Deep fried maida bread, 2 standard medium pieces (~70g each)",
      "sodium": 320,
      "potassium": 110,
      "calcium": 25,
      "iron": 1.8,
      "magnesium": 20,
      "zinc": 0.8,
      "vitaminA": 0,
      "vitaminC": 0,
      "vitaminD": 0,
      "vitaminB12": 0,
      "folate": 30
    }
  ],
  "totals": {
    "calories": 720,
    "protein": 19,
    "carbs": 94,
    "fat": 30,
    "fiber": 11,
    "sodium": 770,
    "potassium": 430,
    "calcium": 85,
    "iron": 5,
    "magnesium": 65,
    "zinc": 2.3,
    "vitaminA": 25,
    "vitaminC": 4,
    "vitaminD": 0,
    "vitaminB12": 0,
    "folate": 110
  },
  "contractVersion": 2
}
```

---

## 3. Backward Compatibility & Tolerance

The client app supports **both**:
1. **New Phase C Contract**: includes `category`, `confidence`, `source`, `assumption`, and `gramsOrMl`.
2. **Legacy Contract**: provides basic 16 nutrients + `estimatedAmount` + `unit`. In this case, `confidence` defaults to 0.7, `source` defaults to `"model"`, and `assumption` is inferred from portion amount.
3. **Zero-Calorie Rejection**: Any food item returning 0 kcal (unless explicitly classified as pure water or calorie-free spice) is marked `unresolved: true` and routed to the manual entry sheet with `status: "needs-input"`. Silent 0 kcal saves are strictly prohibited.
