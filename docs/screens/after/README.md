# GymOS Screen State Reference — Round 2 Implementation & Release

This document catalogs the screens and interaction states across phone viewports (320×568, 360×800, 412×915) following Round 2 implementation.

## Screen Matrix & State Catalog

### 1. Onboarding (`src/components/onboarding/onboarding-screen.tsx`)
- **Step 1: Welcome & Goal**: Wordmark, step indicator, goal selection cards (Cut, Bulk, Maintain, Recomp).
- **Step 2: Profile & Biometrics**: Gender, age, height, weight, activity multiplier.
- **Step 3: Starter Plan**: Starter templates (3-Day Full Body, 4-Day Upper/Lower, 5-Day PPL) with inline day previews.
- **Step 4: Targets Review**: Calibrated kcal, P/C/F macros with `CountUp` animation, water target, and step goal.
- **Motion & Haptics**: Step slide + crossfade (280 ms), top progress bar `scaleX` transform, `hapticSuccess()` on completion.

### 2. Home Tab (`src/app/index.tsx`)
- **Header**: Wordmark + compact date, streak counter, settings shortcut.
- **Dynamic Hero**:
  - Empty / Rest state: Scheduled session card with primary "Start Workout" CTA.
  - Active session state: Pulsing live indicator, elapsed timer, exercises preview, "Resume Workout" CTA.
  - Completed state: Workout recap with volume, duration, PR count, trophy badge.
- **Quick Actions (4-up)**: Fast logging for Meal, Water (+250ml), Cardio, and Weight/Measurement.
- **Nourish Summary**: Calorie ring + tabular macros, hunger tracker status, remaining target breakdown.
- **Recent Activity**: Chronological timeline of logged meals, sets, and cardio entries.
- **GymFAB**: Docked floating quick-add menu with rotational micro-interaction.

### 3. Workouts / Forge (`src/components/workouts/forge-app.tsx`)
- **Today (`forge-today.tsx`)**:
  - Rest day / Scheduled workout card with day chip strip.
  - 5-week history strip with workout activity dots.
  - "Start Workout" primary button with haptic feedback.
  - Completed workout recap card with PR celebration.
- **Plan Editor (`forge-plan.tsx`)**:
  - Day selector with sliding indicator and 160 ms crossfade.
  - Reorderable exercise rows with scale 1.02 lift, `LinearTransition` neighbours, drop settle spring.
  - Superset grouping badges (`A1/A2`, `B1/B2`).
  - Target input fields for sets, reps (fixed, range `8-12`, AMRAP `8+`), weight, and RPE/failure tags.
- **History & Grid (`forge-history.tsx`, `forge-grid.tsx`)**:
  - Weekly grouped sessions with volume totals.
  - Muscle balance radar/distribution (`Chest`, `Back`, `Legs`, `Shoulders`, `Arms`, `Core`).
  - All-time PR shelf and personal best history.
  - Monthly consistency grid with intensity color mapping.
- **Live Workout Session (`forge-session.tsx`)**:
  - Session timer and active workout elapsed tracking.
  - Sticky summary strip with completed sets count, volume, and rest timer.
  - 52 dp set rows with 48 dp inputs, AMRAP markers, and 44 dp check buttons.
  - Superset rest timer with automatic countdown transition.
  - Docked "Finish Workout" bar with double-tap safety guard and summary sheet trigger.
- **Calendar (`forge-sheets.tsx` CalendarSheet)**:
  - Month change slide (200 ms).
  - Selected-day ring scale-in.
  - Activity dots fade in with 20 ms stagger.
  - Backdated session viewing and logging.

### 4. Nutrition / Nourish (`src/components/nutrition/today-view.tsx`, `kitchen-view.tsx`)
- **Today (`today-view.tsx`)**:
  - Compact date row with tabular calendar navigation.
  - Ring card with tabular figures and macro split bars.
  - Meal sections (Breakfast, Lunch, Snacks, Dinner) with 44 dp `+` manual log triggers.
  - Hunger feedback selector (`Still hungry`, `Just right`, `Too full`) on its own row.
  - Docked food composer with non-overlapping bottom insets.
- **Kitchen (`kitchen-view.tsx`)**:
  - Header segment (`Meals · Foods · Recipes`) with live count badges.
  - Independent `+ New` creation flows for each entity type.
  - Recipe builder with fractions parsing (`1/2`, `½`, `half`), Indian/global catalog resolution, servings stepper (default 1, min 0.5), live per-serving macros, and ingredient review rows.
  - Ingredient status chips with color crossfade (`Matched`, `Estimated`, `Needs input`).
- **Insights & Me (`insights-view.tsx`, `me-view.tsx`)**:
  - Macro adherence charts and 14-day target guard explanations.
  - Change log history view for macro recalculations.

### 5. Hub Tab (`src/app/hub.tsx`)
- Settings, module toggles, data backup, export, and JSON import with schema validation.

## Device Viewport & Accessibility Verification
- **Viewports tested**: 320×568 (SE), 360×800 (Android Standard), 412×915 (Android Large/Pixel).
- **Navigation modes**: Gesture navigation & 3-button system bars.
- **Typography scaling**: Font scale 1.0 and 1.3 verified (tabular figures, flexible wrap, no clipped labels).
- **Reduced Motion**: Disables transforms on Toast progress, CountUp steps immediately, calendar rings snap into place without animation.
- **Progress Tab Isolation**: Verified completely absent from navigation and deep links (`FEATURES.progress = false`).
