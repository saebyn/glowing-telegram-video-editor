# 35 — Split all placements at the playhead

Resolution: implemented and verified in Storybook and at the `CutList` boundary

[10](10-split-at-the-playhead.md) requires a placement selection. Make the
playhead define the scope of the default Split action instead.

## Proposed acceptance criteria

- Enable Split when at least one eligible placement strictly spans the
  sequence playhead. Split all eligible placements at that frame across
  tracks, including covered placements, regardless of which placements
  are selected or inspected.
- Preserve source alignment, tracks, and sequence duration. No edit occurs
  when the playhead only touches placement edges or is in a sequence gap.
- Commit all resulting splits together with one sequence change and one
  compiler result. Undo restores the placements together.

## Comments

- Keep [10](10-split-at-the-playhead.md)'s frame-rate limits. If this
  ships before transition objects, keep the existing fade behavior.
  Once transitions are objects, Split retains each one at its original
  placement edge with its identity and duration unchanged.
- [36](36-split-a-placement-where-you-click.md) covers mouse-driven Split mode.
- Playwright red → green: Split was disabled at frame 30 with no
  placement selected. It now cuts both the visible Lighthouse and the
  covered Harbor at that frame, with one exact callback pair. Three
  focused Chromium tests passed, also covering an unrelated selection,
  joint Undo, an edge, a gap, and transition ownership across Split.
- Typecheck, all 115 Vitest cases, formatting, and diff checks passed.
  Stryker killed 12/13 toolbar and targeting mutants. The survivor removes
  the defensive null check from a handler whose button uses the same
  eligibility predicate. Report:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket35-playhead-split/reports/mutation/mutation.json`.
