# 95 — Revalidate retained Remove and Lock actions

Resolution: Superseded as a standalone ticket by [#112](112-apply-edit-intents-to-the-current-sequence.md). Keep the retained Remove and Lock regressions, now using intervening local edits and an explicit requested lock state.
Review priority: P2
Related: [68 — Revalidate retained Timeline actions](68-revalidate-retained-timeline-actions.md),
[83 — Revalidate retained Split, Reorder, and Paste](83-revalidate-remaining-timeline-actions.md)

## Problem

A replacement Timeline can retain `removeTrack` or `toggleTrackLock` from
[`useSequenceEditor`](../../../src/components/organisms/useSequenceEditor.ts#L605).
Retain Remove for an empty track, then have the host add a placement to
that track before invoking it. The old callback still proposes deleting the
track. Retained Lock can likewise propose a sequence that drops tracks or
placements added since the callback was captured.

## Acceptance criteria

- Apply both intents to the latest committed sequence and permissions.
  A now-populated or missing track cannot be removed by a retained callback.
- An allowed Remove or Lock preserves unrelated host changes and emits one
  sequence proposal and its matching `CutList` result. A blocked action
  emits neither.
- Cover both actions with a replacement Timeline that retains the original
  callbacks. Keep the slot interface unchanged.
