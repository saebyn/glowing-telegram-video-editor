# 05 — Adjust fades on the timeline

Status: ready-for-agent
Resolution: implemented in `dc35b6b`
Depends on: None

## Acceptance criteria

- Separate entry and reveal handles let the editor adjust fade durations for placements that support fade editing. Dragging a fade handle does not move or trim the placement.
- The affected transition indicator reflects the adjustment. A valid release changes the same placement property the Inspector edits and emits one sequence and one compiler result.
- Timeline handles and Inspector controls follow the same validation. Placement edges and sequence duration do not move, and compiler representability rules are unchanged.

## Comments

- Implemented separate entry and reveal fade grips as siblings of the placement
  button. Each grip previews its own transition indicator, preserves selection
  and placement edges, and commits only on valid release. A changed scale or
  authored fade clears the pointer draft. Coincident fade edges remain separately
  reachable. No placement-body move/selection handlers were changed.
- The Inspector and timeline use the same fade evaluator: one authored track,
  a positive whole sequence-frame count no greater than the effective placement
  duration, and no edit for the current value. Compiler rules still run only
  after a valid edit; a pair of intersecting fades can emit a `null` `CutList`.
- Observed five red → green browser checks in `StraightCutFixture`: Lighthouse
  entry 30, Harbor reveal 48, adjacent handles and a valid-but-uncompilable edit,
  out-of-bounds/no-removal rejection, and resize cancellation. The five fade
  checks and all three original browser checks (including both Inspector fades)
  passed on both dev and static Storybook. The parent also confirmed all five
  fade checks in static light and dark modes. Typecheck and targeted lint/format
  checks passed.
- Stryker mutated fade edit rules and pointer handling with the Inspector and
  real gesture tests: 70 killed, 43 survived, no timeouts (113 total).
  Survivors include unchanged-value and exact-maximum inputs, secondary
  pointers, and capture-loss paths. Report:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket05-final/reports/mutation/mutation.json`.
- Follow-up: two passing Vitest checks cover a fade spanning the entire
  effective placement and resubmitting the authored duration as a no-op.
  Isolated Stryker verification killed both previously surviving mutants:
  rejecting the exact maximum (`>=`) and removing the unchanged-value guard.
  No production or Storybook changes. Report:
  `/tmp/opencode/sequence-fade-boundary-mutants.3LUAYu/reports/mutation/mutation.json`.
- Recheck on `feat/sequence-editor`: the Inspector and real timeline fade
  gestures passed in the 41-test static Storybook/Chromium suite. No fade
  editing blocker found.
- In the expanded layout, existing raw-pointer tests could start below the
  720 px browser viewport after selection opened the Inspector. The tests now
  scroll the actual fade grip into view before starting the gesture and take
  geometry baselines after that scroll. The drag and edit assertions still use
  real pointer input and exact callback payloads.
