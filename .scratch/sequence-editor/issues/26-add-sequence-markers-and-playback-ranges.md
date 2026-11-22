# 26 — Add sequence markers

Status: needs-info

## Proposal

Mark positions in sequence frames so editors can return to important edit
points. Sequence markers are not source annotations: they refer to a
position in the edit, not a frame in a particular source.

Decide whether markers are persisted or session-only, and what happens to
them when the sequence endpoint moves.

## Comments

- Not started: persistence and behavior at a changed sequence endpoint
  still need decisions.
- Playback ranges and loop points are tracked separately in
  [39](39-add-loop-points-with-keplar.md).
