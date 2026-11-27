# 111 — Own the working sequence and history in the editor

Resolution: The page and hook own the working sequence and history; reopen by React key.
Review priority: P1
Depends on: None
Design: [ADR 0002](../../../docs/adr/0002-own-the-working-sequence-in-the-editor.md)
and the [sequence editor contract](../../../docs/sequence-editor-design.md#model-and-ownership).

## Problem

The host must echo back the exact sequence object for local edits and history
to advance. That ties editing to host acknowledgement and makes an omitted
listener mean read-only. Replace that contract for the default page and
hook-built layouts together.

## Acceptance criteria

- Replace `sequence` with `initialSequence` on `SequenceEditorPage` and
  `useSequenceEditor`. Initialize on mount. A same-key rerender with a different
  `initialSequence` preserves the working edit, history, and editor UI state.
  A new key opens the supplied snapshot and resets history and editor state
  without emitting an edit. For a custom layout, key the component calling
  the hook. Treat input and emitted snapshots as immutable; no cloning,
  freezing, or identity-based acknowledgement is required.
- A valid edit, Undo, or Redo applies to the working sequence and updates
  history before notifying. Each edit is one Undo step; a new edit after
  Undo clears Redo. Two edits before a React render build on one another and
  each notify in commit order. The editor never waits for, rolls back on, or
  requires a save result. No host echo, parallel controlled mode, or read-only
  mode. Update both exported entry points and all repository callers.
- Each optional listener works without the other. `onSequenceChange` receives
  only the resulting snapshot; `onCutListResult` follows for that same
  committed snapshot, even when export reports an issue. Mounting, reopening,
  selection, seeking, previews, and blocked, cancelled, or unchanged actions
  emit neither. Without either listener, edits and history still work.
- Retain invalid-input reporting for the current sequence and preserve
  gestures on equivalent clip inputs. The host can add clips and refresh
  metadata for the same media without reopening. Removing or re-trimming
  existing clips, replacing their media, or changing the project frame rate
  requires reopening; no history rebase.
- Carry forward [#87](87-define-history-after-clip-changes.md): refuse an invalid
  next Undo or Redo target without changing the sequence or either stack,
  skipping the entry, or notifying either edit listener. Verify both directions
  with a clip missing only from the target. Restoring that clip makes the
  same step available again. Valid but unexportable targets remain eligible.
- Migrate the history and composition stories and browser regressions rather
  than keeping acceptance/rejection fixtures. Verify immediate editing and
  Undo/Redo, listener-free editing, a late save response with a same-key
  rerender, and keyed reopening through the public page and hook composition
  paths. Preserve existing observable behavior that depended on acceptance,
  such as selecting a new transition, by doing it on local commit.

Named-intent revalidation and the lock slot change are tracked in
[#112](112-apply-edit-intents-to-the-current-sequence.md). Public usage docs
ship with [#113](113-document-the-session-owned-editor.md).

## Comments

- Browser red → green covered edits without listeners, two commits before a
  rerender, notification order when a listener starts another edit, keyed
  reopening, and retrying invalid Undo/Redo after restoring the missing clip.
  Migrated the existing pointer regressions to use the working sequence.
- Full Playwright suite passed (231); the subsequent focused history and
  composition run passed all 30 tests after adding the reentrant case.
  Vitest (299), typecheck, lint (existing captions warning only), formatting,
  library build, packed CSS, and `git diff --check` passed.
- Five targeted mutations were caught: batched edits from stale state,
  missing history validation, export gated on a sequence listener, Redo not
  cleared by a new edit, and interleaved notification pairs. Logs:
  `/tmp/opencode/gtve-111-mutations.yQVySr/` and
  `/tmp/opencode/gtve-notifications-mutation.NWAhLI/out.log`.
