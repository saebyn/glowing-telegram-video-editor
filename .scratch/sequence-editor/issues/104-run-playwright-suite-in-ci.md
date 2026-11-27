# 104 — Run the standalone Playwright suite in CI

Status: needs-triage
Review priority: P3
Related: [64 — Investigate viewport-fit drag flake](64-investigate-viewport-fit-drag-flake.md)

## Problem

The [test workflow](../../../.github/workflows/unittest.yml#L28) installs
Chromium but runs only Vitest and the packed CSS check. The standalone
Playwright cases covering native gestures and Preview audio can fail without
failing CI. During review, the
[right-edge pool-drop case](../../../src/components/organisms/SequenceEditor.drop.browser.ts#L252)
expected sequence frame 270 but received 273 both in the full run and in
isolation on Chromium 158. It is not yet established whether the drift is in
the test setup or the product.

## Acceptance criteria

- Investigate and stabilize the right-edge case without relaxing the
  requirement that the preview and committed drop match the intended
  sequence frame after autoscroll.
- Run `npm run test:browser` in CI for changes targeting `main`, with
  Chromium installed, a bounded runtime, and useful failure output.
- Verify the workflow keeps Vitest and the packed CSS check and that a
  standalone browser regression makes the browser job fail.
