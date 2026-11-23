# 49 — Design HLS playback for `SequencePreview`

Status: needs-info
Depends on: [47 — Separate render and preview source inputs](47-separate-render-and-preview-source-inputs.md)

## Proposal

Play host-supplied HLS renditions in the default `SequencePreview`, without
requiring a custom Preview slot. The editing session owns transport and the
sequence playhead; Preview follows it. See the
[sequence editor design](../../../docs/sequence-editor-design.md#playhead-without-a-media-preview).
This does not use or change the host-rendered `VideoPreview`.

## Decisions needed

- Define the first playback slice: which placements and transitions it
  handles, and what Preview shows for the rest, including audio-only sources
  before [ticket 50](50-design-audio-only-sequence-preview.md).
- Decide how seeking, stepping, reverse transport, and source changes map
  to browser playback. Specify what accuracy to expect from HLS seeks.
- Distinguish a sequence gap from a failed media load. Decide what happens
  during loading, on errors, and when the host replaces a rendition URL.

## Comments

- `SequencePreview` needs to parse playlists and stream media from multiple
  source HLS renditions, stitching the relevant source ranges together for
  browser playback according to the current sequence's clip placements and
  trims. The stitching approach is still open; the preview should not
  require a pre-rendered version of the sequence.
