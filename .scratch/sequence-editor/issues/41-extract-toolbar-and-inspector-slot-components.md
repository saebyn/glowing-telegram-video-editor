# 41 — Extract the Toolbar and Inspector slot components

Resolution: extracted Toolbar and Inspector slots and scoped the editor shortcuts
Depends on: [40](40-extract-shared-sequence-editing-session.md)

## Proposal

Move the inline Toolbar and Inspector into `SequenceToolbar` and
`SequenceInspector`. Drive them with `toolbarProps` and `inspectorProps`
from the shared hook. Extract reusable child components without new page
sub-slots.

See [Composition interfaces](../../../docs/sequence-editor-design.md#composition-interfaces).

## Acceptance criteria

- Toolbar preserves transport, Split at playhead, Split mode, Undo/Redo,
  Delete, explicit shortening, and track add/rename. Pane toggles come from
  the page, not the session. Keplar transport props and seconds conversion
  stay inside the adapter.
- Inspector preserves placement selection summaries, the inspected placement
  within a selection, transition details, and trim/fade/dissolve edits. The
  session supplies effective ranges, bounds, and action availability rather
  than requiring each component to derive or validate them. Keep source
  ranges and source trim points on the source frame grid.
- The extracted UI and its child controls call named actions; they do not
  construct sequences to commit. The same edit rules apply in the Inspector
  and Timeline.
- The hook supplies notices and an opt-in root keyboard handler. The page
  renders notices separately from Toolbar; consuming arrow keys and nudges
  remains scoped to the editor and respects form controls. Escape in one
  editor must not dismiss Split mode in another.
- Verify one Toolbar or Inspector edit and its Undo through the controlled
  host, plus a selection or inspection change that emits neither callback.

## Comments

- The same-iframe, two-editor test failed when Escape outside both editors
  dismissed the first editor's Split mode. The root handler now leaves both
  alone when focus is outside and dismisses only the focused editor.
- TypeScript, formatting, lint (existing warnings), 127 Vitest tests, and
  125 Playwright sequence-editor tests against static Storybook passed.
  Light and dark smoke checks covered an Inspector trim and Toolbar Undo.
- Five targeted browser mutations were killed: ignoring Escape, emitting
  on inspection, disconnecting Undo, disconnecting trim, and disconnecting
  rename. Logs: `/tmp/opencode/sequence-41-static-mutation.g4zgHa`.
