# 13 — Add and remove tracks

Resolution: implemented and verified with the controlled Storybook host

## Proposal

Let editors add and remove tracks as authored sequence edits. Adding an
empty track must not shift any placement in sequence time. Preserve the
relative order of surviving tracks and keep sequence duration unchanged.
Track reordering is a separate feature.

Add each new track at the top, regardless of selection. Only empty tracks
can be removed. Do not offer removal for an occupied track or the last
track, or delete or move placements implicitly.

A host can supply a sequence with zero tracks. Show an empty track view
with an “Add your first track to begin” prompt and offer Add track when
editable. Loading that sequence does not create a track or emit an edit.
Undo of the first track addition restores the zero-track state.

## Comments

- Triage: no track-count cap for the compiler. Empty tracks should not alter
  the compiled result or disable fade controls. The current fade checks
  count authored tracks rather than evaluating the result; see
  [28](28-keep-empty-tracks-neutral-for-fades.md) for the independent fix.
  Align on insertion position and whether zero tracks is a valid editor
  state before starting this ticket.
- Batch check: empty-track neutrality is implemented separately by 28.
- Design review: keep Remove track and Undo distinct. Remove track
  cannot remove the last track; Undo can restore a host-supplied
  zero-track state.
- Add inserts an empty top track without changing sequence duration. The
  track header offers Remove only for an empty track when another track
  remains. A zero-track sequence is shown without modification, and Undo
  restores it after adding the first track.
- Playwright red → green covered empty state, read-only behavior, add,
  remove, and Undo. Vitest, TypeScript, and formatting passed; Stryker
  killed 35/35 edit-rule mutants and the browser checks killed all four
  targeted UI/history mutants. The broader dev run hit the intermittent
  native pool-drop case; see `/tmp/opencode/ticket13-final-browser.log`.
