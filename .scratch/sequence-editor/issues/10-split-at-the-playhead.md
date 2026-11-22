# 10 — Split at the playhead

Status: ready-for-agent
Depends on: [06](06-control-the-playhead-without-media.md)

## Acceptance criteria

- Split selected placements that strictly span the sequence playhead, at
  matching source and project frame rates. A selection whose edges meet the
  playhead but do not span it does not produce an edit.
- Each split produces two adjacent placements on the same track, using the
  same clip and preserving source alignment on each side. Other placements
  and sequence duration are unchanged. Commit the split as one edit.
- The entry transition stays with the left placement, and the reveal
  transition stays with the right. Keep each duration unless the split cuts
  through its region; in that case shorten it to fit its resulting placement.
  Do not add a new transition at the split. For example, splitting eight
  sequence frames into an entry fade of twenty keeps an eight-frame entry
  fade on the left.
- Emit one sequence change and one compiler result. Existing compilation
  limits do not prevent a valid authored split.

## Comments

- Not implemented or verified in this batch: the PRD excludes Split. Transition behavior at the split still needs a decision; playhead transport alone does not make this ticket ready.
- Triage: confirmed shortening affected transitions to fit the split pieces.
- Follow-up implementation: Split is available when at least one selected
  placement strictly spans the playhead at the project frame rate. The left
  half keeps its placement ID; each right half gets a new ID. The split
  preserves the source alignment, keeps fades on the outside edges, and
  commits the eligible selection as one edit.
- Vitest red → green: trimmed source alignment, strict edge exclusion, exact
  rate matching, fade shortening, and whole sequence frames. The seven
  focused tests also cover eligible subsets and missing clip metadata.
- Storybook/Playwright red → green: both workflow tests first found Split
  disabled with an eligible selection. Both passed against an isolated
  static Storybook. A layered split emits one sequence and the expected
  compiled cut; a split in the rough cut preserves its uncovered gap and
  emits one sequence and a `null` compiler result. Selection, seeking, and
  an edge-only split emit nothing.
- Final isolated Stryker run killed 81 of 82 mutants: 71/71 in the split
  rules and 10/11 in the toolbar wiring, with no timeouts or errors. The
  survivor removes the click handler's defensive null check. It is
  equivalent through the supported UI: the button only enables when the
  same selection, playhead, and split rule produce a next sequence.
- The integration snapshot also passed all 113 Vitest tests and TypeScript
  typecheck.
