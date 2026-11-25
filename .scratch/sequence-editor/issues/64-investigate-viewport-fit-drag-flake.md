# 64 — Investigate the viewport-fit drag test flake

Status: ready-for-agent
Resolution: fixed the test's layout race and verified 20 consecutive passes.

## Proposal

Low priority. The [viewport-fit Playwright test](../../../src/components/organisms/SequenceEditor.layout.browser.ts)
occasionally previewed sequence frame 122 instead of 120 during
[#56 verification](56-remove-unused-legacy-editor-views.md). It also failed
on the pre-removal baseline; the [final integration run](55-make-timeline-transition-indicators-taller.md)
passed without retries. Determine whether the test measures placement
geometry before the resized viewport settles, or the editor itself uses
stale geometry.

## Acceptance criteria

- Repeat the existing real-pointer test with scrollbars visible. On a
  failure, compare placement geometry after the viewport resize with the
  geometry used to start the drag. Record whether the failure is in the
  test or the editor, or note if it could not be reproduced.
- If the test is racing layout, wait for an observable settled layout
  before measuring the pointer path. Do not add a fixed sleep, rely on
  retries, or loosen the exact frame assertion. If a real drag bug is
  found, record a minimal reproduction and track the production fix
  separately.
- Preserve the checks that drag feedback does not change the editor's
  height, the preview is exactly sequence frame 120, no edit emits before
  release, and release emits one sequence proposal and one `CutList` result.
  Verify any test change with repeated runs without retries.

## Comments

- On `1462196`, the unmodified test reproduced frame 122 twice in seven
  runs (one worker, no retries, Chromium 158 with scrollbars enabled).
  Geometry captured in a separate diagnostic points to a test race. When
  the scrollbar disappeared, the timeline widened from 1,121 to 1,136 px,
  but the test measured the placements before their rendered positions
  caught up. At pointer-down the distance between the placements had
  grown from 747.33 to 757.33 px. The test had already computed half the
  old distance, making the drag 5 px too short for frame 120. Runs that
  measured the new geometry previewed frame 120.
- Next step: wait until the rendered placement spacing reflects the
  resized fit viewport before measuring the pointer path. Keep the exact
  assertions and verify the test change without retries. No production
  change is indicated by this reproduction.
- Ready for a low-priority, test-only fix. Use the existing real-pointer
  case to verify the change with scrollbars enabled.
- Reproduced on `23bdc77`: without the geometry wait, 2 of 7 runs
  previewed frame 122 instead of 120. This is the negative control for the
  test-only change and matches the geometry diagnostic above.
- The test now waits for the last Harbor placement, which ends at the
  sequence endpoint, to reach the fitted timeline's right edge before
  measuring the drag. The exact height, frame, and callback assertions
  are unchanged. No production change was needed.
- `npm run test:browser -- SequenceEditor.layout.browser.ts --workers=1
  --retries=0 --repeat-each=20` passed all 20 runs with Nix Chromium
  158.0.8127.36 and scrollbars visible. The run had a 180-second hard
  timeout; `ss -ltnp 'sport = :6007'` confirmed Storybook was no longer
  listening afterward. Typecheck, targeted lint, and formatting passed.
