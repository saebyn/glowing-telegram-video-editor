# 09 — Undo the last edit

Status: ready-for-agent
Resolution: implemented in `2077dd8`

## Acceptance criteria

- Undo restores the previous accepted sequence one committed edit at a time.
  A group move that grew the sequence restores all placements and the old
  duration together. Emit one sequence change and one compiler result.
- Selection, seeking, drag previews, and blocked edits are not history
  entries. With no available Undo, emit neither callback.
- The host stays authoritative. Feeding back an accepted edit preserves
  history; replacing the sequence independently clears local history.

## Comments

- Not implemented or verified in this batch: the PRD excludes Undo. Deciding how history behaves when the host replaces the controlled sequence is still a prerequisite.
- Triage: confirmed that external replacement clears both Undo and Redo.
  [22](22-redo-an-undone-edit.md) builds on this behavior.
- Implemented toolbar Undo for host-accepted edits. The host acknowledges a
  proposal by feeding back the emitted `Sequence` object; a different
  replacement clears history. A declined proposal neither creates nor
  consumes an entry. Undo emits the restored sequence and its compiled
  `CutList` result, including `null` when the layout cannot compile.
- Browser coverage uses the existing workflow stories: extending a group
  move, popping multiple accepted edits in order, rejecting a proposal with
  the **Accept edits** Control, and externally replacing the sequence as JSON.
  Selection, seeking, blocked and in-progress moves, and unchanged trim
  submissions leave history untouched.
- Integration follow-up: the rejection case clicks the Storybook switch's
  visible label, then verifies the switch state before editing. The four
  acceptance/rejection transitions passed in both Chromium color schemes.
- The four Undo regressions and the three existing workflow browser tests
  passed against built Storybook with Chromium. Typecheck and Vitest passed.
- Stryker on the Undo hook and new toolbar wiring killed 34 of 35 mutants
  (97.14%; no timeouts). The sole survivor was equivalent: changing the
  internal `"edit"` literal still takes the non-Undo branch. An initial
  broader run also included the unchanged emission code and killed 35 of 38
  mutants; the other survivors were optional callback guards, since both
  callbacks are supplied by the workflows.
