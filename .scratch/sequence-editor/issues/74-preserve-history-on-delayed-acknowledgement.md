# 74 — Preserve Undo when the host accepts an earlier pending edit

Status: ready-for-agent
Resolution: track outstanding proposal objects for the current history step; accepting an earlier proposal preserves Undo without changing the host contract.
Review priority: P2
Related: [09 — Undo](09-undo-the-last-edit.md),
[22 — Redo](22-redo-an-undone-edit.md),
[34 — Explicit edit acknowledgement](34-acknowledge-host-edits-without-object-identity.md)

## Problem

After one accepted edit establishes Undo history, let a host receive proposal A
and then B before responding. If the host feeds back the exact A object,
[history](../../../src/components/organisms/useSequenceHistory.ts) remembers only
B, treats A as an independent replacement, and clears history. This occurs
even with object identity; accepting a deserialized object is a separate
question in #34.

## Acceptance criteria

- A host acknowledgement allowed by the documented contract must not clear
  existing Undo history merely because another proposal was made.
- Verify the delayed acceptance case and continue to clear history on a
  genuine independent replacement. Rejected proposals must not add or consume
  entries.
- Decide whether to track outstanding proposals against their base sequence or
  serialize the proposals. Get maintainer approval before changing the public
  acknowledgement contract.

## Comments

- Triage: start with proposals made against the same host-supplied sequence.
  The host already acknowledges by returning the exact proposal object.
  Prefer tracking those proposals under the existing contract. Accepting a
  different object remains a separate question in [#34](34-acknowledge-host-edits-without-object-identity.md).
- Red → green in Chromium Storybook: after accepting the earlier of two
  proposals, Undo was disabled. Now two Undo steps restore the prior accepted
  sequence and the original without recording the unaccepted proposal.
- All eight existing Undo/Redo Chromium checks passed, including rejection
  and independent replacement. The combined suite with #70 passed 239 Vitest
  tests. Typecheck, formatting, and `git diff --check` passed; lint reported
  only the existing `VideoPlayer` captions warning.
- The isolated mutation restoring latest-proposal-only tracking failed the
  Storybook regression at the Undo availability assertion.
- A full-suite failure exposed a timing race in the older rejection test:
  the Storybook Controls switch could update separately from the preview,
  and the duration assertion matched both `00:06` and `00:06.5`. The test
  now accepts or rejects proposals explicitly inside the preview and checks
  exact durations and both callback counts. It passed five focused runs.
