# 40 — Extract the shared sequence editing session

Resolution: extracted the shared session and verified transport, selection, and host history

## Proposal

Start extracting `useSequenceEditor` beneath the current default editor.
Move shared transport, selection, and accepted-edit history out of the page
assembly. Keep the hook and new contract internal until [44](44-compose-and-export-the-sequence-editor-page.md)
exposes all five slots together.

See [Composition interfaces and Model and ownership](../../../docs/sequence-editor-design.md).

## Acceptance criteria

- The hook takes the host's sequence, clip and source inputs, and callbacks.
  It reads the project frame rate from `ProjectProvider`. Layout, pane
  visibility, and resizing are not hook inputs.
- One hook call owns the shared playhead, playback, placement and transition
  selection, and accepted-edit history. The default UI uses that same session.
  Forward, reverse, pause, and seek work without media or authored edits.
- Render the disconnected placeholder as `SequencePreviewPlaceholder`. Its
  read-only slot props contain the sequence playhead, project frame rate,
  sequence duration, and playback state. No player wiring or media is required.
- Preserve the host callback and history contract. With both callbacks
  supplied, one valid edit emits one sequence proposal and its `CutList`
  result, including `null` when unsupported. Only feeding back the exact
  proposal acknowledges it for Undo. Read-only, rejected proposals, and
  unrelated host replacements retain their existing behavior.
- Preserve the relevant no-media transport, selection, and Undo/Redo
  regressions through observable controls and host callbacks.

## Comments

- The Preview check first failed after a ruler seek (the placeholder showed
  no transport state). It now observes the same frame and playback direction
  as the editor; seek, playback, pause, and selection do not propose edits.
- TypeScript, formatting, lint (existing warnings), and all 127 Vitest tests
  passed. The static Storybook build passed all 59 focused Playwright
  regressions; a light/dark smoke check also matched Preview and transport.
  An initial cold development-server run timed out loading the story.
- Targeted browser mutations killed five regressions: frozen playback state,
  wrong reverse state, lost group selection, compiling the prior sequence,
  and suppressing a `null` compiler result. The stale-frame mutation's
  first run timed out during navigation and was not counted.
