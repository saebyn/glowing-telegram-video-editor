# 87 — Define Undo and Redo when host clip inputs change

Resolution: Superseded as a standalone ticket by [#111](111-own-the-working-sequence-and-history.md), which covers implementing and verifying the invalid history target rule.
Review priority: P2
Related: [34 — Explicit host edit acknowledgement](34-acknowledge-host-edits-without-object-identity.md),
[74 — Preserve history on delayed acknowledgement](74-preserve-history-on-delayed-acknowledgement.md),
[78 — Report invalid sequence inputs](78-report-invalid-sequence-inputs.md)

## Problem

The host owns the clip pool, but [`useSequenceHistory`](../../../src/components/organisms/useSequenceHistory.ts)
stores sequence snapshots without the corresponding clips or project rate.
Delete the last use of a clip, accept the edit, then remove the unused clip
from the pool without replacing the sequence object. Undo proposes a sequence
with a dangling clip reference. Accepting it disables editing and Redo.

See [the history design](../../../docs/sequence-editor-design.md#action-intent-and-history).

## Agreed behavior

- Refuse an invalid Undo or Redo target without consuming or skipping it.
  The editor does not restore or change the host's clips or sources.
- Removing or re-trimming an existing clip or changing the project rate
  requires reopening. There is no history rebase for those changes.

## Verification

- When a clip is missing only from a history target, the step leaves the
  current sequence and both stacks unchanged and emits neither edit callback.
  If the clip is supplied again, the original step is available. Verify both
  Undo and Redo.
- An unexportable but valid sequence (for example, one with an internal gap)
  remains eligible for Undo and Redo.
