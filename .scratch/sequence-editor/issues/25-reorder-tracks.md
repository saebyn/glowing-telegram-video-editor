# 25 — Reorder tracks

Status: ready-for-agent

## Acceptance criteria

- Drag a track to preview its destination in the list. Dropping at a
  new position commits one undoable reorder through the existing
  sequence edit flow. A preview, cancellation, or unchanged drop emits
  no edit.
- Preserve track and placement identities, placement positions, trims,
  transitions, and sequence duration. Compile in the new top-first
  priority order. Verify that reordering two overlapping tracks changes
  which placement supplies the overlapping interval.
- If the new order cannot compile, keep the authored reorder and
  transitions, emit `null`, and explain why export is unavailable. Undo
  restores the old order.

## Comments

- Design review: drag is the primary reorder interaction. Use an
  internal reorder action that other inputs can invoke with the same
  rules. No public command interface or configurable keybindings in
  this slice. A dedicated keyboard reorder gesture is not a requirement.
- Track locks are scoped separately in [38](38-lock-tracks.md).
