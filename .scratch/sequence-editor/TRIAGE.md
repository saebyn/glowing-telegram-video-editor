# Sequence editor triage

Use this page for follow-up scope. The [original PRD](PRD.md) records the
first batch. Tickets **01–08** shipped in `dc35b6b`; their `Resolution:` lines
close them without introducing another triage status.

## Recommended next batch

1. [11 — Delete selected placements](issues/11-delete-selected-placements.md):
   remove the selection without moving other placements or shortening time.
2. [14 — Inspector ranges](issues/14-show-source-and-sequence-ranges-in-inspector.md):
   make source and sequence positions easy to verify.
3. [09 — Undo](issues/09-undo-the-last-edit.md), then
   [22 — Redo](issues/22-redo-an-undone-edit.md): one history step per
   accepted edit; a host replacement resets history.
4. [10 — Split at the playhead](issues/10-split-at-the-playhead.md):
   shorten any affected entry or reveal fade to fit the resulting placement.

This is a suggested priority, not a requirement to start all the work at
once. Sequence tickets that touch the same editor code.

## Ready behind the next batch

- [12 — Frame thumbnails](issues/12-show-frame-thumbnails-on-taller-tracks.md)
  and [18 — Media kind](issues/18-distinguish-source-media-types.md):
  coordinate the host-supplied source metadata.
- [15 — Rename tracks](issues/15-name-and-rename-tracks.md): independent of
  adding or removing tracks.
- [16 — Resize panes](issues/16-resize-workspace-panes.md) and
  [17 — Toggle panes](issues/17-toggle-workspace-pane-visibility.md):
  coordinate workspace layout changes.
- [19 — Pan and zoom](issues/19-pan-and-zoom-the-sequence-timeline.md) and
  [20 — Frame step and nudge](issues/20-step-the-playhead-and-nudge-placements.md):
  precision controls.
- [24 — Shorten the sequence](issues/24-shorten-the-sequence-explicitly.md):
  remove uncovered time at the end only.
- [28 — Empty tracks and fades](issues/28-keep-empty-tracks-neutral-for-fades.md):
  remove the current empty-track restriction independently of track
  management and overlapping transitions.
- [27 — Flatten with transitions](issues/27-flatten-multitrack-sequences-with-transitions.md):
  resolve each fade's neighbor in the existing ordered `CutList`; verify
  section order, source-frame ranges, and transition fields and durations.

## Needs more information

| Ticket | Decision still needed |
| --- | --- |
| [13 — Add/remove tracks](issues/13-add-and-remove-tracks.md) | Where to insert a new track and whether the last empty track may be removed. Empty-only removal is settled. |
| [21 — Snapping](issues/21-snap-placement-moves.md) | Initial snap targets, defaults, and how to choose between equally close targets. |
| [23 — Duplicate, copy, paste](issues/23-duplicate-copy-and-paste-placements.md) | Default destination and destination track selection. |
| [25 — Reorder/lock tracks](issues/25-reorder-and-lock-tracks.md) | Which actions locks block and whether locks persist. Reorder can be separated. |
| [26 — Markers and playback ranges](issues/26-add-sequence-markers-and-playback-ranges.md) | Persistence and behavior when the sequence endpoint changes. |

Close-gap and ripple-delete behavior are not in scope.
