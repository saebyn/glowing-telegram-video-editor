# 25 — Reorder tracks

Resolution: implemented and verified through timeline gestures and host callbacks

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
- Dragging the track grip previews an insertion position without changing
  the authored sequence. A changed drop applies top-first priority as one
  undoable edit; Escape, a drop outside, and a return to origin do not
  emit. If the reorder exposes an interrupted fade, the edit retains it,
  explains why export is unavailable, and emits `null`.
- Chromium red → green covered the absent grip and cancellation. The
  isolated regression run passed 25 cases; 26 focused Vitest cases,
  typecheck, and the library build passed. Ten targeted browser mutants
  were caught. Logs: `/tmp/opencode/sequence-ticket-25-evidence.md`.
- In the integrated run, existing move/drop specs measured the inner
  track label rather than the track row after the new controls were added.
  Targeting the labeled track headers restored those geometry checks;
  240 static Chromium cases passed across light and dark.
