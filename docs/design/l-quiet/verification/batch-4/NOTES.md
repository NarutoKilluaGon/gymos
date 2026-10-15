# Batch 4 Verification Notes: Forge Screen Polish

**Date**: 2026-10-15  
**Artifacts**:
- `docs/design/l-quiet/verification/batch-4/batch-4-forge.png` (4 screens side-by-side comparison)
- `docs/design/l-quiet/verification/batch-4/batch-4-forge-active.png` (390×844 active focus view)  
**Status**: PASS

---

## Checks

### 4.1 Forge Today (Rest / Idle View)
- Plan name rendered in 50px `displayRegular` (`Q.type.homeGoal`) with `lineHeight: 1.05`, `letterSpacing: -0.03em`.
- Subtitle sentence rendered in 14 mute (`Q.type.body` in `Q.color.mute`).
- Integrated `WeekStrip` with circular dots.
- Exercises list styled flat with hairline dividers (`Q.color.line`), 15 medium name, 13 mute subtitle/reps.
- Single primary filled `ink` button (height 58, radius 14) for "Start <Workout>".
- "Blank workout" styled as an accent text link in `Q.color.ember`.
- Missed workout banner styled flat as mute sentence with accent text link.
- Flat hairline `CardioSection` with `+ Cardio` text link. All cards removed.
- **Result**: PASS

### 4.2 Forge Active Session Focus View
- Matches `L_Forge.dc.html` layout exactly:
  - Header: 14 mute "Exercise X of Y", 38px medium title (`fontVariant: ['tabular-nums']`), 15 mute exercise context.
  - Set bar: 3px segments (`borderRadius: 2`), active segment filled with ember (`#D97746`), inactive segment in `line`. Subtitle "Set X of Y" with ember 600 weight and "Rest M:SS".
  - Weight and Reps columns: 13 mute label, 84px medium `numeralHero` with unit in 18 mute.
  - Steppers: $52 \times 48\text{dp}$ outline buttons (`borderRadius: 12`, inset border `lineStrong`, transparent background, 22px text).
  - Primary button: single filled `ink` button (`#F2EEE6`), height 58, radius 14, dark text (`#141311`), 17/600 font.
  - Upcoming exercise list: flat rows with hairline top dividers (`1px solid #2B2924`), 15 medium name, 14 mute sets count.
- **Result**: PASS

### 4.3 Forge Plan
- Day selector text tabs with $5 \times 5\text{px}$ ember dot above selected day.
- Weekday toggles (Su Mo Tu We Th Fr Sa) styled flat with $5 \times 5\text{px}$ ember dot above selected days.
- Flat exercise rows with hairline dividers (no `FCard` containers).
- Compact prescription row with outlined `NumberField` (height 44, radius 12, 1px `lineStrong` outline, transparent background).
- "Superset" text link in ember, "Remove" text link in mute (never red).
- "+ Add exercise" and other actions styled as accent text links.
- **Result**: PASS

### 4.4 Forge History
- Grid view: flat hairline table without card borders or outer containers.
  - Sentence-case headers ("Exercise", "27 Sep", "This week").
  - Tabular ink cells (14pt, `tabular-nums`).
  - Personal record (PR) cells marked with $5 \times 5\text{px}$ ember dot and 600 weight ink (no badge, no flame, no trophy).
- List view: flat hairline rows without card wrappers.
- **Result**: PASS

### 4.5 Finish Moment (`SummarySheet` & PRs)
- Flat hairline summary list (Duration, Volume, Sets, Records).
- Single filled ink button (height 58, radius 14) for "Finish".
- Removed animated confetti, bouncing trophy, and loud celebratory banners.
- Records list styled cleanly with $5 \times 5\text{px}$ ember dot.
- **Result**: PASS

---

## Test & Build Verification
- `npm run typecheck`: 0 errors
- `npm run lint`: 0 errors (clean, no unused warnings in Forge)
- `npx jest --forceExit`: 88/88 test suites passed (882 passed, 3 skipped)
