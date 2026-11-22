# 26 — Add sequence markers and playback ranges

Status: needs-info
Depends on: [06](06-control-the-playhead-without-media.md) for playback ranges

## Proposal

Mark positions in sequence frames so editors can return to important edit
points. Sequence markers are not source annotations: they refer to a
position in the edit, not a frame in a particular source.

Let editors set a bounded playback range and loop it for review. It should
work with the sequence playhead even when media preview is disconnected.
Setting or looping a range does not trim or otherwise edit the sequence.

Decide whether markers and ranges are persisted or session-only, and what
happens to them when the sequence endpoint moves.

## Comments

- Not started: persistence and behavior at a changed sequence endpoint
  still need decisions.
