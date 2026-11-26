# 70 — Show the diagnostic for an invalid source frame rate

Status: ready-for-agent
Resolution: malformed source frame rates no longer crash the editor; diagnostics, unaffected edits, and live metadata correction work.
Review priority: P2
Related: [46 — Make CutList issues actionable](46-make-cutlist-issues-actionable.md)

## Problem

Load the **Rearrange a layered edit** story with
`clips[0].sourceFrameRate.numerator:0`. Chromium shows `Division by zero` instead
of rendering the editor. A fractional numerator such as `29.97` can also
throw during conversion to `BigInt`. The compiler already returns
`invalid-source-frame-rate`, but the
[editing session](../../../src/components/organisms/useSequenceEditor.ts)
and UI assume valid rates when calculating placement durations and edit
availability.

## Acceptance criteria

- Loading a placement with either malformed source rate does not crash the
  editable or read-only editor. The existing diagnostic remains visible.
- Components that cannot calculate valid geometry or edit bounds for that
  placement do not use the malformed rate. Unaffected placements remain usable.
- Replacing the bad metadata with a valid rate restores the placement and
  clears the diagnostic without emitting an edit. Add a browser regression.

## Comments

- Red → green: reproduced division by zero on load and BigInt conversion of
  `29.97` via Storybook Controls. The editor now keeps the compiler's diagnostic,
  skips malformed placement geometry and edit bounds, and restores the placement
  on metadata correction without emitting an edit. The editable regression
  trims an unaffected Lighthouse placement and checks both host callbacks.
- Edit-rule checks cover operations that fit before a malformed placement's
  known start and block operations that need its unknown end. The default
  media Preview also mounts without using the malformed rate.
- 53 focused Chromium checks passed. The combined suite with #74 passed
  239 Vitest tests; typecheck, formatting, and `git diff --check` passed.
  Lint reported only the existing `VideoPlayer` captions warning.
- Four isolated Chromium mutation checks caught removed numerator positivity,
  whole-number validation, Preview geometry validation, and Timeline geometry
  validation.
