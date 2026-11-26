# 93 — Define variant selection when an HLS source offers different contributions

Resolution: closed as out of scope; the target host supplies direct HLS media playlists, so Sequence Preview does not need multivariant playlist support.
Related: [49 — HLS playback in SequencePreview](49-design-hls-playback-for-sequence-preview.md),
[50 — Audio-only playback](50-design-audio-only-sequence-preview.md)

## Problem

An HLS **multivariant playlist** (formerly called a *master playlist*) is an
index of alternate streams for the same source. In a local test, the index
pointed to a 64×36 video-only variant and a 960×540 audiovisual variant.
[`previewRendition`](../../../src/utils/previewRendition.ts) picked the
smaller variant and only then checked for pairable audio. For a host-declared
`audio-video` source, this produced `No media` even though the larger variant
had audio. When `mediaKind` was omitted, the small variant instead made the
source appear video-only, allowing lower-track audio to take over.

## Comments

- The maintainer confirmed the current target host does not supply
  multivariant playlists. There is no variant-selection policy to define
  for that host. See the [Preview input contract](../../../docs/sequence-editor-design.md#sequence-preview-target).
- This closes the review finding without changing playback code or tests.
  If a future host needs multivariant playlists, revisit how Preview selects
  picture and sound then.
