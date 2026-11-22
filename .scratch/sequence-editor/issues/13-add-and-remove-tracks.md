# 13 — Add and remove tracks

Status: needs-info

## Proposal

Let editors add and remove tracks as authored sequence edits. Adding an
empty track must not shift any placement in sequence time. Preserve the
relative order of surviving tracks and keep sequence duration unchanged.
Track reordering is a separate feature.

Only empty tracks can be removed. Do not offer removal for an occupied track
or delete or move placements implicitly.

Still to decide: where new tracks are inserted and whether the last track can
be removed. Suggested first pass: add new tracks at the top and keep at least
one track available for dropping clips.

## Comments

- Triage: no track-count cap for the compiler. Empty tracks should not alter
  the compiled result or disable fade controls. The current fade checks
  count authored tracks rather than evaluating the result; see
  [28](28-keep-empty-tracks-neutral-for-fades.md) for the independent fix.
  Align on insertion position and whether zero tracks is a valid editor
  state before starting this ticket.
- Batch check: empty-track neutrality is implemented separately by 28.
  Track insertion and zero-track policy still need decisions.
