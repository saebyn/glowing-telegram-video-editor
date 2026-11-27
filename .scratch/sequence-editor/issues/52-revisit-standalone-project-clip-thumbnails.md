# 52 — Revisit thumbnails in standalone project clip views

Resolution: Closed without implementation; no standalone caller currently needs source-frame thumbnails.

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

## Comments

- `ProjectClipTimeline` was removed in [#56](56-remove-unused-legacy-editor-views.md).
  Keep the existing per-clip image inputs for `ProjectClipPool` and
  `ProjectClipPreview`. The sequence editor already filters source-frame
  thumbnails to each clip's range before passing image URLs to the pool.
  Revisit if a standalone caller needs the pool to do that filtering; it
  should not require playback URLs or render metadata.
