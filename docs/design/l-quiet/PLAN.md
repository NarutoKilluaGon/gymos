# L · Quiet Design System Implementation Plan

This document establishes the architecture, element mappings, file inventory, and risk controls for re-skinning and re-composing GymOS into the **L · Quiet** design system without altering storage, domain services, or application behavior.

---

## 1. Baseline Verification (Phase 0)

- **Branch**: `redesign/l-quiet` (branched directly from `main` at `ab32bf3`)
- **TypeScript**: `npm run typecheck` passed with **0 errors**.
- **ESLint**: `npm run lint` passed with **0 errors**, 6 pre-existing warnings in `today-view.tsx` and `use-food-logger.ts`.
- **Jest**: `npm test` passed: **86 test suites passed, 86 total** (862 passed, 3 skipped, 865 total).
- **Screenshots**: Rendered and captured HTML reference mockups at 390×844:
  - `docs/design/l-quiet/screenshots/L_Home.png`
  - `docs/design/l-quiet/screenshots/L_Forge.png`
  - `docs/design/l-quiet/screenshots/L_Nourish.png`

---

## 2. Token Inventory Grouped by Phase

Total files referencing legacy tokens (`hex`, `rgba`, `HOME`, `F`, `N`, `GymColors`, `Type`, `Font`): **92 files** across `src/`.

### Phase 1: Tokens and Fonts
- `src/constants/quiet.ts` (NEW: single source of truth for `Q`)
- `src/constants/design.ts` (Alias onto `Q`)
- `src/constants/theme.ts` (Alias `HOME`, `GymColors` onto `Q`)
- `src/constants/forge-theme.ts` (Alias `F`, `FORGE` onto `Q`)
- `src/constants/nourish-theme.ts` (Alias `N`, `NOURISH` onto `Q`)
- `src/contexts/theme-context.tsx` (Extend `Theme` with `accent`)
- `src/global.css` (Font imports & declarations)
- `app.json` (Splash `#141311`, notification color `#C9A25A`)
- `src/app/_layout.tsx` (Font loading & splash gating)

### Phase 2: Design System Primitives (`src/components/ds/*` & `src/components/ui/*`)
- `src/components/ds/button.tsx`
- `src/components/ds/card.tsx`
- `src/components/ds/cardio-section.tsx`
- `src/components/ds/chip.tsx`
- `src/components/ds/date-navigator.tsx`
- `src/components/ds/empty-state.tsx`
- `src/components/ds/field.tsx`
- `src/components/ds/list-row.tsx`
- `src/components/ds/screen-header.tsx`
- `src/components/ds/seg.tsx`
- `src/components/ds/sheet.tsx`
- `src/components/ds/stat.tsx`
- `src/components/ds/typography.tsx`
- `src/components/ui/progress-bar.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/gym-card.tsx`
- **New primitives**: `ModuleRow`, `WeekStrip`, `ProgressLine`, `SetBar`, `Stepper`, `QuietTabBar`, `TextLink`, `Composer`

### Phase 3: Shell & Navigation
- `src/components/app-tabs.tsx`
- `src/components/app-tabs.web.tsx`
- `src/app/_layout.tsx` (Navigation container theme `DarkTheme`)

### Phase 4: Home Screen
- `src/services/dashboard/home-sentence.ts` (NEW: pure function + unit tests)
- `src/app/index.tsx`
- `src/components/dashboard/greeting.tsx`
- `src/components/dashboard/north-star-card.tsx`
- `src/components/dashboard/north-star-setup-card.tsx`
- `src/components/dashboard/streak-card.tsx` (Replaced by header integration)
- `src/components/dashboard/suggestion-card.tsx` (Replaced by hero sentence)
- `src/components/dashboard/workout-card.tsx` (Replaced by Forge module row)
- `src/components/dashboard/daily-targets-card.tsx` (Replaced by Move/Water module rows + action links)
- `src/components/dashboard/first-run-checklist.tsx`
- `src/components/dashboard/supplement-log-sheet.tsx`
- `src/components/fab/gym-fab.tsx` (Removed; actions reachable via action-links row)

