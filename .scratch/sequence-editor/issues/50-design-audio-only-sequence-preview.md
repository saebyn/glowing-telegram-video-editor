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
- Define what Preview shows and plays for a standalone audio-only placement,
  and whether overlapping picture and sound are part of the first slice.
