# 25 — Reorder and lock tracks

Status: needs-info

## Proposal

- Reorder tracks without changing track identity or placement positions.
  Track priority changes where placements overlap, so compile the updated
  sequence in its new track order.
- Lock a track to protect it from unwanted edits while working on other
  tracks. Make locked tracks recognizable and explain when a lock blocks an
  operation. A group edit must not partially apply to get around a lock.

Decide which actions locks block (including drops onto a locked track) and
whether locks are saved with the sequence or only affect the current editing
session. Reordering and locking can be delivered independently.

## Comments

- Not started: decide which actions locks block and whether locks persist.
  Reorder can be scoped separately.