### Phase 5: Forge Screen
- `src/app/workouts.tsx`
- `src/components/workouts/forge-app.tsx`
- `src/components/workouts/forge-today.tsx`
- `src/components/workouts/forge-session.tsx`
- `src/components/workouts/session-header.tsx`
- `src/components/workouts/set-row.tsx`
- `src/components/workouts/exercise-card.tsx`
- `src/components/workouts/bottom-bar.tsx`
- `src/components/workouts/summary-strip.tsx`
- `src/components/workouts/number-field.tsx`
- `src/components/workouts/forge-sheets.tsx`
- `src/components/workouts/forge-plan.tsx`
- `src/components/workouts/forge-history.tsx`
- `src/components/workouts/forge-ui.tsx`

### Phase 6: Nourish Screen
- `src/app/nutrition.tsx`
- `src/components/nutrition/today-view.tsx`
- `src/components/nutrition/summary-card.tsx`
- `src/components/nutrition/summary-card-view-model.ts`
- `src/components/nutrition/food-item-card.tsx`
- `src/components/nutrition/kitchen-view.tsx`
- `src/components/nutrition/insights-view.tsx`
- `src/components/nutrition/me-view.tsx`
- `src/components/nutrition/log-sheets.tsx`
- `src/components/nutrition/more-sheets.tsx`
- `src/components/nutrition/nourish-charts.tsx`
- `src/components/nutrition/nourish-ui.tsx`
- `src/components/nutrition/nourish-app.tsx`

### Phase 7: Hub and Remaining Surfaces
- `src/app/hub.tsx`
- `src/components/hub/*` (About, ExerciseLibrary, Export, Import, Modules, PRs, Reminders, Supplements, WorkoutHistory)
- `src/components/insights/*` (GoalProgress, Heatmap, InsightsSheet, MonthlySummary, SummaryCard, VolumeTrendCard)
- `src/components/journal/*` (JournalTimeline, TimelineItem)
- `src/components/progress/*` (ExerciseProgressChart, MeasurementChart, Progress)
- `src/components/quick-add/*` (JournalSheet, MeasurementSheet, SleepSheet, WeightSheet)
- `src/components/onboarding/onboarding-screen.tsx`
- `src/components/ui/module-disabled.tsx`
- `src/components/ui/toast-host.tsx`

### Phase 8: Cleanup & Final Validation
- Remove legacy aliases and deprecated files (`forge-theme.ts`, `nourish-theme.ts`, deprecated `GymColors`, dead components).

---

## 3. Home Screen Element Migration Map

| Current Home Element | New L · Quiet Placement | Styling & Behavior |
|---|---|---|
| **Top Greeting** (`Greeting`) | Screen Header Left | `Good morning / afternoon / evening`, 600 weight, `Q.ink`. No container. |
| **Streak** (`StreakCard`) | Screen Header Right | `N day streak` in `Q.brass` (`meta13`). Hidden when streak is 0. |
| **Offline Indicator** | Screen Header Right (next to streak) | `Offline` text in `Q.mute` (`meta13`). No red badge or icon. |
| **North Star** (`NorthStarCard` / `NorthStarSetupCard`) | North Star Hero Block | 15px brass star icon + `North star` (`meta13 mute`). Goal title in `homeGoal` (`Funnel Display 50px 500`). Below it: dynamic sentence. Tapping opens existing detail/edit modal. Empty state renders `Set a north star` with outline button. |
| **Suggestion Card** (`SuggestionCard`) | Dynamic Hero Sentence | Below North star goal title: one plain sentence (`sentence`, `Q.mute`, max-width 300) derived via `getHomeSentence`. Actions moved into the relevant module row. |
| **Week Strip** (NEW) | Below North Star Block | 7 equal columns (M T W T F S S). Today: letter `ink` 600, dot filled `brass`. Past: ring `lineStrong`. Future: ring `line`. Past day met goal: dot filled `brass`. |
| **Workout Card** (`WorkoutCard`) | Forge Module Row | Hairline top row. 8px ember dot + `Forge` (21px 500). Subtitle indented 17px (`Push · not started` / `Push · in progress` / `Push · done · {vol}` / `Rest day`). Action on right: `Start` or `Resume` (ink button, 14/600). 2px ember progress line below. Tapping row navigates to `/workouts`. |
| **Nourish Summary Card** | Nourish Module Row | Hairline top row. 8px sage dot + `Nourish` (21px 500). Subtitle indented 17px (`{eaten} of {budget} kcal`). Action on right: `Log meal` (sage outline button). 2px progress line with sage fill, red overage past budget tick. Tapping row navigates to `/nutrition`. |
| **Daily Targets: Steps** | Move Module Row | Hairline top row. 8px periwinkle dot + `Move` (21px 500). Subtitle indented 17px (`{steps} of {goal} steps`). Passive (no action). 2px periwinkle progress line. |
| **Daily Targets: Water** | Water Module Row | Hairline top row. 8px cyan dot + `Water` (21px 500). Subtitle indented 17px (`{L} of {goal} L`). Action on right: `+250 ml` (cyan outline button). 2px cyan progress line. Tapping `+250 ml` triggers existing water addition, haptic feedback, and undo toast. |
| **Daily Targets: Sleep** | Quick Action Link Line | Below module rows: `Sleep` link in text-link line (`Weigh in · Sleep · Journal · Cardio`), opens `sleep-sheet`. |
| **Quick Action Shelf & FAB** | Quick Action Link Line | Coloured icon shelf and FAB removed. Secondary text link line (`Weigh in · Sleep · Journal · Cardio`, 14/600 `ink`, gap 18) opens respective sheets. |
| **First-Run Checklist** | Hairline Rows Below Links | Rendered as clean hairline rows until dismissed. |
| **Supplements Row** | Hairline Row Below Links | Only rendered if supplements are configured. Tapping opens `supplement-log-sheet`. |
| **Recent Activity Feed** | Hairline List Below Links | Clean hairline list without cards, max 5 items, preserving existing merge and sort logic. |

