# 47 — Separate render and preview source inputs

Resolution: separated render-only compiler inputs from editor source metadata

## Proposal

Give the sequence editor the source playback rendition it will need for a
future `SequencePreview`, without making HLS a dependency of `compileCutList`.
The host stores render and preview media separately; the library cannot derive
one location from the other. See [playback rendition in the glossary](../../../GLOSSARY.md#language).

## Acceptance criteria

- Export `CutListSource` with only `id` and `s3Location`. `compileCutList`
  accepts a readonly list of those records. Render-only callers can compile
  without supplying an HLS URL. Full `SequenceSource` records also work as
  compiler input, and preview metadata does not change the emitted `CutList`.
- Build `SequenceSource` on `CutListSource`. Require `previewHlsUrl: string`
  for `video-only`, `audio-video`, and sources whose `mediaKind` is omitted.
  An explicitly `audio-only` source remains valid with no preview URL; leave
  its streaming contract undefined.
- Document the host contract: supply one record per source ID and provide
  any required HLS URL before mounting the editor. The rendition may use a
  different resolution or encoding, but its time zero and elapsed times
  correspond to the render source. The library does not derive the URL from
  `s3Location`.
- Verify the public types for compiler-only input, video sources with and
  without an HLS URL, and audio-only sources without one. Verify that the
  same edit emits the same `CutList` with minimal or full source records.
  Update affected editor fixtures and stories.

## Out of scope

[Connecting `SequencePreview` to playback](49-design-hls-playback-for-sequence-preview.md),
[choosing how to stream audio-only sources](50-design-audio-only-sequence-preview.md),
and [adding runtime validation for duplicate IDs](51-design-duplicate-source-id-handling.md).
The sequence editor has not shipped; no compatibility layer or upgrade guide
is needed.

## Comments

- Observed red → green for the package-root source type contract and for
  compilation without reading presentation metadata. Minimal and full records
  produce the same exact trimmed fade output and unsupported-dissolve issues.
- Passed typecheck, library build, packed package-root declaration checks,
  lint, formatting, 10 affected Storybook checks, and 14 targeted Playwright
  checks in Chromium. Five type-contract and three runtime mutations were
  caught, including letting video omit a URL and using the preview URL for
  render input.
