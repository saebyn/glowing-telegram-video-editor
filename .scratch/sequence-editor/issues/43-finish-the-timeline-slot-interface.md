# 43 — Finish the Timeline slot interface

Resolution: completed the frame-based Timeline slot and verified gesture regressions
Depends on: [42](42-connect-clip-pool-and-timeline-edits.md)

## Proposal

Move the remaining `SequenceTimeline` interactions onto the shared
`timelineProps` interface. Keep Keplar and pointer mechanics in the default
Timeline adapter, not in the hook's props bundles.

See [Playhead without a media preview](../../../docs/sequence-editor-design.md#playhead-without-a-media-preview)
and [Composition interfaces](../../../docs/sequence-editor-design.md#composition-interfaces).

## Acceptance criteria

- Timeline receives ordered tracks and placements, presentation and
  selection state, and named actions for placement trim, transition edits,
  track reorder/remove/lock, and selection. Use source frames for trim
  points and sequence frames for transition lengths and sequence positions.
  Gesture previews are side-effect-free; do not expose a generic command
  dispatcher or callback that commits a `Sequence`.
- A placement activation supplies the placement ID, plus the sequence frame
  under the pointer for pointer activations. Shared behavior decides whether
  to select (preserving modifier toggles) or split. In Split mode the adapter
  suppresses ordinary placement gestures, but ruler seek, playhead drag,
  zoom, and pan still work.
- Split mode cuts only the clicked placement, leaves the playhead and
  selection alone, remains active after a cut, and cannot split a locked
  placement. Toolbar Split at playhead still applies to all eligible
  placements as one edit.
- Keep one default Keplar timeline, native scrubbing, and existing keyboard
  access. Preserve observed trim, transition, selection, track, and split
  behavior in the default workflow tests.

## Comments

- A replacement Timeline activation first failed to select anything. The
  shared action now selects without emitting an edit, or splits only the
  activated placement at the supplied sequence frame in Split mode.
- TypeScript, formatting, lint (existing warnings), 127 Vitest tests, and
  all 128 sequence-editor Playwright tests against static Storybook passed.
  Fifteen split, trim, and reorder cases passed in dark mode.
- Four targeted mutations were killed: selecting instead of splitting,
  seeking during a split, dropping the fade commit, and using the origin
  track as the reorder destination. Logs: `/tmp/opencode/sequence-43-static-mutation.AER2Gp`.
