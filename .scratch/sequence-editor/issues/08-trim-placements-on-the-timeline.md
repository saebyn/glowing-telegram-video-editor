# 08 — Trim placements on the timeline

Resolution: implemented in `dc35b6b`
Depends on: [03](03-grow-sequence-on-trailing-trim.md)

## Acceptance criteria

- Drag either edge of a supported placement to trim that side in place. A leading trim adjusts the source in point and leading sequence position without moving the trailing edge; a trailing trim adjusts the source out point without moving the leading edge.
- Show the proposed edge while dragging. A valid release commits once; an invalid, cancelled, or unchanged drag does not commit. Dragging an edge does not move the whole placement or adjust a fade.
- Respect source bounds, sequence frame zero, and same-track collision rules. Reuse the trailing trim's duration rule: extend when needed and never shorten the sequence.
- Keep the Inspector available for precise edits. This ticket does not broaden trim support to mixed-rate sources or decide how trims affect authored transition regions.

## Comments

- Added separate bottom-corner trim grips for straight cuts at matching rates.
  The preview holds the opposite edge fixed and leaves the authored placement
  alone. A trailing trim uses the timeline's existing edge-scroll headroom and
  observed scroll offset; release applies the same edit as the Inspector.
  Blocked, cancelled, and unchanged drags emit neither host callback.
- Red → green: the leading evaluator first returned no edit for Lighthouse's
  `120 → 144` trim, then incorrectly accepted frame `119` before the
  same-track check. The Playwright tests first failed on missing grips.
  Panning also exposed a widget update loop; keeping its authored rows stable
  during draft/scroll updates fixed it. The trailing pointer test verifies an
  exact 386-frame sequence and all three Harbor `CutList` sections.
- Verified on Storybook port 6018 with Nix Chromium: all six Inspector/timeline
  trim tests passed in light and dark. Focused trim and compiler Vitest suites
  (22 tests), TypeScript, focused Oxlint, and `git diff --check` passed.
  Leading evaluator coverage includes legal sequence frame zero and the
  matched previous clip's effective out point. The six cases also passed
  against an isolated static Storybook build in both Chromium color schemes.
- Stryker on leading edit rules and the timeline trim adapter: 82 killed,
  31 survived, no timeouts (113 total). Survivors include defensive
  missing-placement/clip checks and pointer lifecycle paths not exercised
  by the browser cases. Report:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket08-final/reports/mutation/mutation.json`.
- Confirmed follow-up: trim handles and the Inspector stay available after
  adding an entry or reveal fade. Both edges preserve fade durations and
  accept touching fade regions, but not overlapping ones. Storybook reproduced
  the missing handles and generic blocked message before the fix; browser and
  evaluator regressions cover the working trim and exact one-frame boundary.
- Follow-up Stryker on the trim bounds: 18 killed, 3 survived, no timeouts.
  Survivors affect unknown source duration or an infeasible trim range, not
  the fade-length boundary. The 18 targeted browser cases (fades, trims,
  and pool drops) passed in both color schemes.
- Short-placement regression: in the rough-cut story, a one-frame Lighthouse
  had a 1.48 px placement and both trim grips measured 0 px. The real pointer
  drag failed to preview on both dev and static Storybook. Compact placements
  now get separate trim targets at the bottom of the track row, below the move
  target, without widening the placement or changing its frame scale. The
  regression previews the exclusive edge at sequence frame 393, emits nothing
  while held, and emits exactly one sequence and a `null` `CutList` on release.
- All 47 SequenceEditor browser cases passed in both light and dark on an
  isolated static Storybook, including trims, fades, moves, and move layout.
  The new pointer test passed eight additional repetitions. The 68 focused
  Vitest cases, library build, TypeScript, formatting, and diff checks passed;
  lint reported only pre-existing warnings.
- Browser probes hit both compact grips in a gap and at either sequence
  endpoint, dragged the compact leading edge, selected the one-frame
  placement, and dragged a normally sized neighbor near its trailing edge.
  If several compact placements are only a few pixels apart, their trim
  targets can overlap in the bottom lane (confirmed with two consecutive
  one-frame placements). The grips do not cover their bodies, and the
  Inspector remains available for precise out-point edits. A read-only
  Storybook probe kept the one-frame placement and playhead visible without
  edit grips. No zoom change.
- Focused Stryker with the active mutant injected into Chromium: 40 killed,
  3 survived, no timeouts. The survivors shift or swap grip hit areas without
  defeating a drag started from the currently rendered grip. Report:
  `/tmp/opencode/gtve-short-trim.BecfAA/reports/mutation/isolated.json`.
- The post-selection leading-trim regression now scrolls its grip into view
  before recording geometry. It passed in integrated light and dark Chromium
  without weakening its preview, geometry, or callback assertions.
