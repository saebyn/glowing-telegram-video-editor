# 21 — Snap placement moves

Resolution: implemented and verified placement move snapping
Depends on: [02](02-select-and-move-placements-together.md)

## Proposal

Add optional snapping to pointer drags of existing clip placements. Show
the alignment during the drag and commit the position that was previewed.

## Acceptance criteria

- Add a keyboard-operable **Snap** toggle to the sequence editor toolbar
  with an accessible pressed state. It starts off and is editor UI state for
  the session, not part of the sequence or Undo history. Toggling it does not
  emit `onSequenceChange` or `onCutListResult`. With it off, pointer drags
  retain the existing whole-sequence-frame positioning and show no guide.
- With snapping on, compare either edge of every moving placement against
  the playhead and both edges of stationary placements on any track,
  including locked tracks. Use effective placement ranges and exclude the
  placements being moved from the targets. A candidate is within reach when
  the horizontal distance from the unsnapped edge to the target is at most
  8 CSS pixels at the current zoom. The drag still resolves to whole
  sequence frames.
- Take the closest candidate that passes the existing move evaluator for
  the whole group. For equal distances, prefer the earlier resulting start
  of the grabbed placement; if the destination is identical, show the
  earlier target frame. If no candidate is valid, use the ordinary unsnapped
  destination and its usual blocked feedback, if any.
- Apply one common sequence-frame offset to all moving placements and do
  not change the requested track shift. Show a guide at the winning target
  frame and show the exact destinations in the drag preview. Use the same
  snap resolution for preview and release; do not commit a destination
  different from the one previewed. Clear the guide when no snap applies or
  the gesture ends. A valid changed drop emits one sequence change and one
  `CutList` result and is one Undo step; a blocked or unchanged drop emits
  neither callback.
- Verify a single placement snapping to the playhead, a group snapping via
  a companion's edge to a stationary edge on another track, equal-distance
  tie-breaking, and a nearer blocked candidate giving way to a valid one.
  Cover fallback to the unsnapped move, snapping off, and the same
  pixel tolerance at different zoom levels. In a controlled Storybook
  scenario, check that the guide and preview agree with the committed frames
  and that Undo restores the group together.

## Out of scope

Ruler-tick snapping, per-target toggles, persistence, keyboard nudges, trims,
and clip-pool drops.

## Comments

- Keplar's native drag snapping does not drive our custom placement drag.
   Guide rendering is a Timeline detail; use the existing frame-based move
   evaluator to validate snapped destinations.
- Observed red → green at the callable move evaluator and through real
  Storybook pointer drags. The eight evaluator and four browser tests cover
  both tie-breakers, a nearer blocked candidate, zoom tolerance, the exact
  guide and preview, and atomic commit and Undo.
- Passed 138 unit tests and 34 targeted Playwright tests on static Storybook,
  with the toggle and guide checked in light and dark mode. Typecheck,
  focused lint and formatting, and `git diff --check` passed. Killed 19/19
  targeted mutants (9 evaluator, 10 browser); logs:
  `/tmp/opencode/sequence-snap-21-mutations/`.
