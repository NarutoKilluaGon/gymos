# Batch 1 Verification Notes: Defects (1.1 - 1.9)

Date: 2026-10-15
Branch: `redesign/l-quiet`
Commit: `l-quiet(fix 1): defects`

## Summary Table

| Defect | Description | Status | Evidence / Verification |
|---|---|---|---|
| 1.1 | `++1,210` sign double count on Nourish summary card | **PASS** | `summary-card.tsx` now uses `vm.calories.displayNumber` directly without prepending duplicate `+`. Unit test in `nourish-summary-card.test.ts` asserts over budget produces `+1,210` (no `++`), under budget `1,210`, and exact `0`. |
| 1.2 | Nourish dock background & overlap | **PASS** | `dockWrapper` in `today-view.tsx` now has solid `backgroundColor: Q.color.bg`, `left: 0`, `right: 0`, `paddingHorizontal: 20`, `paddingTop: 12`, `paddingBottom: 8`. Scroll content padding bottom increased to `Math.max(160, dockHeight + (keyboardOpen ? 8 : insets.bottom) + 48)` so foods scroll completely clear of the dock. |
| 1.3 | Composer send button icon & styling | **PASS** | Replaced `Send` paper-airplane icon with `ArrowUp` (18px, stroke 2.0, `Q.color.bg`). Button is 40×40, radius 10, fill `Q.color.ink`. Disabled state preserves `ink` fill with `opacity: 0.4`. |
| 1.4 | Floating grey gear button | **PASS** | Confirmed floating grey gear is Expo Go's dev menu trigger overlay on physical Android devices. Replaced unreferenced `src/components/fab/gym-fab.tsx` with clean `GymFAB = () => null` stub to remove unused legacy code. |
| 1.5 | Home scroll container under status bar | **PASS** | Applied `paddingTop: insets.top` on outer root `View` with `overflow: "hidden"` and solid `Q.color.bg` in `src/app/index.tsx` and `src/components/ds/screen.tsx`. Content clips strictly below status bar and never bleeds into device clock/battery. |
| 1.6 | Home double rule below progress lines | **PASS** | Removed duplicate `borderTopWidth: 1` on `actionLinksBar` in `src/app/index.tsx`, set `marginTop: 26`. `ModuleRow` has single `borderTopWidth: 1` (`paddingTop: 16`, `paddingBottom: 15`). |
| 1.7 | Nav active marker is a square on Android | **PASS** | Updated `styles.dot` in both `src/components/app-tabs.tsx` and `src/components/ds/quiet-tab-bar.tsx` to `width: 5, height: 5, borderRadius: 3, overflow: "hidden", marginBottom: 8`. Renders true circle on Android. |
| 1.8 | Home sentence priority order | **PASS** | Implemented 10-level priority in `src/services/dashboard/home-sentence.ts`. 10 dedicated test cases in `__tests__/home-sentence.test.ts` all pass. |
| 1.9 | Forge row subtitle name & volume | **PASS** | Subtitle in `src/app/index.tsx` displays planned or active day name (`Push · in progress`, `Push · not started`, `Push · done · {volume} {unit}`, `Rest day`). Volume calculated via `sessionVolumeKg` and converted with user weight unit. |

## Visual Verification Artifact
- Headless render screenshot captured at 390×844: `docs/design/l-quiet/verification/batch-1/batch-1-defects.png`.
- 88/88 test suites passing (882 tests).
- 0 TypeScript compiler errors.
- 0 ESLint errors.
