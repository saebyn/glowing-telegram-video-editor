# 52 — Revisit thumbnails in standalone project clip views

Status: needs-info

## Proposal

[Ticket 48](48-share-frame-thumbnails-across-the-sequence-editor.md) consolidates
thumbnails in the sequence editor but leaves standalone `ProjectClipPool`,
`ProjectClipTimeline`, and `ProjectClipPreview` interfaces unchanged.

## Decisions needed

- Confirm whether standalone callers would benefit from source-frame
  thumbnails or still need untimed, per-clip image lists.
- If convergence is useful, determine what source metadata those callers
  already have and how to support them without requiring render locations
  or playback URLs just to display thumbnails.
