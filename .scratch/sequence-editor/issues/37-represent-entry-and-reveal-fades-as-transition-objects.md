# 37 — Represent entry and reveal fades as transition objects

Status: ready-for-agent

Replace the two fade-duration fields on a clip placement with selectable
transition objects. This is the first slice of the
[transition design](../../../docs/sequence-editor-design.md#model-and-ownership);
it does not add a new transition kind.

## Proposed acceptance criteria

- Give each transition its own stable identity, duration in sequence
  frames, and one owning placement edge. An entry fade starts at the
  leading edge; a reveal fade ends at the trailing edge. Allow at most
  one transition per edge. A hard cut has no transition object.
- Keep the existing timeline and Inspector fade controls working. A fade
  can be selected independently of its placement, and the Inspector
  identifies its owner. Selection emits no edit. Changing the fade
  duration does not change placement positions, trims, or sequence
  duration.
- On a move, keep the transition attached to its placement without
  recording a fixed counterpart. On Split, each transition keeps its ID
  and duration on the piece that retains its original edge, even if
  that piece is shorter than the fade. The new split has no transition.
  Deleting a placement removes its own transitions in the same undoable
  edit; transitions on surviving placements stay.
- Keep the same `CutList` for existing representable entry and reveal
  examples. A fully covered transition stays authored and selectable
  but is omitted from the compiled output without blocking it. A
  visible transition the format cannot represent still yields `null`
  without discarding the edit.
- Replace the old fields in Storybook stories and test fixtures. Do not
  add a legacy loader or migration.

## Comments

- [30](30-author-entry-and-reveal-fades-on-layered-edits.md) expands fade
  authoring to occupied tracks; [31](31-protect-fades-during-moves-and-trims.md)
  covers missing contributions and conflicts after placement edits;
  [32](32-show-cut-spanning-dissolves-and-source-extensions.md) adds
  centered dissolves. No `CutList` schema change is required for this slice.
