# 50 — Design playback for audio-only sequence sources

Status: needs-info

## Proposal

Audio-only sources are valid editor inputs without `previewHlsUrl` under
[ticket 47](47-separate-render-and-preview-source-inputs.md). Decide how a host
supplies playable audio and what the default Preview does with it. Coordinate
with [video preview playback](49-design-hls-playback-for-sequence-preview.md).

## Decisions needed

- Confirm what the host can serve for audio-only media. Choose a playback
  format and source metadata contract without deriving either from
  `s3Location`.
- Define how the host describes audio-only source timing without requiring
  native video frames.

The [sequence preview target](../../../docs/sequence-editor-design.md#sequence-preview-target)
already defines presentation: resolve picture and sound separately by track
priority. An audio-only placement can supply sound over a lower picture;
without a picture contribution, the picture is black.
