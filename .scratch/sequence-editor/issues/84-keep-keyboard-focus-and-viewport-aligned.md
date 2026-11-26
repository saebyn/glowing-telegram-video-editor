# 84 — Keep keyboard focus and the logical viewport aligned

Status: ready-for-agent
Resolution: Synchronize native keyboard focus scrolling with the logical Timeline viewport.
Review priority: P2
Related: [81 — Pan the sequence timeline directly](81-pan-the-sequence-timeline-directly.md),
[82 — Add toolbar controls for timeline navigation](82-add-timeline-navigation-buttons.md)

## Problem

Keplar mounts placement controls outside the visible viewport. In Chromium,
zoom once at frame zero in **Assemble a rough cut**, then Tab past the first
placement and its trim grips to the closing placement. Native focus scrolling
moves Keplar's grid and ruler but leaves the
[`SequenceTimeline` logical viewport](../../../src/components/organisms/SequenceTimeline.tsx)
unchanged. Clicking near the visible `00:04.5` tick can seek to frame 90
(`00:01.5` at 60 fps).

## Acceptance criteria

- Tab and Shift+Tab cannot leave ruler labels, placement positions, or pointer
  mapping out of sync. Either bring the focused control into the logical
  viewport or exclude clipped controls from tab order until brought into view.
- Visible placement controls remain keyboard-operable. Navigation or focus
  alone doesn't seek, change selection, or propose an edit.
- Add a browser regression that tabs through the zoomed timeline, then clicks
  a ruler position and verifies the sequence frame shown at that position.

## Comments

- Red: after Tab scrolled the zoomed grid, clicking `00:04.5` sought to
  sequence frame 90 instead of 270. Tab, Shift+Tab and focus on clipped
  transition controls now keep ruler and pointer mapping aligned.
- Verified 81 related Chromium tests, including both new regressions and
  keyboard tests. Typecheck, formatting, and `git diff --check` passed.
  Lint reported only the existing VideoPlayer captions warning.
- Both isolated mutations were caught: ignoring native grid scrolling and
  not revealing a focused transition control.
