# 21 — Snap placement moves

Status: needs-info
Depends on: [02](02-select-and-move-placements-together.md)

## Proposal

Add a snapping toggle and optional targets for placement edges, the playhead,
and the ruler grid. Show what snapped during the drag and make the resulting
position agree with the committed drop. For a group, snapping adjusts one
common sequence-frame offset. It never moves members independently or
bypasses collision rules.

With snapping off, keep existing whole-sequence-frame positioning. Start
with moving existing placements; review trims and clip-pool drops
separately. Decide the initial target defaults and tie-breaking before
implementation.

## Comments

- Not started: initial snap targets, defaults, and tie-breaking still need
  decisions. Existing whole-sequence-frame positioning remains in place.
- Evaluate Keplar's `gridSnap`, `dragLine`, and
  `getAssistDragLineActionIds` in the installed
  [`@keplar-404/react-timeline-editor` version](../../../package.json).
  `gridSnap` uses ruler subdivisions, not the sequence frame grid.
  Compare how the native guides and snapping behave for same-row and
  cross-row moves. These options do not affect our custom placement drag
  by themselves. Keep the group's shared frame offset, identical preview
  and drop positions, and collision and track-lock rules even if only
  the guides can be reused.
