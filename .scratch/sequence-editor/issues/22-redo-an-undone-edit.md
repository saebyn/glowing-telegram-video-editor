# 22 — Redo an undone edit

Status: ready-for-agent
Depends on: [09](09-undo-the-last-edit.md)

## Proposal

Restore one undone edit at a time. Redo restores all placements and any
sequence duration change together and produces one sequence and one
`CutList` result. Selection, seeking, and drag previews do not affect
history. A new committed edit after Undo starts a new history branch and
clears the redo path.

Use the same history policy as Undo when the host replaces the controlled
sequence.

## Comments

- Triage: the host replacement rule is settled. Implement after Undo
  provides local history and resets it on external replacement.
- Red → green in Storybook/Playwright: the group-move regression first found
  no Redo button. Redo now restores both placements and the duration of an
  accepted extending move, emitting exactly one sequence and one matching
  `CutList`. The exact original and restored results are checked independently.
- The existing Undo acknowledgment rule also governs Redo: only the host
  feeding back the proposed object advances history. An accepted Undo adds
  one redo step; an accepted Redo consumes one step. A newly accepted edit
  clears the redo path, and an independent sequence replacement clears both
  paths without an editor emission.
- All four Redo tests passed against isolated static Storybook: restoring a
  group move, reapplying two edits in order while preserving history across
  seek and selection, retaining history after a declined proposal and clearing
  it after a new acceptance, and clearing it silently on host replacement.
- The scoped Stryker batch reached 11 of 22 mutants before the seven-minute
  command limit; all 11 completed mutants were killed. In the instrumented
  static snapshot, targeted Playwright runs also rejected mutations that
  omit the redo step after Undo, fail to consume a Redo step, retain history on
  independent replacement, or pop only one redo step after a new edit.
  The last mutant initially survived; the branch test now starts with two
  redo steps, fails against the exact mutant, and passes on the unmutated
  implementation. Final static run: four passed.
