# 102 — Confirm an armed Paste with a touch tap

Status: needs-triage
Review priority: P2
Related: [23 — Duplicate, copy, and paste placements](23-duplicate-copy-and-paste-placements.md),
[83 — Revalidate retained Split, Reorder, and Paste](83-revalidate-remaining-timeline-actions.md)

## Problem

On a touch device with a keyboard, copy a placement, arm Paste with no
hovered target, and tap a valid gap. The
[`lostpointercapture` handler](../../../src/components/organisms/SequenceTimeline.tsx#L1093)
clears the recorded press on normal implicit touch release before the click
can confirm it. No placement is added.

## Acceptance criteria

- A primary tap in a valid gap confirms the active Paste session exactly
  once and places the copied group at the tapped track and sequence frame.
- A pan, pointer cancellation, invalid target, or press from an obsolete
  session does not confirm. Preserve the mouse click behavior.
- Add a touch-enabled Playwright regression that arms Paste with the
  keyboard and confirms it with a tap.
