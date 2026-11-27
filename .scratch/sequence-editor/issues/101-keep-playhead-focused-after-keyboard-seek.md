# 101 — Keep the playhead focused after a keyboard seek

Status: needs-triage
Review priority: P2
Related: [84 — Keep keyboard focus and the viewport aligned](84-keep-keyboard-focus-and-viewport-aligned.md)

## Problem

[`SequencePlayheadGrip`](../../../src/components/atoms/SequencePlayheadGrip.tsx#L37)
hides the keyboard slider when its frame leaves the timeline viewport.
Zoom in at sequence frame zero, focus the slider, and press End. The slider
disappears offscreen and Home no longer works on it without refocusing.

## Acceptance criteria

- A seek initiated on the focused playhead retains a usable focus target
  when the destination was offscreen. Reveal the destination or use a
  focusable edge control.
- A browser regression can press End then Home on the slider without
  manually restoring focus. Also cover an arrow step across a viewport edge.
- Preserve the current seek bounds and avoid forcing the viewport to follow
  ordinary playback merely to fix keyboard focus.
