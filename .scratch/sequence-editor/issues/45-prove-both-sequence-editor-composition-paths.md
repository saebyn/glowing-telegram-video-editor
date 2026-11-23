# 45 — Prove both sequence editor composition paths

Resolution: verified both public composition workflows in Storybook
Depends on: [44](44-compose-and-export-the-sequence-editor-page.md)

## Proposal

Demonstrate the public interfaces in Storybook without creating another
editing path or shipping a preview player.

See [Storybook editing setups](../../../docs/sequence-editor-design.md#storybook-editing-setups).

## Acceptance criteria

- One controlled-host story uses `SequenceEditorPage`, wraps a default
  component by forwarding its slot props, and meaningfully replaces Timeline
  without importing private modules. Exercise a Preview replacement that
  displays the same sequence playhead as Timeline without a player.
- Another controlled-host story calls `useSequenceEditor` directly and
  rearranges public components, reusing `SequenceWorkspace` without
  `SequenceEditorPage` and without copying edit or transport logic.
- Across the two stories, test through public props and host callbacks:
  seeking emits no persisted edit; one valid edit proposes one sequence and
  one `CutList` result and becomes undoable only on host acceptance; blocked
  and cancelled edits emit nothing.
- Keep the rough-cut and layered-edit workflow stories as the default
  baseline. Verification stops at the emitted `CutList`.

## Comments

- The current `SequenceEditor.workflows.browser.ts` listing test expects
  only the two default workflows. Keep that baseline assertion distinct from
  the two new composition examples, and keep verifying that both default
  workflows feed edits back and log both callbacks.
- The composition listing check first failed because the two examples did
  not exist. The examples now use only the package entry point for editor
  components and actions. The slot-replacement story verifies that Timeline
  and Preview agree after a seek, then checks an exact `CutList` and delayed
  Undo until the host accepts. The hook-built story uses real pointer
  gestures to check that blocked and cancelled moves emit neither callback.
- TypeScript, formatting, lint (existing warnings), 127 Vitest tests, the
  Storybook build, and all 133 Playwright tests passed using the committed
  test configuration. All three composition tests also passed in dark mode.
- Three targeted browser mutations were killed: disconnecting seek,
  accepting the proposal immediately, and leaving the move draft on Escape.
  Logs: `/tmp/opencode/sequence-45-static-mutation.zgq8lW`.
