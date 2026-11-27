# 113 — Document the session-owned editor in the README

Resolution: Document the shipped session contract and the migration in the README.
Review priority: P1
Depends on: [111](111-own-the-working-sequence-and-history.md), [112](112-apply-edit-intents-to-the-current-sequence.md)
Design: [Sequence editor design](../../../docs/sequence-editor-design.md#model-and-ownership).

## Problem

The README currently calls the editor controlled and shows
`onSequenceChange={setSequence}` feeding back the exact object. That example
would give the wrong integration guidance after the approved changes.

## Acceptance criteria

- Replace the controlled example with a working `SequenceEditorPage` usage
  showing mount-only `initialSequence` and a stable `key` that changes only
  when the host opens a sequence. Explain where to put the key in a custom
  layout using `useSequenceEditor`. Do not key the editor by the latest
  snapshot or save response.
- Explain that the editor works without listeners, owns Undo/Redo, and emits
  immutable-by-contract snapshots after commits. If the host saves, it
  handles scheduling, retries, and errors independently. Document the
  separate optional `onCutListResult` notification and that export issues do
  not reject valid edits. Do not show a feedback loop.
- Document which clip/source inputs can change live and which changes
  require reopening, including a changed project frame rate. Distinguish
  invalid input diagnostics from export issues.
- Include a short migration note for `sequence` → `initialSequence`, removing
  acknowledgement and callback-based read-only behavior, and custom Timeline
  callers switching to `setTrackLocked(trackId, locked)`. Update other
  public usage docs if they still teach the old contract; leave closed
  tickets as historical records.
- Replace the design and data-flow notes that mark this work unimplemented
  once the code ships. Check links, `git diff --check`, and the examples
  against the migrated public types and Storybook compositions.

## Comments

- Type-checked the README page example against the built public declarations
  in `dist/index.d.ts`. Checked the keying and callback guidance against the
  page and hook Storybook compositions verified in #111 and #112.
- Verified local links and heading anchors, and ran `git diff --check`.
  No runtime code changed.
