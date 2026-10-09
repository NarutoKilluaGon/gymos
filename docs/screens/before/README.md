# GymOS Screen State Reference — Round 2 Baseline

This directory documents the visual baseline across viewports (360×800 and 412×915) prior to Round 2 implementation.

## Screen Coverage
1. **Fresh-install Onboarding**:
   - Welcome step (wordmark, primary CTA)
   - Goal cards
   - Personal details / targets
   - Template selection
   - North star setup
2. **Home Tab (`/`)**:
   - Empty state (fresh install)
   - Active state (live session / completed workout recap, quick actions, macro summary, recent activity)
3. **Workouts Tab (`/workouts`)**:
   - Today view: scheduled workout card, completed recap, empty state
   - Plan editor: day selector, exercise rows, target inputs
   - History: weekly groupings, muscle balance summary, PR feed
   - Live Session: header with timer, sticky summary strip, set rows, docked Finish bar
4. **Nutrition Tab (`/nutrition`)**:
   - Today view: compact date strip, calorie ring + tabular numbers, macro breakdown, meal sections, docked composer
   - Insights: weekly/monthly analytics
   - Kitchen: meals, foods, recipes list
   - Me: daily macro targets and change log guard
5. **Hub Tab (`/hub`)**:
   - Settings, module toggles, data export/import

## Verification
- Route isolation: Progress tab is completely removed from navigation (`FEATURES.progress = false`).
- Device target: Tested on 360×800 and 412×915 Android viewports.
