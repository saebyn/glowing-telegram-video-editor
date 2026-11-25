# Sequence editor triage

This is the open queue. Each ticket is the source of truth for its status;
a `Resolution:` line closes it even if an old `Status:` line remains.

## Ready for an agent

No unresolved tickets are ready for an agent.

## Needs triage

- [66 — Reuse decoders across sequential Preview reads](issues/66-reuse-sequential-preview-decoders.md):
  compare persistent decode readers with the bounded window cache.
- [67 — Reduce main-thread work during warm Preview playback](issues/67-profile-warm-preview-playback.md):
  profile ready-frame work separately from decode stalls before optimizing.

## Needs more information

| Ticket | Decision still needed | Fit to revisit |
| --- | --- | --- |
| [26 — Sequence markers](issues/26-add-sequence-markers-and-playback-ranges.md) | Marker persistence and behavior when the sequence endpoint changes. | Separate any persistent marker data from editor UI state and Timeline presentation. |
| [34 — Explicit host edit acknowledgement](issues/34-acknowledge-host-edits-without-object-identity.md) | A concrete host need to acknowledge an edit with a different object. | Keep the current shared history contract until that need is established. Saved/dirty state and save failures stay with the host. |
| [39 — Loop points with Keplar](issues/39-add-loop-points-with-keplar.md) | Persistence, endpoint changes, seeking, and reverse playback. | Use the shared transport clock even with Preview omitted; keep Keplar's loop overlay in the default Timeline adapter. |
| [50 — Audio-only playback](issues/50-design-audio-only-sequence-preview.md) | Streaming format and source timing metadata. | Use the presentation rules from #49; keep audio-only edit inputs valid without a preview URL. |

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
[#49 — HLS playback in `SequencePreview`](issues/49-design-hls-playback-for-sequence-preview.md)
was implemented in `f653116` and accepted after real-stream playback testing.
[#51](issues/51-design-duplicate-source-id-handling.md) keyed source metadata
by source ID, and [#65](issues/65-rename-placement-transition-fields.md)
renamed placement transition fields without changing `CutList` output.
[#52](issues/52-revisit-standalone-project-clip-thumbnails.md) closed without
changing standalone thumbnail inputs.

- [#63 — Packed icon font](issues/63-fix-packed-custom-only-icon-font.md):
  both stylesheet exports ship with the same Material Symbols font
  (`1b97c0a`, `39c30b4`).
- [#62 — Dissolve resize](issues/62-rename-dissolve-and-add-timeline-handle.md):
  Fade and Dissolve share the Timeline resize interface (`23bdc77`, `a63943b`).
- [#64 — Viewport-fit drag test](issues/64-investigate-viewport-fit-drag-flake.md):
  the test waits for the fitted layout before measuring the drag (`e7961f4`).
- [#23 — Placement clipboard](issues/23-duplicate-copy-and-paste-placements.md):
  Copy, Duplicate, and Paste are editor-scoped; Paste uses the pointer or
  enters drop mode (`4e19840`).

See individual tickets for completed work and resolutions.
