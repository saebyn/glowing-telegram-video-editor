# 48 — Share frame thumbnails across the sequence editor

Status: ready-for-agent

## Proposal

Use one collection of [frame thumbnails](../../../GLOSSARY.md#language) per
source for both sequence timeline strips and clip pool hover previews. The
timeline already uses timed source thumbnails from
[ticket 12](12-show-frame-thumbnails-on-taller-tracks.md), but the clip pool
still asks the host for untimed URL lists keyed by clip ID.

## Acceptance criteria

- Rename `SequenceSource.keyframes` to the optional
  `frameThumbnails?: readonly { sourceFrame: number; url: string }[]`.
  `sourceFrame` is zero-based on the native source frame grid. Remove the
  separate clip-keyed `keyframes` input from the sequence editor interfaces,
  including the default `SequenceClipPool` and its slot props.
- The clip pool uses the clip's source ID to find thumbnails and shows the
  ones within its source range, inclusive at the in point and exclusive at
  the out point, in ascending source-frame order. Two clips from one source
  can show different thumbnails from the same collection. When none qualify,
  skip hover animation and keep the existing static thumbnail fallback.
- The sequence timeline reads the same collection but filters by each
  placement's effective source range, including placement trims. Missing
  thumbnails do not prevent editing or affect compilation.
- Update affected stories and verify the pool and timeline through the
  sequence editor: use two clips from the same source with different ranges,
  a thumbnail exactly on an out point, and a placement trimmed past the
  reusable clip's range.

## Out of scope

[Changing standalone project clip interfaces](52-revisit-standalone-project-clip-thumbnails.md).
The sequence editor has not shipped; replace its old fields directly without
aliases or a migration.
