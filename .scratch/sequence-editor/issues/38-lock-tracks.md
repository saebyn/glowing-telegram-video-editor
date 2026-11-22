# 38 — Lock tracks

Status: ready-for-agent
Depends on: [13](13-add-and-remove-tracks.md), [25](25-reorder-tracks.md), [35](35-split-all-placements-at-the-playhead.md), [36](36-split-a-placement-where-you-click.md), [37](37-represent-entry-and-reveal-fades-as-transition-objects.md)

Protect placements on a track without changing what it contributes to
output.

## Acceptance criteria

- Store the lock on the track in the host-owned sequence. Show which
  tracks are locked. Lock and Unlock use the normal sequence edit flow;
  each accepted toggle is one Undo step and does not change the
  `CutList` result. Loading or replacing a sequence respects the locks
  it contains, rather than retaining local lock state.
- Block moves into or out of a locked track, clip-pool drops onto it,
  trims, explicit splits, placement deletion, and transition edits.
  Explain a blocked edit and emit no change. An explicit group edit
  that touches a locked placement fails as a whole. Split at the
  playhead instead skips locked tracks; Split mode does not cut a
  locked placement.
- Keep selection, inspection, playback, renaming, reordering, and
  removal of an otherwise removable empty track available. A locked
  placement may still be covered by another track.
- Undo and Redo restore the accepted snapshot, including its locks,
  without being blocked by current locks. Verify that Undo after trim
  then Lock unlocks first and reverses the trim second. Undo of a
  removed locked track restores it locked.

## Comments

- Split from [25](25-reorder-tracks.md) during design review. Locks are
  persistent sequence state, not a separate editor session setting.
