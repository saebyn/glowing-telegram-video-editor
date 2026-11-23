# 06 — Control the playhead without media

Resolution: implemented in `dc35b6b`
Depends on: None

## Acceptance criteria

- Ruler clicks and playhead dragging seek to whole sequence-frame positions. Seeking on the ruler does not clear placement selection.
- Forward, reverse, and pause move or hold the playhead within the authored sequence even with the preview pane disconnected.
- Seeking and transport change session state only. They never emit sequence or `CutList` edits.

## Comments

- Implemented ruler seeking and a keyboard-accessible drag grip that snaps to whole
  sequence frames and clamps to `[0, durationFrames]`. The ruler does not alter
  placement selection. Forward, reverse, and pause use a project-rate clock
  bounded by the authored duration, not the widget's playback engine or media.
  Manual seeking pauses transport. No navigation action emits host edits.
- Saw each browser slice fail before implementing it, then pass in Chromium:
  ruler seek, drag with pointer capture and endpoint clamping, forward through a
  gap and pause, and reverse with automatic stop at both boundaries. The
  boundary test uses the Inspector to create a trailing gap and verifies that
  transport emits nothing beyond the initial trim's two callbacks.
- The ruler grip hides during temporary drag headroom for placement moves and
  pool drops, without changing their scroll behavior. Typecheck and focused
  lint passed.
- The parent's clock mutation run killed 31 mutants with one survivor:
  removing the pause on seek. The test now seeks via a real ruler click during
  playback. On an isolated copy the mutant advanced to frame 234 instead of
  holding the sought frame 270; all four tests passed with production code
  restored.
- The initial four browser cases passed in both light and dark Chromium on a
  static Storybook build. The follow-up Stryker pass killed all 33 transport
  clock mutants and 7 of 10 pointer-to-frame grip mutants. The three grip
  survivors involve no active pointer or event propagation. No timeouts.
  Report: `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket06-final/reports/mutation/mutation.json`.
- Stryker also killed all 5 targeted mutants for the follow-up grip pause and
  persistent host-duration clamp. Report:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket06-follow-up/reports/mutation/mutation.json`.
- Under concurrent validation, the fake clock halted between animation
  ticks, so the reverse readout still showed frame 313 at the instant
  frame 312 became due. Intermediate playback checks now allow the last
  rendered tick; the seek, paused hold, and endpoint checks stay exact.
- Review follow-up, red → green in isolated Chromium (port 6016): holding the
  playhead grip without moving advanced frame 48 to 96 before the fix; now it
  pauses at 48 on pointerdown and stays there through release. Replacing the
  authored sequence through Storybook Controls clamped a paused frame from
  270 to 180, but restoring the longer sequence brought back 270 before the
  fix; now it stays at 180.
- All six playhead browser tests passed together after the fixes. Typecheck,
  focused lint and formatting, and `git diff --check` passed. The final
  static Storybook rerun passed all six in both Chromium color schemes.
- Read-only review confirmed that transport does not call the edit commit path.
  All six playhead cases passed in the 41-test static Storybook/Chromium recheck
  on `feat/sequence-editor`; no transport blocker found.
