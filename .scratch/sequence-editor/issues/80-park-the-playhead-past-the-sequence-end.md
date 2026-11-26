# 80 — Keep the playhead parked when the sequence shrinks

Status: ready-for-agent
Resolution: preserve the parked playhead on shrink; clamp only for seeks, steps, or playback and show black and silence past the end.
Depends on: [79 — Derive sequence duration](79-derive-sequence-duration-from-placements.md)
Related: [75 — Cancel queued audio on a seek to the sequence end](75-cancel-audio-on-seek-to-endpoint.md)

## Acceptance criteria

- When a duration change puts the sequence end before the playhead, keep the
  playhead at its existing frame and stop playback. This includes accepted
  edits and replacement inputs from the host. Undo and Redo don't reposition
  it. Show the parked playhead on the timeline when its position is in view.
- Past the end, Preview shows black, cancels queued sound, and doesn't decode
  the last frame. At the exclusive end itself, hold the last frame without
  sound as before. Shrinking while the playhead remains in range doesn't
  reposition it.
- With the playhead parked at 110 and the end at 100, one step back lands at
  99; reverse starts from 100; Play forward lands at 100 and stays stopped.
  Apply the same clamp-before-action rule to relative transport seeks.
  Explicit seeks clamp their requested position to `[0, duration]`; Pause
  doesn't seek. An empty sequence can't start playback.
- Verify the transition from playing to parked, including with Preview
  omitted, the difference between sampling at and beyond the end, and the
  recovery actions through observable transport and preview behavior.

See [Playhead without a media preview](../../../docs/sequence-editor-design.md#playhead-without-a-media-preview)
and [Sequence preview target](../../../docs/sequence-editor-design.md#sequence-preview-target).

## Comments

- Red → green: the old transport snapped a paused playhead on host replacement,
  stepping back from a parked frame landed on the end instead of one frame before
  it, and the parked Preview showed the final picture instead of black.
- 257 Vitest tests and 29 targeted Playwright tests passed. The full browser run
  passed 204 of 205; the remaining test raced Storybook host acknowledgement.
  After waiting for the observed duration change, it passed five consecutive
  standalone runs and the targeted suite. Typecheck, build, formatting, and
  `git diff --check` passed. Lint had only the existing captions warning.
- Isolated mutations caught restoring the old clamp, continuing playback
  after shrink, stepping from the parked position, and sampling the final
  picture past the end. Removing only the reader's early return was equivalent
  for picture and sound: presentation itself returns no contributors there.
