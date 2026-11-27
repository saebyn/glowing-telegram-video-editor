# 42 — Connect Clip Pool and Timeline through frame-based edits

Resolution: connected clip handoff and frame-based placement actions
Depends on: [41](41-extract-toolbar-and-inspector-slot-components.md)

## Proposal

Introduce `SequenceClipPool` as the editor adapter around `ProjectClipPool`.
Connect it and the default Timeline through named slot props for seeking,
placement moves, and placing clips. Keep the existing `ProjectClipPool`
behavior for other consumers.

See [Selection and atomic moves](../../../docs/sequence-editor-design.md#selection-and-atomic-moves).

## Acceptance criteria

- The shared drag handoff carries the active clip ID and begin/end lifecycle.
  Native drag events and payloads stay inside adapters; the default Timeline
  can accept a drag from a different Clip Pool following that lifecycle.
  A Timeline can also preview or place a clip by ID without a drag.
- The Timeline expresses move and clip-placement destinations as a track ID
  and whole sequence frame. Side-effect-free evaluators expose exact
  fitted positions or a blocked reason, not widget rows or a proposed `Sequence`.
- Release revalidates the intent against current inputs. A group move
  remains atomic and a valid extension is part of the same edit.
- Verify seeks, previews, cancellation, and blocked releases emit neither
  host callback. Check that a move which became blocked after its preview
  emits nothing, and a valid extending move or drop can be undone as one
  accepted edit.

## Comments

- The current Timeline reads the default Clip Pool's `application/json`
  payload on drop. Use the active clip ID from the shared handoff for both
  preview and native drop. Verify that a replacement Clip Pool works without
  that payload, and that ending the handoff prevents a later native drop from
  committing. Leave the payload behavior of `ProjectClipPool` itself intact.
- The native test failed first because the Timeline ignored a replacement
  pool's drag with no JSON payload. Both adapters now use the shared clip ID.
  Cancel and release are covered by real pointer gestures. A separate
  frame-based control confirms a host lock invalidates an earlier preview
  and that direct placement requires no native gesture.
- TypeScript, lint (existing warnings), formatting, 127 Vitest tests, and
  all 127 sequence-editor Playwright tests against static Storybook passed.
  Both new cases also passed in dark mode. Four targeted mutants were
  killed (JSON gate, ignored handoff end, stale move validation, and
  requiring a drag for direct placement).
