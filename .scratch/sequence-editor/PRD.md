# Sequence editor: practical editing workflows

Resolution: implementation batch completed in `dc35b6b`

See [Triage](TRIAGE.md) for the current queue. The original batch is preserved
below: its scope and callback names are historical. See
[Shipped: HLS sequence preview](#shipped-hls-sequence-preview) for the playback
update.

## Problem Statement

Editors can already place clips in a gap, move a single placement, and use the
Inspector for some placement trims and fades. But the timeline does not show the
exact destination of an in-progress move, cannot move a selection together, and
rejects a move that would extend the sequence. Editors also need to work directly
with placement edges and fades and position the playhead without waiting for
media preview. The current Storybook stories isolate individual interactions
instead of letting editors try them together in a realistic edit.

## Solution

Provide two practical editing workflows: assemble a rough cut and rearrange a
layered edit. Let editors preview move destinations, move selections together,
trim placements and adjust fades on the timeline, keep using the Inspector for
precise values, and control the sequence playhead without media. A valid move,
trailing placement trim, or clip-pool drop extends the sequence only as far as
needed; the duration change and placement changes commit as one edit.

## User Stories

1. As an editor, I want to see where a dragged placement will land before release, so that I can place it precisely.
2. As an editor, I want to know why a proposed drop is blocked, so that I can correct it without guessing.
3. As an editor, I want to drag past the old endpoint without the scale changing under the pointer, so that I can place something there accurately.
4. As an editor, I want a valid move past the endpoint to extend the sequence automatically, so that I do not have to change the duration first.
5. As an editor, I want to move a placement earlier without losing the trailing gap, so that moving it does not implicitly shorten my edit.
6. As an editor, I want to toggle individual placements across tracks into a selection, so that I can move related material together.
7. As an editor, I want to drag an unselected placement on its own, so that an unrelated selection does not move with it.
8. As an editor, I want a group move to preserve sequence-frame offsets and track spacing, so that the arrangement stays intact.
9. As an editor, I want to see every proposed group destination, so that I can spot a collision on a track other than the one I grabbed.
10. As an editor, I want one invalid destination to block an entire group move, so that I never have to repair a partially moved edit.
11. As an editor, I want moved placements to retain their source ranges and fades, so that moving them does not change their content.
12. As an editor, I want the Inspector to summarize a multi-selection, so that I can tell what I selected without accidentally editing one member or the whole group.
13. As an editor, I want to create a placement from the clip pool on an existing track beyond the old endpoint, so that I can build out the sequence.
14. As an editor, I want to fill an existing gap from the clip pool, so that I can assemble a continuous rough cut when I need one.
15. As an editor, I want to extend a placement with a trailing trim within its source bounds, so that the sequence can grow to contain the extra material.
16. As an editor, I want to drag the leading or trailing placement edge while the opposite edge stays fixed, so that I can trim in place.
17. As an editor, I want to see the proposed trim while dragging, so that I can judge it before committing.
18. As an editor, I want numeric trim and transition fields to stay available, so that I can enter precise values when dragging is not convenient.
19. As an editor, I want distinct entry and reveal fade handles on the timeline, so that adjusting a fade does not move the cut.
20. As an editor, I want to click the ruler or drag the playhead, so that I can choose a sequence position without changing the edit.
21. As an editor, I want to play the playhead forward, reverse it, and pause it without media, so that I can navigate the sequence and prepare for future editing actions such as split.
22. As a host integrator, I want one proposed sequence and one result from the compiler per committed edit, so that I can treat the edit as a single state change.
23. As a host integrator, I want a `null` compilation result for a valid but unrepresentable sequence, so that I do not mistake a previous `CutList` for the current edit.
24. As a host integrator, I want selection, transport, drag previews, and rejected edits to emit no changes, so that session actions do not become persistent edits.
25. As a reviewer, I want a small number of editable Storybook setups where gestures work together, so that I can evaluate a workflow rather than step through a catalogue of gesture demos.

## Implementation Decisions

- The host owns the authored sequence and feeds accepted sequences back. The
  editor owns transient placement selection, drag drafts, and playhead
  transport. A placement selection is not a saved group.
- Keep edit evaluation independent of React and widget rows. It takes the
  authored sequence and a proposed edit, checks edit rules, and determines the
  next sequence or why the edit cannot be applied. Use the same move rules for
  preview and commit and the same applicable edit rules for the timeline and
  Inspector. These are responsibilities within each vertical ticket, not
  separate implementation tracks.
- Represent group movement as a common signed sequence-frame offset and a
  common shift in track order. Check the final layout after vacating every
  moving placement's old position. Same-track overlap with a stationary
  placement, negative sequence positions, or destinations outside existing
  tracks block the entire move. Edge contact and overlap across tracks are
  allowed. Move edits retain placement IDs, source ranges, and transitions.
- For a valid move, trailing placement trim, or clip-pool drop, the new
  duration is the greater of the old duration and the latest resulting
  placement's exclusive end in sequence frames. Growth does not bypass
  source bounds or collision rules. Moving or trimming earlier leaves any
  resulting uncovered frames in the sequence.
- Keep one timeline widget and treat its rows as a projection, not the edit
  model. Convert between widget seconds and whole sequence frames at the
  adapter. Keep source bounds on the native source frame grid. For a move,
  show the exact projected destinations and the grabbed placement's sequence
  position; keep the scale steady while allowing a destination beyond the
  old endpoint.
- Use placement edges for trimming and separate handles for entry and reveal
  fade adjustment. A leading trim keeps the trailing sequence edge fixed; a
  trailing trim keeps the leading sequence edge fixed. Start with the
  existing straight-cut, matching-rate trimming scope; do not introduce a
  policy for how to trim through authored transition regions in this batch.
- Playhead transport operates on the sequence without any media player. Ruler
  seeking and transport do not change the authored sequence.
- Send one `onSequenceChange` and one `onCutListChange` result for a committed
  edit when those callbacks are supplied. The compiler reads that same next
  sequence; it does not gate valid edits. An uncovered gap or another
  unsupported layout can produce `null`. Preserve existing track priority,
  source alignment, and transition compilation rules.

## Testing Decisions

- Agreed seams: use focused Vitest tests through the edit module's callable
  interface for frame positions, final-layout collision checks, and duration
  growth; use Storybook/Playwright through real user gestures and the public
  host callbacks for previews, selection, controls, and commits. Not every
  case needs testing at both seams.
- Follow TDD in each ticket: observe one behavior test fail, implement the
  smallest change that passes, and repeat. Derive expected positions, source
  ranges, sequences, and `CutList` results independently from examples rather
  than by repeating the implementation in the test.
- High-value checks include an extending drop with no emission during the
  preview, one sequence and one compiler result on a valid release, and an
  invalid group move that would also have grown the sequence but changes
  neither placements nor duration. Check that a same-track edge touch is
  allowed and that moving or trimming earlier leaves the duration intact.
- Use the existing compiler unit tests and Storybook-backed browser tests for
  moves, trims, gap drops, and fades as prior art. Keep regression coverage
  when consolidating stories. The stories verify authoring and callback
  output, not decoded media.

## Out of Scope

- Adding media playback to the default `SequencePreview` is follow-up work.
- Downstream renderer behavior, rendered-media verification, and changes to the
  source review workflow. Compiler verification ends at the emitted `CutList`.
- Optional snapping modes, marquee selection, and bulk Inspector edits.
- Mixed-rate trim and compilation, new compositing rules, and a policy for
  trimming through transition regions.
- Implementing Undo, Split, or Delete in this first batch. See
  [Triage](TRIAGE.md) for their follow-up status.

## Further Notes

- [Sequence editor design](../../docs/sequence-editor-design.md) and
  [glossary](../../GLOSSARY.md) supply the durable rules and terminology.
- Start with [01: Preview and move one placement](issues/01-preview-and-move-one-placement.md).
  [02: Select and move placements together](issues/02-select-and-move-placements-together.md)
  builds on it. [06: Control the playhead without media](issues/06-control-the-playhead-without-media.md)
  can proceed in parallel if its edits stay separate from move handling.
  Give agents complete tickets; sequence changes that touch the same code.
- [03: Grow the sequence on trailing trim](issues/03-grow-sequence-on-trailing-trim.md)
  establishes the rule through the Inspector.
  [08: Trim placements on the timeline](issues/08-trim-placements-on-the-timeline.md)
  adds both edge gestures and reuses that rule.
- [07: Consolidate Storybook editing setups](issues/07-consolidate-storybook-editing-setups.md)
  is final curation. Earlier tickets can use or adapt existing fixtures.

## Shipped: HLS sequence preview

The default `SequencePreview` lets editors play, scrub, and step through the
latest host-supplied sequence, including fades and dissolves, without a
pre-rendered sequence or a successful `CutList` compile. Forward playback
includes sound; reverse is picture-only. Preview is for judging authored
timing, picture, and sound, not verifying the downstream render. For the
current compiler callback contract, see
[`onCutListResult` and `result.ok`](../../README.md#sequenceeditorpage).

For sources with video or an undeclared media kind, the host supplies a
`previewHlsUrl` separate from the render `s3Location`. It points to a finite,
seekable rendition aligned to the whole source's elapsed time. The browser
must be able to fetch the playlist and its segments and decode the rendition
codecs through WebCodecs. Desktop Chromium is the verification baseline, not
a guarantee for every browser or codec.

The editing session still owns the playhead. When Preview is hidden or
omitted, transport runs without waiting for media. When required media is
buffering, playback holds and resumes only if the play request is still
current. Gaps play as black and silence except where a transition contributes.
Missing media and undefined transitions stop playback with distinct
diagnostics, and editors can seek past them.

[#49](issues/49-design-hls-playback-for-sequence-preview.md) was accepted
after real-stream testing. Audio-only source delivery and timing metadata
remain open in [#50](issues/50-design-audio-only-sequence-preview.md).
[Triage](TRIAGE.md) tracks transition correctness, endpoint audio, and HLS
reliability separately from non-blocking performance investigations.

See the [sequence preview design](../../docs/sequence-editor-design.md#sequence-preview-target)
for the behavior contract and the
[verification checklist](../../docs/development.md#manual-sequence-preview-checks)
for local fixture and real-stream checks.
