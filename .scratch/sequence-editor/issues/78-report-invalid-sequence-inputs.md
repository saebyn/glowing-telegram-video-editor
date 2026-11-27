# 78 — Report invalid sequence inputs to the host

Status: ready-for-agent
Resolution: report typed input diagnostics once per distinct invalid state and suspend editing and playback until the host corrects its inputs.
Depends on: None
Related: [70 — Diagnose invalid source frame rates](70-handle-invalid-source-frame-rates.md)

## Problem

Deriving the sequence end requires valid placement geometry across every track.
Currently, invalid input can produce a local diagnostic without notifying the
host, and the editor may allow edits to unaffected placements. The host should
get an error rather than the editor making decisions from a partial layout.

## Acceptance criteria

- Expose a typed `onSequenceInputError` callback on `SequenceEditorPage` and
  `useSequenceEditor`. Report missing referenced clips, invalid placement starts
  or effective source ranges, invalid source or project frame rates, unsafe end
  frames, and same-track overlap. A valid mixed-rate edit, a sequence gap, or
  missing render media is not an input error just because it blocks export.
- Notify on initial invalid input and when the diagnostics change. An unrelated
  rerender or an equivalent set of diagnostics doesn't notify again. Recovery
  needs no callback; invalid input after recovery is reported again.
- While input is invalid, show the diagnostic and block edits and playback,
  including through custom slots, without throwing, discarding placements, or
  inferring a partial duration. Supplying valid inputs restores editing without
  emitting a sequence change. `onCutListResult` remains for edit proposals only.
- Verify invalid load, replacement during an existing session, repeated
  renders, and recovery through public editor behavior and host callbacks.
  Update the #70 regression that previously expected unaffected placements
  to remain editable. Keep focused tests for validation and export-only cases.

See the [model and ownership design](../../../docs/sequence-editor-design.md#model-and-ownership).

## Comments

- Red → green: reproduced the missing host notification, unaffected placement
  edits during invalid input, duplicate notifications for equivalent rate
  objects, and a false overlap around an invalid start. The default page and a
  host-built layout cover invalid load, live replacement, retained slot actions,
  playback stopping, and recovery. The #70 regression now verifies an edit
  after correction, not during invalid input.
- 263 Vitest tests and 203 Playwright tests passed. Typecheck, build, formatting,
  and `git diff --check` passed; lint reported only the existing `VideoPlayer`
  captions warning.
- Five isolated mutations were caught: treating missing render media as an input
  error, restoring raw start-frame sorting, dropping notification deduplication,
  allowing retained edit proposals, and allowing retained transport actions.
