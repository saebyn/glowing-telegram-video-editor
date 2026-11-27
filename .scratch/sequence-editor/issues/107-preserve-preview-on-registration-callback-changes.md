# 107 — Preserve Preview when its registration callback changes

Status: needs-triage
Review priority: P2
Related: [45 — Prove both composition paths](45-prove-both-sequence-editor-composition-paths.md),
[49 — Sequence Preview HLS playback](49-design-hls-playback-for-sequence-preview.md)

## Problem

[`SequencePreview`](../../../src/components/molecules/SequencePreview.tsx#L89)
disposes its reader when `registerPreview` changes, but the drawing effect
does not request the current frame from the replacement reader. Wrap the
callback in a custom Preview slot and trigger an unrelated host rerender
while a paused picture is loading. With the same media and frame, the old
request can publish “No media · Preview was closed,” and the new reader
receives no request.

## Acceptance criteria

- A callback-only change rebinds the gate without leaving the displayed
  frame stale or failed. Separate gate registration from reader lifetime,
  or invalidate and reissue the read when the reader changes.
- A disposed reader cannot publish a stale failure or picture. A real
  media change and unmount still clean up the obsolete reader.
- Verify with a custom slot and a deterministic paused, in-flight seek.
