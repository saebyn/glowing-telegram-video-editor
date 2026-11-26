# 75 — Cancel queued Preview audio when seeking to the sequence endpoint

Status: ready-for-agent
Resolution: explicit seeks and pauses cancel queued Preview sound; natural forward completion can drain the final authored sound.
Review priority: P2
Related: [49 — Sequence Preview HLS playback](49-design-hls-playback-for-sequence-preview.md)

## Problem

While playing forward with sound, use End on the sequence playhead to seek to
the exclusive endpoint. The transport shows `Paused`, but
[Preview](../../../src/components/molecules/SequencePreview.tsx#L196) exempts
every pause at the endpoint from cancellation. Audio already queued at the
old position keeps playing. A seek to the preceding sequence frame cancels it.

## Acceptance criteria

- An explicit seek to the endpoint cancels audio queued at the previous
  position just as a seek to any other sequence frame does.
- Only natural forward completion may drain audio queued for the final
  authored sequence frames. An explicit pause cancels pending sound.
- Verify both paths with deterministic audio scheduling assertions, including
  a seek while more than one audio block is queued.

## Comments

- Triage: distinguish an explicit seek or pause from natural completion at
  the transport boundary. Seek and completion can produce the same
  paused-at-endpoint snapshot. Get approval before changing public Preview
  or transport interfaces.
- Red → green through a local HLS story with deterministic Web Audio
  scheduling. `End` used to leave several queued sound blocks outstanding.
  The transport now signals the registered Preview on explicit seek and
  pause, without changing the public interfaces. Natural completion leaves
  final-frame sound queued.
- All 17 Preview Chromium checks passed. Three isolated browser mutations
  caught missing seek cancellation, missing pause cancellation, and
  cancellation at natural completion. Changed-file formatting and
  `git diff --check` passed.
