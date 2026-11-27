# 69 — Reject competing fades at the same cut during CutList compilation

Status: ready-for-agent
Resolution: visible fades claiming the same cut block CutList compilation without changing the authored edit.
Review priority: P2
Related: [27 — Flatten multitrack sequences](27-flatten-multitrack-sequences-with-transitions.md),
[28 — Keep empty tracks neutral](28-keep-empty-tracks-neutral-for-fades.md)

## Problem

Put a two-sequence-frame reveal on placement A at `[0, 10)` and a
two-sequence-frame entry fade on B at `[10, 20)`. Both claim the cut at sequence
frame 10. A move can create this arrangement even though authoring would
reject adding the second visible fade directly. Preview reports
`Undefined transition`, but [the compiler](../../../src/utils/sequenceTransitions.ts)
returns `ok: true` and emits both fades.

## Acceptance criteria

- `compileCutList` returns `ok: false` with a transition conflict issue when
  two visible fades compete at one cut, even if their windows do not overlap.
- The editor preserves both authored transitions after a placement edit and
  explains why the `CutList` is unavailable; it does not choose a winner.
- Verify that a fully covered fade does not conflict and that empty tracks
  remain neutral for a valid arrangement.

## Comments

- Triage: reuse the existing `fade-overlap` issue code and make its display
  text cover fades competing at a cut, even with disjoint windows. Keep
  [#73](73-detect-audio-transition-conflicts.md) separate: it fixes authoring
  validation, not the compiler's export model.
- Red → green through `compileCutList` and the editor: nudging adjacent
  placements onto one cut preserves both transitions and emits a failed
  `CutList` result with a visible notice. A partly visible, interrupted fade
  can report both issues. Fully covered fades and empty tracks remain neutral.
- 175 unit and 17 Chromium fade tests passed, with typecheck, focused lint,
  formatting, and `git diff --check`. Isolated mutations were caught when
  same-cut checks were removed and when hidden fades incorrectly claimed a cut.
