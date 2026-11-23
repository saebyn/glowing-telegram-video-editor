# Sequence editor triage

Use this page for follow-up scope. The [original PRD](PRD.md) records the
first batch. Tickets **01–08** shipped in `dc35b6b`; the expanded batch
shipped in `2077dd8`. A completed `Resolution:` line closes a ticket
without introducing another triage status.

## Ready for an agent

- [21 — Snap placement moves](issues/21-snap-placement-moves.md):
  align single or grouped placement moves to the playhead or stationary edges
  without changing move validation.
- [46 — Make `CutList` issues actionable](issues/46-make-cutlist-issues-actionable.md):
  explain unavailable output in the default editor and let editors jump to
  the first gap or inspect an affected placement.
- [48 — Share frame thumbnails across the sequence editor](issues/48-share-frame-thumbnails-across-the-sequence-editor.md):
  use one source collection for clip pool hover previews and timeline strips.

## Completed composition batch

Tickets **40–45** implemented the [composition design](../../docs/sequence-editor-design.md#component-tree)
without reopening the completed editing work.

1. [40 — Shared editing session](issues/40-extract-shared-sequence-editing-session.md)
   moves state and host edit handling below the page.
2. [41 — Toolbar and Inspector](issues/41-extract-toolbar-and-inspector-slot-components.md)
   extracts the two slot components, notices, and root shortcuts.
3. [42 — Clip Pool and Timeline edits](issues/42-connect-clip-pool-and-timeline-edits.md)
   handles the drag handoff, moves, and placement.
4. [43 — Finish the Timeline slot](issues/43-finish-the-timeline-slot-interface.md)
   moves the other Timeline interactions onto shared actions.
5. [44 — Export the default page and composition interfaces](issues/44-compose-and-export-the-sequence-editor-page.md)
   makes all five slots public together and exports the reusable components.
6. [45 — Prove both composition paths](issues/45-prove-both-sequence-editor-composition-paths.md)
   adds Storybook examples and host-observable checks.

## Completed in the current burndown

- [47 — Separate render and preview source inputs](issues/47-separate-render-and-preview-source-inputs.md):
  require host-supplied HLS for video in the editor without requiring it for
  `CutList` compilation.
- [37 — Transition objects](issues/37-represent-entry-and-reveal-fades-as-transition-objects.md):
  stable owner-edge identity and selectable fade indicators; verification ends
  at editing behavior and the existing `CutList`.
- [33 — Inspect one placement within a selection](issues/33-inspect-one-placement-without-clearing-the-selection.md).
- [35 — Split all placements at the playhead](issues/35-split-all-placements-at-the-playhead.md).
- [30 — Author layered fades](issues/30-author-entry-and-reveal-fades-on-layered-edits.md).
- [31 — Preserve transitions through placement edits](issues/31-protect-fades-during-moves-and-trims.md).
- [32 — Author centered dissolves](issues/32-show-cut-spanning-dissolves-and-source-extensions.md):
  active centered dissolves are authored but not approximated in the emitted `CutList`.
- [13 — Add and remove tracks](issues/13-add-and-remove-tracks.md).
- [25 — Reorder tracks](issues/25-reorder-tracks.md).
- [36 — Click-to-split mode](issues/36-split-a-placement-where-you-click.md).
- [38 — Lock tracks](issues/38-lock-tracks.md).
- [29 — Explain unavailable `CutList` output](issues/29-explain-why-a-sequence-cannot-compile.md):
  structured compiler issues reach the host without blocking edits.

## Completed follow-up batch

1. [11 — Delete selected placements](issues/11-delete-selected-placements.md):
   remove the selection without moving other placements or shortening time.
2. [14 — Inspector ranges](issues/14-show-source-and-sequence-ranges-in-inspector.md):
   make source and sequence positions easy to verify.
3. [09 — Undo](issues/09-undo-the-last-edit.md), then
   [22 — Redo](issues/22-redo-an-undone-edit.md): one history step per
   accepted edit; a host replacement resets history.
4. [10 — Split at the playhead](issues/10-split-at-the-playhead.md):
   shorten any affected entry or reveal fade to fit the resulting placement.

This was the suggested implementation order.

## Also completed in the expanded batch

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

Keep these follow-ups at `needs-info`. Revisit the design fit before marking
any of them ready.

| Ticket | Decision still needed | Fit to revisit |
| --- | --- | --- |
| [23 — Duplicate, copy, paste](issues/23-duplicate-copy-and-paste-placements.md) | Default destination and track. | Use shared edit actions and accepted history, not page-local edit logic. |
| [26 — Sequence markers](issues/26-add-sequence-markers-and-playback-ranges.md) | Marker persistence and behavior when the sequence endpoint changes. | Separate any persistent marker data from editor UI state and Timeline presentation. |
| [34 — Explicit host edit acknowledgement](issues/34-acknowledge-host-edits-without-object-identity.md) | A concrete host need to acknowledge an edit with a different object. | Keep the current shared history contract until that need is established. Saved/dirty state and save failures stay with the host. |
| [39 — Loop points with Keplar](issues/39-add-loop-points-with-keplar.md) | Persistence, endpoint changes, seeking, and reverse playback. | Use the shared transport clock even with Preview omitted; keep Keplar's loop overlay in the default Timeline adapter. |
| [49 — HLS playback in `SequencePreview`](issues/49-design-hls-playback-for-sequence-preview.md) | First playback slice, transport sync, and load failures. | Follow the shared transport using host-supplied HLS; don't use the rendered preview. |
| [50 — Audio-only playback](issues/50-design-audio-only-sequence-preview.md) | Streaming format, source metadata, and overlap behavior. | Keep audio-only inputs valid without a preview URL. |
| [51 — Duplicate source IDs](issues/51-design-duplicate-source-id-handling.md) | Validation point and failure behavior. | Keep editor and compiler source resolution consistent. |
| [52 — Standalone project clip thumbnails](issues/52-revisit-standalone-project-clip-thumbnails.md) | Whether standalone callers would benefit from timed source thumbnails. | Don't require playback or render metadata just to display images. |

Close-gap and ripple-delete behavior are not in scope.
