# 31 — Preserve transitions when moves leave missing frames

Status: ready-for-agent
Resolution: implemented and verified at the `CutList` and host callback boundaries
Depends on: [37](37-represent-entry-and-reveal-fades-as-transition-objects.md)

A move can change what a transition blends with or leave no picture on one
side. Neither is a reason to discard the transition.

## Proposed acceptance criteria

- Preserve the transition's identity, edge, and duration through an
  otherwise valid move. Discover its counterpart from the new visible
  layout rather than pinning it to the previous placement.
- Use black for the missing side of the blend wherever the new layout
  supplies no picture, and silence if the transition affects audio and
  that side has no audio. Also preserve transitions on stationary
  placements affected by the move. Do not shorten or remove a transition
  or ask for confirmation just because a counterpart is missing.
- Use the same gap behavior when a transition is added next to an
  existing gap or a trim opens a gap. If a move or trim creates a
  transition conflict, preserve both objects and report the output as
  unsupported.
- An otherwise valid trim that leaves a placement shorter than its fade
  keeps the fade's anchored duration. Resolve available footage beyond the
  trim; a different visible cut in the window is unsupported, not hidden
  by the fade.
- Keep the authored edit even if the current `CutList` cannot express the
  result: emit `null`, not a different edit. Verify at the authoring and
  compiler boundary, not by requiring black or silence in decoded media.

## Comments

- The local transition design supersedes the earlier
  confirm-before-removal proposal.
- Trims still obey source and same-track placement bounds, but no longer
  use fade durations as a minimum placement length. Transition inspection
  resolves recorded source extensions where available; the edit and
  authored durations stay intact when the published `CutList` cannot
  express them. An interior gap where a fade expects its counterpart is
  reported as a missing contribution, not a rejected edit.
- Red → green: a trim shorter than its fade initially returned no edit;
  a move that opened a gap had no transition-specific feedback. Vitest and
  Chromium coverage now check both cases, exact IDs and duration, a conflict
  created by trim, and the recorded source extension. Static Storybook:
  46 fade and trim checks passed in light and dark. Stryker killed 46/67
  trim/extension mutants, with 21 surviving and no timeouts. Report:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket31-fade-trim/reports/mutation/mutation.json`.
