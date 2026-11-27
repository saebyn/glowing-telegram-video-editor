# 109 — Validate Preview audio coverage on clean EOF

Status: needs-triage
Review priority: P3
Related: [94 — Keep decodable Preview audio before an HLS failure](94-keep-decodable-audio-before-hls-failure.md)

## Problem

The [rendition reader](../../../src/utils/previewRendition.ts#L145) checks
continuous sound coverage only when the decoder throws. A normal request
for elapsed source time `[0.30, 0.40)` succeeds if the declared audio stream
ends cleanly at `0.32` seconds and supplies one overlapping buffer. If that
is the last sequence frame, Preview reaches the endpoint without reporting
the missing in-trim sound.

## Acceptance criteria

- Check that decoded buffers continuously cover the requested recorded
  interval even when decoding ends cleanly. Allow for sample rounding.
- Report missing expected in-trim sound instead of silently truncating it.
  Preserve intentional silence beyond recorded material in transition
  extensions and already-covered requests before a segment failure.
- Verify a partially covered request with a clean end of stream, a fully
  covered request, and a transition extension beyond the recorded end.
