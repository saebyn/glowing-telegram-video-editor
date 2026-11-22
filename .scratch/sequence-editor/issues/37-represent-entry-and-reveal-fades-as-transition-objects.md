# 37 — Represent entry and reveal fades as transition objects

Status: ready-for-agent
Resolution: implemented and verified at the `CutList` and host callback boundaries

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
- `ClipPlacement` now holds optional `entryTransition` and `revealTransition`
  objects; a hard cut has neither. The old duration fields are not loaded.
  Both indicator buttons can select an authored fade, even when editing is
  unavailable. Moves, splits, duration edits, deletion, and Undo preserve
  transition identity and edge ownership as applicable.
- Red → green: Vitest reproduced the lost `transitionOut`, a `null` result
  on a fully covered fade, duplicated split fades, and a resize losing the
  transition object. Chromium reproduced the missing covered-fade selection
  target and a one-frame indicator click intercepted by the resize grip.
  The compiler tests distinguish full coverage from one visible frame.
- Static Storybook: 48 focused Chromium checks passed across light and
  dark. The full dev-server run passed 90/92; both failures were story
  load/visibility timeouts and both passed on built Storybook with and
  without this change. Vitest, typecheck, lint (existing warnings only),
  formatting, library and Storybook builds, and diff checks passed.
- Stryker: edit/compiler scope killed 136/175 (36 survived, 3 timed out);
  indicator scope killed 12/19 (7 survived). Survivors include evaluator
  input guards, propagation guards, and compiler boundary variants.
  Reports are under `/tmp/opencode/gtve-ready-mutation.5Yxjq3/` in
  `ticket37-transition-rules` and `ticket37-transition-indicator`.
- An additional exact coverage-boundary case caught mutants that read
  past the exclusive end of a hidden fade. The focused rerun killed
  51/56 compiler-window mutants (5 survived, no timeouts); see
  `ticket37-fade-visibility-boundaries` in the same report directory.
