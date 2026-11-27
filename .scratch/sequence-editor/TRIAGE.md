# Sequence editor triage

This is the open queue. Each ticket is the source of truth for its status;
a `Resolution:` line closes it even if an old `Status:` line remains.

## Ready for an agent

### Session-owned working sequence

[ADR 0002](../../docs/adr/0002-own-the-working-sequence-in-the-editor.md)
records the agreed change. Work in this order and ship the public interface
changes with the README migration.

1. [111 — Own the working sequence and history in the editor](issues/111-own-the-working-sequence-and-history.md) (P1):
   migrate both entry points, notifications, keyed reopening, and history
   validation. Absorbs [#87](issues/87-define-history-after-clip-changes.md).
2. [112 — Apply edit intents to the current working sequence](issues/112-apply-edit-intents-to-the-current-sequence.md) (P1):
   revalidate retained actions and replace the Timeline lock toggle with
   explicit intent. Absorbs [#95](issues/95-revalidate-retained-track-actions.md).
3. [113 — Document the session-owned editor in the README](issues/113-document-the-session-owned-editor.md) (P1):
   update examples and migration guidance after the interface changes.

[#34](issues/34-acknowledge-host-edits-without-object-identity.md) is
superseded because there is no host acknowledgement in the new contract.
Closed [#74](issues/74-preserve-history-on-delayed-acknowledgement.md) remains
a historical record; #111 replaces its acknowledgement tests.

## Needs triage

### Branch review follow-ups

See the [sequence editor data flow](../../docs/sequence-editor-data-flow.md)
for the relationships between the host, editor session, compiler, and Preview.

| Ticket | Priority |
| --- | --- |
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
