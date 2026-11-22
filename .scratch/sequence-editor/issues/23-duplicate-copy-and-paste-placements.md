# 23 — Duplicate, copy, and paste placements

Status: needs-info
Depends on: [02](02-select-and-move-placements-together.md)

## Proposal

Let editors duplicate a placement or group in the current sequence and copy
and paste a selection elsewhere in it. New placements get their own
identities while reusing the clips and preserving source ranges, entry and
reveal transitions, and relative sequence positions and track spacing.

Copy alone does not edit the sequence. Duplicate or paste should commit the
entire result or nothing. Decide the default destination, how the destination
track is chosen, and whether cross-sequence or system clipboard support is
needed later.

## Comments

- Not started: the default destination and destination-track selection
  still need decisions.
