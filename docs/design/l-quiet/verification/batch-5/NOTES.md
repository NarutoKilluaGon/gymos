# Batch 5 Verification Notes: Nourish (Today + Insights)

**Date**: 2026-10-15  
**Artifact**: `docs/design/l-quiet/verification/batch-5/batch-5-nourish.png`  
**Status**: PASS

---

## Checks

### 5.1 Calorie Hero
- Replicates `L_Nourish.dc.html`:
  - Over budget: `+1,187` in `Q.accent.red`, `numeralHero` 84px Funnel Display, letterSpacing -0.04em.
  - Under budget: negative sign or remaining value in `Q.color.ink`.
  - Subtitle sentence: "kcal over your 2,258 budget. You've eaten 3,445." in 15 mute (`Q.color.mute`).
  - Progress line: 2px flat line with target tick (1.5px × 12px `ink`), under portion `sage`, over portion `red`.
  - NO ring chart, NO progress arc. The numeral is the whole hero.
- **Result**: PASS

### 5.2 Extra Stats Line
- Sits directly below the macros as a single mute 13pt line: "Eaten 3,445 · Budget 2,258 · Burned 340".
- "Micros ›" styled as an accent text link in `Q.accent.sage` (13/600).
- **Result**: PASS

### 5.3 Macro Columns
- 3 equal columns, hairline-separated (`Q.color.line`), no background boxes.
- Number: 26px Funnel Display (`stat`) in `Q.color.ink`, unit `g` in 13 mute inline.
- Label: 13 mute below ("Protein", "Carbs", "Fat").
- Zero ember/orange used in Nourish macros (protein uses `Q.accent.sage`, carbs `Q.color.mute`, fat `Q.color.lineStrong`).
- **Result**: PASS

### 5.4 Meal Slot Header
- Flat layout without card containers.
- Slot name in sentence-case 13 mute ("Lunch · 1:30 pm").
- Inline pencil icon (16px, `Q.color.mute`) next to slot name.
- Slot macros in 13 mute ("1,020 kcal · 41g protein").
- "Save meal" styled as an accent text link in `Q.accent.sage` (13/600), not an outline button.
- **Result**: PASS

### 5.5 Food Rows
- Flat hairline list (`borderTopColor: Q.color.line`).
- Removed green confidence dot indicator.
- Removed bookmark box/pill; bookmark is an inline icon with 44dp hit target (`Q.accent.sage` when saved, `Q.color.mute` when unsaved).
- Food name in 16/500 `Q.color.ink`. Portion and protein in 13 mute. Kcal in 14 mute right-aligned with `tabular-nums`.
- Long names flexShrink / wrap gracefully without pushing the kcal column off-screen.
- **Result**: PASS

### 5.6 Satiety Selector ("How did it feel?")
- Five text links in a horizontal row: "Very light", "Light", "Good", "Heavy", "Stuffed".
- Font: 13/600 `Q.color.mute`. Selected item: 13/600 `Q.color.ink` with a $5 \times 5\text{px}$ circular `Q.accent.sage` dot above.
- Inactive items have a 5px transparent dot above to preserve baseline and alignment.
- NO emoji, NO pill boxes, NO slider.
- **Result**: PASS

### 5.7 Cardio on Nourish
- `CardioSection` renders flat hairline section with `accentColor={Q.accent.sage}`.
- **Result**: PASS

### 5.8 Insights View
- Macro chart: single hue (`Q.accent.sage` and tints). Zero ember used anywhere.
- Summary row: flat, no card wrappers.
- Granularity toggle: text tabs with 5px sage dot (`Seg` with `accentColor={Q.accent.sage}`).
- Meal-by-meal calorie breakdown: flat `ProgressLine` (3px high, hairline dividers).
- Entire screen uses flat sections with hairline dividers (`borderTopColor: Q.color.line`).
- **Result**: PASS

---

## Test & Build Verification
- `npm run typecheck`: 0 errors
- `npm run lint`: 0 errors
- `npx jest __tests__/nourish-*`: 18/18 test suites passed (213 passed)
- `npx jest --forceExit`: 88/88 test suites passed (882 passed, 3 skipped)
