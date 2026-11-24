# Sequence editor triage

This is the open queue. Each ticket is the source of truth for its status;
a `Resolution:` line closes it even if an old `Status:` line remains.

## Ready for an agent

- [49 — HLS playback in `SequencePreview`](issues/49-design-hls-playback-for-sequence-preview.md):
  full presentation target approved; ranked playback libraries and feasibility checks recorded.
- [51 — Key source metadata by source ID](issues/51-design-duplicate-source-id-handling.md):
  approved switch from source arrays to a keyed record in the editor and compiler.
- [65 — Rename placement fields to `transitionIn` and `transitionOut`](issues/65-rename-placement-transition-fields.md):
  approved public placement-field rename; keep `CutList` output unchanged.

## Needs triage

- [62 — Call it Dissolve and add a timeline resize handle](issues/62-rename-dissolve-and-add-timeline-handle.md):
  simplify the label and make duration adjustable on the timeline.
- [63 — Fix the icon font in packed `custom-only.css`](issues/63-fix-packed-custom-only-icon-font.md):
  make the Material Symbols font load in a consumer of the published package.
- [64 — Investigate the viewport-fit drag test flake](issues/64-investigate-viewport-fit-drag-flake.md):
  determine whether the test races viewport layout or the editor uses stale geometry.

## Needs more information

| Ticket | Decision still needed | Fit to revisit |
| --- | --- | --- |
| [23 — Duplicate, copy, paste](issues/23-duplicate-copy-and-paste-placements.md) | Default destination and track. | Use shared edit actions and accepted history, not page-local edit logic. |
| [26 — Sequence markers](issues/26-add-sequence-markers-and-playback-ranges.md) | Marker persistence and behavior when the sequence endpoint changes. | Separate any persistent marker data from editor UI state and Timeline presentation. |
| [34 — Explicit host edit acknowledgement](issues/34-acknowledge-host-edits-without-object-identity.md) | A concrete host need to acknowledge an edit with a different object. | Keep the current shared history contract until that need is established. Saved/dirty state and save failures stay with the host. |
| [39 — Loop points with Keplar](issues/39-add-loop-points-with-keplar.md) | Persistence, endpoint changes, seeking, and reverse playback. | Use the shared transport clock even with Preview omitted; keep Keplar's loop overlay in the default Timeline adapter. |
| [50 — Audio-only playback](issues/50-design-audio-only-sequence-preview.md) | Streaming format and source timing metadata. | Use the presentation rules from #49; keep audio-only edit inputs valid without a preview URL. |
| [52 — Standalone project clip thumbnails](issues/52-revisit-standalone-project-clip-thumbnails.md) | Whether standalone callers would benefit from timed source thumbnails. | Don't require playback or render metadata just to display images. |

Close-gap and ripple-delete behavior are not in scope.

## Production bundle cleanup

**Measure bundle size, not lines.** Run `npm run build` before and after with
the same Node version, lockfile, and build settings except for the change being
evaluated. Record the baseline revision, raw bytes (`wc -c`), and gzip bytes
(`gzip -n -9 -c < file | wc -c`) for the shipped JS and both CSS exports.
Use gzip bytes as the primary comparison. Exclude source maps, declarations,
and Storybook output. Report `styles.css` and `custom-only.css` separately
because they are alternatives; include referenced assets when a change
affects them. If there are multiple JS chunks, count them all for the release
total, and report initial and deferred bytes separately for consumer fixtures.

**Apply SOLID to extractions.** Share behavior only when it has one reason to
change and fits behind a small interface with the same contract for each
caller. Keep editing rules independent of UI adapters and don't introduce
extension hooks without a real caller. An extraction that only moves code or
saves source lines without saving bundle bytes isn't a win for bundle cleanup.

## History

The [original PRD](PRD.md) records tickets **01–08**, shipped in `dc35b6b`.
The expanded batch shipped in `2077dd8`. Tickets **40–45** implemented the
[composition design](../../docs/sequence-editor-design.md#component-tree);
**53–55** covered transition editing and **56–60** covered bundle cleanup.
See individual tickets for completed work and resolutions.
