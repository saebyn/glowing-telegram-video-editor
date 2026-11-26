# Sequence editor triage

This is the open queue. Each ticket is the source of truth for its status;
a `Resolution:` line closes it even if an old `Status:` line remains.

## Ready for an agent

Work in the order below. The performance investigations come after the
correctness fixes and are not release blockers.

1. [68 — Revalidate retained Timeline actions on release](issues/68-revalidate-retained-timeline-actions.md) (P1):
   stale callbacks can discard a newer host edit.
2. [70 — Diagnose invalid source frame rates](issues/70-handle-invalid-source-frame-rates.md) (P2):
   malformed metadata crashes the editor before it can explain the issue.
3. [74 — Preserve history on delayed acknowledgement](issues/74-preserve-history-on-delayed-acknowledgement.md) (P2):
   accepting an earlier pending proposal clears Undo.
4. [71 — Hit-test Split mode at click time](issues/71-split-current-placement-at-click.md) (P2):
   a stationary pointer can retain the wrong target after a host reorder.
5. [69 — Reject competing fades at the same cut](issues/69-reject-competing-fades-at-one-cut.md) (P2):
   the compiler accepts an arrangement Preview rejects.
6. [73 — Detect audio transition conflicts](issues/73-detect-audio-transition-conflicts.md) (P2):
   a video-only placement can mask a sound conflict from the authoring check.
7. [72 — Preserve fades across source-continuous splits](issues/72-preserve-preview-fades-across-splits.md) (P2):
   Preview treats the split as an interruption.
8. [75 — Cancel queued audio on an endpoint seek](issues/75-cancel-audio-on-seek-to-endpoint.md) (P2):
   queued sound remains after an explicit seek stops playback.
9. [76 — Keep decodable frames before an HLS failure](issues/76-keep-decodable-frames-before-hls-failure.md) (P2):
   a later segment failure invalidates earlier frames in the same decode window.
10. [77 — Bound decoded media across renditions](issues/77-bound-preview-cache-across-renditions.md) (P2):
    retained decoded media grows with every rendition visited.
11. [66 — Reuse decoders across sequential Preview reads](issues/66-reuse-sequential-preview-decoders.md) (P3, investigation):
    compare persistent decode readers with the bounded window cache.
12. [67 — Reduce main-thread work during warm Preview playback](issues/67-profile-warm-preview-playback.md) (P3, investigation):
    profile ready-frame work separately from decode stalls before optimizing.

### Timeline navigation and derived duration

Follow the ticket dependencies within this batch. The
[sequence editor design](../../docs/sequence-editor-design.md) is the behavior
contract; the original PRD's stored duration rule is historical.

1. [78 — Report invalid sequence inputs to the host](issues/78-report-invalid-sequence-inputs.md)
2. [79 — Derive sequence duration from placements](issues/79-derive-sequence-duration-from-placements.md)
3. [80 — Keep the playhead parked when the sequence shrinks](issues/80-park-the-playhead-past-the-sequence-end.md)
4. [81 — Pan the sequence timeline directly in both directions](issues/81-pan-the-sequence-timeline-directly.md)
5. [82 — Add toolbar controls for timeline navigation](issues/82-add-timeline-navigation-buttons.md)

### Branch review follow-ups

See [Sequence editor data flow](../../docs/sequence-editor-data-flow.md) for
current and intended flows between the host, editor session, compiler, and Preview.

| Ticket | State | Priority |
| --- | --- | --- |
| [83 — Revalidate retained Split, Reorder, and Paste actions](issues/83-revalidate-remaining-timeline-actions.md) | Ready | P1 |
| [84 — Keep keyboard focus and the logical viewport aligned](issues/84-keep-keyboard-focus-and-viewport-aligned.md) | Ready | P2 |
| [85 — Preserve gestures when host clip inputs are equivalent](issues/85-preserve-gestures-on-equivalent-inputs.md) | Ready | P2 |
| [86 — Reject invalid source ranges before placing a pool clip](issues/86-reject-invalid-pool-clip-ranges.md) | Ready | P2 |
| [87 — Define Undo and Redo when host clip inputs change](issues/87-define-history-after-clip-changes.md) | Needs info: what history should retain when host metadata changes | P2 |
| [88 — Check transition conflicts over contributing frames](issues/88-align-transition-conflicts-with-presentation.md) | Ready | P2 |
| [89 — Omit fully hidden fades from the CutList after a trim](issues/89-omit-fully-hidden-fades-from-cutlist.md) | Ready | P2 |
| [90 — Show dissolve details independently of export eligibility](issues/90-resolve-dissolve-inspector-details-without-export.md) | Ready | P2 |
| [91 — Report a missing opaque render source reference](issues/91-require-a-render-source-reference.md) | Ready | P2 |
| [92 — Keep obsolete Preview reads from blocking the current seek](issues/92-prioritize-the-current-preview-seek.md) | Ready | P2 |
| [94 — Keep decodable audio before an HLS failure](issues/94-keep-decodable-audio-before-hls-failure.md) | Ready | P2 |

## Needs triage

Further branch-review findings, including the Preview addendum:

| Ticket | Priority |
| --- | --- |
| [95 — Revalidate retained Remove and Lock actions](issues/95-revalidate-retained-track-actions.md) | P2 |
| [96 — Reject duplicate clip placement IDs before editing](issues/96-reject-duplicate-placement-ids.md) | P2 |
| [97 — Skip media-kind probes for covered fades](issues/97-skip-probes-for-covered-fades.md) | P2 |
| [98 — Diagnose visible cuts inside fade extensions](issues/98-diagnose-cuts-in-fade-extensions.md) | P2 |
| [99 — Resolve dissolve picture and sound independently of the owning edge](issues/99-resolve-dissolve-contributions-independent-of-owner.md) | P2 |
| [100 — Align ruler hit-testing after a fractional pan](issues/100-align-ruler-hit-testing-after-fractional-pan.md) | P2 |
| [101 — Keep the playhead focused after a keyboard seek](issues/101-keep-playhead-focused-after-keyboard-seek.md) | P2 |
| [102 — Confirm an armed Paste with a touch tap](issues/102-confirm-paste-with-touch.md) | P2 |
| [103 — Make the packaged compiler types usable with NodeNext](issues/103-ship-nodenext-compatible-compiler-types.md) | P2 |
| [104 — Run the standalone Playwright suite in CI](issues/104-run-playwright-suite-in-ci.md) | P3 |
| [105 — Recover decodable picture after an earlier HLS segment failure](issues/105-recover-picture-after-an-earlier-hls-failure.md) | P2 |
| [106 — Prioritize a seek that needs a media-kind probe](issues/106-prioritize-seeks-that-need-a-media-kind-probe.md) | P2 |
| [107 — Preserve Preview when its registration callback changes](issues/107-preserve-preview-on-registration-callback-changes.md) | P2 |
| [108 — Resume Preview sound after audio context suspension](issues/108-resume-preview-sound-after-suspension.md) | P2 |
| [109 — Validate Preview audio coverage on clean EOF](issues/109-validate-audio-coverage-on-clean-eof.md) | P3 |
| [110 — Cancel queued forward audio when reverse starts](issues/110-cancel-forward-audio-when-reverse-starts.md) | P3 |

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
- [#93 — HLS variant selection](issues/93-clarify-hls-variant-contributions.md):
  closed as out of scope; the target host supplies direct media playlists.

See individual tickets for completed work and resolutions.
