# GymOS First-Run & First-Launch Audit

**Date:** 2026-10-09  
**Target Viewport:** Android Phone (360×800 / 412×915)  
**Branch:** feat/ui-ux-unification  

---

## 1. Executive Summary

The first-run experience currently suffers from multiple visual and architectural disconnects:
1. **White Flash & Splash Disconnect**: `_layout.tsx` toggles between `DarkTheme` and `DefaultTheme` based on the system theme, causing a white flash on devices with system light mode. `AnimatedSplashOverlay` renders a bright blue `#208AEF` background with an Expo template logo (`expo-logo.png`).
2. **Missing Safe Area Insets**: Hardcoded `paddingTop` and `paddingBottom` collide with camera punch-holes and Android gesture navigation bars.
3. **No Hardware Back Navigation**: Android back gesture exits the entire application rather than stepping back to the previous onboarding step.
4. **Zero Body Data Collection**: Onboarding previously only collected a high-level goal and free-text "Why". No weight, height, age, sex, or activity level were gathered, leaving Nourish with static generic defaults (2,600 kcal, 140 g protein, 65 kg fallback) and Home with a dashboard full of blank zeros.
5. **Emoji Chrome & Dot Indicators**: Use of casual emojis (`🏋️`, `💪`, `⚖️`, `🧘`, `🏃`, `✅`) and dot indicators inconsistent with the calm, premium design system.

---

## 2. Issues & Failure Modes

### Issue 1: Theme & Splash Handoff Flash
- **Code Location**: `src/app/_layout.tsx` (lines 22, 53-73), `src/components/animated-icon.tsx` (lines 36, 143).
- **Observed Behavior**:
  - `_layout.tsx` renders `ThemeProvider` with `DefaultTheme` if the device is set to light mode, despite GymOS being a pure dark-only application.
  - `AnimatedSplashOverlay` flashes `#208AEF` (Expo blue) before `onboardingComplete` loads.
- **Fix**: Force `DarkTheme` permanently in `_layout.tsx`. Update `app.json` splash background to `#0D0E12` and align `AnimatedSplashOverlay` to `#0D0E12` with a calm brand fade-out.

### Issue 2: Safe Areas and Keyboard Overlap
- **Code Location**: `src/components/onboarding/onboarding-screen.tsx`.
- **Observed Behavior**:
  - Hardcoded `paddingTop: Spacing.seven` (32 dp) and `paddingBottom: Spacing.six` (24 dp) clipped into camera cutouts and bottom gesture bars.
  - Text input for "Why" was not wrapped in keyboard-avoiding container.
- **Fix**: Mount `Screen` with `useSafeAreaInsets()` and `KeyboardAvoidingView` / scroll handling.

### Issue 3: Back Button Handling
- **Code Location**: `src/components/onboarding/onboarding-screen.tsx`.
- **Observed Behavior**:
  - Onboarding steps had internal `onBack` callbacks for on-screen buttons, but lacked an Android `BackHandler` listener. A native back gesture immediately terminated the app.
- **Fix**: Add a `BackHandler` listener that intercepts the event and navigates to `step - 1` when `step > 0`.

### Issue 4: Nutrition & Training Zero-State Disconnect
- **Code Location**: `src/storage/repositories/nourish-settings.ts`, `src/services/forge/plan.ts`.
- **Observed Behavior**:
  - Users entered the app without a starting workout plan and with arbitrary generic macro targets.
  - Home showed 0 kcal, 0 protein, 0 water, no workouts scheduled, offering no guidance.
- **Fix**: Implement the 5-step onboarding flow:
  1. **Welcome** (Wordmark + calm promise)
  2. **Goal** (Build muscle · Lose fat · Get stronger · Stay consistent)
  3. **About you** (Units, weight, height, age, sex, activity level → Mifflin-St Jeor daily targets calculation)
  4. **Training** (Starter plan selection via `planFromTemplate` or custom)
  5. **Your Why** (North Star motivation) → Done.
  Home then displays a **"Get started" checklist card** (0/3 items: meal, workout, water) instead of an empty wall of zeros.

---

## 3. Verified Target State Checklist
- [x] Forced dark theme (`DarkTheme`) across `_layout.tsx`.
- [x] Smooth crossfade splash handoff without blue/white flashes.
- [x] 5-screen onboarding flow with thin top progress bar (no emoji).
- [x] Accurate Mifflin-St Jeor formula calculating personalized kcal & protein.
- [x] Starter plan created in Forge settings from selected template.
- [x] Android `BackHandler` integrated for seamless back navigation.
- [x] Home first-run checklist card (0/3) active until initial items logged.