---

## 4. Tests Coupled to Restyled Components

The following 25+ test suites directly touch restyled components or their copy:
1. `__tests__/home-active-workout.test.tsx`
2. `__tests__/home-load-isolation.test.tsx`
3. `__tests__/home-rollover.test.tsx`
4. `__tests__/home-suggestions.test.ts`
5. `__tests__/workout-card.test.tsx`
6. `__tests__/daily-targets-card.test.tsx`
7. `__tests__/north-star-card.test.tsx`
8. `__tests__/first-run-checklist.test.tsx`
9. `__tests__/ds-components.test.tsx`
10. `__tests__/nourish-summary-card.test.ts`
11. `__tests__/nourish-dock-keyboard.test.tsx`
12. `__tests__/nourish-staged-progress.test.tsx`
13. `__tests__/nourish-food-item-card.test.tsx`
14. `__tests__/nourish-phase-b-component.test.tsx`
15. `__tests__/nourish-phase-b-ui.test.ts`
16. `__tests__/nourish-polish.test.tsx`
17. `__tests__/nourish-occasions.test.ts`
18. `__tests__/steps-service.test.ts`
19. `__tests__/motion-haptics-v2.test.tsx`
20. `__tests__/forge-session-v2.test.tsx`
21. `__tests__/forge-session-flush.test.tsx`
22. `__tests__/forge-session-drafts.test.tsx`
23. `__tests__/forge-prs-hook.test.tsx`
24. `__tests__/forge-reopen-active-session.test.tsx`
25. `__tests__/forge-app-background-flush.test.tsx`

*Rule*: Tests will not be skipped or deleted. Any assertion updates (e.g. renamed "Workouts" -> "Forge", updated copy) will be tracked and documented.

---

## 5. Risk Assessment & Mitigations

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| **Font Loading Flash / Mismatch** | App shows system fallback or crashes if font family name differs across platforms. | Use Expo SDK 57 compliant `@expo-google-fonts/funnel-display` & `funnel-sans` (or bundled TTFs). Keep native splash screen visible until fonts are resolved. Hide font names behind `Q.type.*` tokens. |
| **Tab Navigation Compatibility** | Custom headless tab bar may encounter platform quirks on Native vs Web in SDK 57. | Build custom `QuietTabBar` adhering to Expo Router SDK 57 conventions; test on web and mobile layout environments. |
| **Forge Session State Decoupling** | Active session has intricate draft persistence, timers, and background flush logic. | Retain exact hooks (`use-forge`, `forge-engine`, `services/forge/*`); modify only presentation components (`SetBar`, `Stepper`, exercise focus layout). |
| **Dock Keyboard Occlusion** | Nourish composer and quick links must stay attached to keyboard top on Android. | Reuse existing keyboard offset logic validated in `nourish-dock-keyboard.test.tsx`. |
| **Accidental Token Leakage** | Hardcoded colors or old theme constants left behind. | Grep gate enforced in Phase 8/9 before completion. |
