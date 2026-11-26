# 87 — Define Undo and Redo when host clip inputs change

Status: needs-info
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

See [the host/session data flow](../../../docs/sequence-editor-data-flow.md#from-a-gesture-to-a-host-accepted-edit).

## Decision needed

Should an invalid history target stay unavailable until the host restores the
metadata, should history reset when relevant inputs change, or should the
editor skip invalid entries? Also decide what Undo should mean when a clip's
trim or the project rate changes and the old sequence is still valid but
resolves to different media or timing. Do not assume the editor can restore
or edit the host's clip pool.

## Verification after the decision

- The removed-clip scenario cannot emit an invalid proposal or strand the
  user in a state where Redo is unavailable because the accepted Undo broke
  placement geometry. Apply the agreed rule symmetrically to Redo.
- An unexportable but valid sequence (for example, one with an internal gap)
  remains eligible under the agreed history policy.
