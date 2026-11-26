# 71 — Split the placement under the click after tracks reorder

Status: ready-for-agent
Resolution: Split mode hit-tests the current Timeline on click, independent of the blade's retained hover target.
Review priority: P2
Related: [25 — Reorder tracks](25-reorder-tracks.md),
[36 — Split a placement where you click](36-split-a-placement-where-you-click.md)

## Problem

In Split mode, hover over a placement and have the host reorder its track
without moving the pointer. Keplar keeps its old hover target, and the
[Timeline](../../../src/components/organisms/SequenceTimeline.tsx#L1153)
can split that placement on its new row instead of the placement now under
the pointer.

## Acceptance criteria

- A click resolves the track, placement, and sequence frame from the current
  Timeline and pointer position, not from a previously rendered blade.
- With the pointer stationary through a host reorder, clicking an eligible
  placement splits only that placement; clicking empty space emits no edit.
- Keep the existing track lock feedback and strict placement boundary checks.
  Verify the stationary-pointer case in a controlled browser story.

## Comments

- Red → green in a controlled Storybook story. The host reordered its tracks
  with the pointer stationary. Split previously cut the old placement even
  when the pointer was now over an empty row. It now cuts only the placement
  at the click, reports a locked track without editing, and rejects clicks
  at either placement boundary.
- Chromium passed 31 focused Split, lock, viewport, and clipboard checks.
  An isolated mutation restoring the stale hover hit target failed both
  stationary-pointer regressions for eligible placements and empty space.
