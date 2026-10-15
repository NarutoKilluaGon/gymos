# Batch 2 Verification Notes: Home Polish (2.1 - 2.6)

Date: 2026-10-15
Branch: `redesign/l-quiet`
Commit: `l-quiet(fix 2): home polish`

## Summary Table

| Item | Description | Status | Evidence / Verification |
|---|---|---|---|
| 2.1 | Action links row | **PASS** | Updated `TextLinkBar` and `TextLink` in `src/components/ds/text-link.tsx`: items styled 14/600 `Q.color.ink`, left-aligned with `gap: 18`, bullets removed (`showBullets: false`), `marginTop: 26`, and `minHeight: 44, minWidth: 44, hitSlop: 8`. |
| 2.2 | First-run checklist | **PASS** | Completely redesigned `src/components/dashboard/first-run-checklist.tsx`. Removed old card container, rounded boxes, colored pill tags, and brass circle fills. Implemented flat hairline rows matching module-row style, sentence case header `Get started · N of 3 done` with `Dismiss` action link, 16/500 `ink` titles, and 16px mute check/chevron icons. Tapping completed item is a no-op; incomplete item routes to action. |
| 2.3 | Sentence-case section labels | **PASS** | Removed `textTransform: 'uppercase'` and `letterSpacing: 1` across all labels in `src/app/index.tsx`. `North star`, `Recent activity`, and `Get started` all render in clean sentence case `meta13` mute (`fontFamily: Q.font.sansRegular, fontSize: 13, color: Q.color.mute`). |
| 2.4 | Recent activity rows | **PASS** | Flat hairline rows (`borderTopWidth: 1, borderTopColor: Q.color.line`, `paddingVertical: 14`), left event title in 16/500 `ink`, subtitle in 13 mute, right relative timestamp in 13 mute. Max 3 items enforced. |
| 2.5 | Offline indicator | **PASS** | Replaced old red badge and `WifiOff` icon with plain small mute text `Offline` in header row next to the streak (`fontFamily: Q.font.sansRegular, fontSize: 13, color: Q.color.mute`), matching mockup minimalism. |
| 2.6 | Supplements module row | **PASS** | Integrated `ModuleRow` for Supplements below Water in `src/app/index.tsx` when `supplementProgress.total > 0`. Shows `Supplements · {taken} of {total} taken` in brass accent with outline action button `Log` and progress line. |

## Visual Verification Artifact
- Headless render screenshot captured at 390×844: `docs/design/l-quiet/verification/batch-2/batch-2-home-polish.png`.
- 88/88 test suites passing (882 tests).
- 0 TypeScript compiler errors.
- 0 ESLint errors.
