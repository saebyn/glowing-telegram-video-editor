# 64 — Investigate the viewport-fit drag test flake

Status: needs-triage

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
