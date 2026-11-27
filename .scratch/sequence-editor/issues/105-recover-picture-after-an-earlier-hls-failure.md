# 105 — Recover decodable picture after an earlier HLS segment failure

Status: needs-triage
Review priority: P2
Related: [76 — Keep decodable Preview pictures before an HLS failure](76-keep-decodable-frames-before-hls-failure.md)

## Problem

[`pictureAt`](../../../src/utils/previewRendition.ts#L91) cannot reach its
exact-time fallback if the decode window fails before yielding a picture.
For a direct HLS playlist with a failing segment from `0.3` to `0.6` seconds
and an independently decodable next segment, seeking to `0.7` starts its
window read at `0.5` and shows “No media,” although an exact read can succeed.
Ticket #76 covers the opposite case, where a later failure follows a picture
already yielded by the window iterator.

## Acceptance criteria

- Try an exact-time read when the window fails before yielding a covering
  picture. Use it only if it covers the requested elapsed source time.
- An actual seek into unavailable media still reports “No media.” Preserve
  already-decoded covering pictures and do not substitute stale picture.
- Use a deterministic local playlist or rendition seam to exercise a failed
  window followed by a successful exact read in that same window.
