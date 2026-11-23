# 03 — Grow the sequence on trailing trim

Resolution: implemented in `dc35b6b`
Depends on: None

## Acceptance criteria

- In the Inspector, the trailing trim of a supported placement can extend past the current sequence endpoint without moving its leading edge.
- A valid trim respects source bounds and the next placement on the same track. Duration extends just enough in the same edit; a shorter trim leaves duration unchanged.
- The reusable clip and other placements are unchanged. A blocked or unchanged trim emits neither callback.
- Cover the behavior through the Inspector in this ticket. Timeline edge gestures are part of [08](08-trim-placements-on-the-timeline.md).

## Comments

- Implemented Inspector trailing trim via the shared trim evaluator. The edit
  preserves the leading edge, reusable clip and other placements, and grows the
  sequence only to the new exclusive end. Blocked and unchanged inputs do not
  commit.
- Red → green: before the fix, a valid source out past the sequence endpoint
  emitted no sequence change in Playwright. The strengthened test also failed
  against a clean baseline: source out `500` must grow the 360-frame sequence to
  `386` and publish exactly one sequence and one matching `CutList`. The focused
  Vitest safe-frame test also went red before the fix, returning the unsafe end
  `9007199254740992` instead of rejecting it.
- Verified: `SequenceEditor.trim.browser.ts` passed all 3 tests against
  Storybook on port 6013; `npm test -- --run src/utils/trimPlacement.test.ts
  src/utils/sequence.test.ts` passed all 19 tests. The tests cover shorter trims,
  source bounds, exact same-track edge contact, unchanged trims, both fade
  exclusions and mixed-rate rejection. `npm run typecheck`, focused Oxlint,
  trim-owned formatting and `git diff --check` passed. Targeted mutations
  skipping the one-frame minimum, rejecting exactly one frame, taking the
  first clip rather than the matched clip, or mishandling equivalent rates
  were killed by the evaluator tests.
- The three Inspector trim cases also passed on a static Storybook build in
  both light and dark Chromium color schemes.
- Stryker ran the trim evaluator and Inspector integration mutations in an
  isolated Storybook/Vitest snapshot: 85 killed, 19 survived, 1 timed out
  (105 total, before the targeted clip lookup/rate additions). Remaining
  lower-priority survivors include defensive Inspector guards and a
  missing-duration fallback. Report:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket03-current/reports/mutation/mutation.json`.
- Recheck on `feat/sequence-editor`: all three Inspector trim cases passed in
  the 41-test static Storybook/Chromium suite. No Inspector trim blocker found.
