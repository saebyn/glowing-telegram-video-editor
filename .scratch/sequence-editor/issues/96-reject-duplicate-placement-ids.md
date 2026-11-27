# 96 — Reject duplicate clip placement IDs before editing

Status: needs-triage
Review priority: P2
Related: [78 — Report invalid sequence inputs](78-report-invalid-sequence-inputs.md)

## Problem

Sequence input validation accepts two clip placements with the same ID on
different tracks. The [move planner](../../../src/utils/placementDrag.ts#L177)
stores move data by placement ID. In a reproduced case, moving one of two
placements with the same ID replaced both with the second placement's clip.

## Acceptance criteria

- Diagnose duplicate placement IDs across the whole sequence before
  enabling editing. Do not pick one of the placements or mutate the inputs.
- A move against the ambiguous sequence emits no edit. Correcting the IDs
  restores editing. Multiple placements of the same clip remain valid
  when their placement IDs are distinct.
- Follow the invalid-input behavior from #78 and get approval before adding
  to the public diagnostic types.

## Comments

- This issue still applies to `initialSequence` after
  [#111](111-own-the-working-sequence-and-history.md). In that interface,
  open the corrected snapshot with a new key; a same-key rerender does not
  replace the working sequence.
