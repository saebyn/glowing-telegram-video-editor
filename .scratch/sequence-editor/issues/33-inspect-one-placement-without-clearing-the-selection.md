# 33 — Inspect one placement without clearing the selection

Status: ready-for-agent

[02](02-select-and-move-placements-together.md) deliberately shows only a
summary for multiple selected placements. Let an editor check or adjust one
member and then move the same selection without rebuilding it.

## Proposed acceptance criteria

- Keep the selection count and make it clear which selected placement the
  Inspector is showing. Let the editor switch that target without adding
  or removing members. If it leaves the selection, never show stale fields
  for it.
- Show the target's source and sequence ranges and apply the existing
  single-placement Inspector trim and fade controls only to that
  placement. Changing the Inspector target is not an edit.
- A normal timeline click still selects one placement and Shift-click still
  toggles membership. Group drag, nudge, and Delete keep their
  existing selection behavior. No bulk Inspector controls.

## Comments

- Inspired by the [focused-placement clarification in Streamosaic #219](https://github.com/saebyn/streamosaic/issues/219#issuecomment-6952887207).
  Split scope is a separate change in
  [35](35-split-all-placements-at-the-playhead.md).
