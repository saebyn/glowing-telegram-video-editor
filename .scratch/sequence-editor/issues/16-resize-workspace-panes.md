# 16 — Resize workspace panes

Status: ready-for-agent

## Proposal

Make the Clip pool, Preview, and Inspector panes resizable. Keep pane
contents usable at their minimum sizes. Resizing changes workspace layout
only, not the authored sequence, and does not require a working media preview.

Pane sizes are session-only for the first pass. Persisting them across
sessions is out of scope.

## Comments

- Agreed seam: the existing rough-cut Storybook workflow in Chromium. Drag
  the visible separators and compare the panes' rendered positions and
  widths; use the story host to observe edit callbacks. No private state or
  new story fixtures.
- Red on port 6016: the workflow rendered but the Clip pool / Preview
  separator was missing. In an isolated integration copy, adding the
  workspace made the 72px transfer pass. Follow-up browser checks cover
  both separators, the three minima, an editable Inspector field at its
  minimum, no emissions during or after dragging, and preserving
  keyboard-adjusted widths through the narrow stacked layout.
- The shared Editor integration preserves the existing toolbar actions and
  Timeline props. Its frozen snapshot passed 11 browser checks (resize,
  layout, Inspector, workflow, and shorten), 113 Vitest tests, typecheck,
  changed-file lint and formatting, and the library build. Both handles
  were checked in light and dark modes.
- Targeted Stryker/Chromium snapshot: the first run killed 10/13. Dragging
  across all of Preview and checking for page errors killed the remaining
  pointer and clamp mutants on the next run. With the keyboard and capture
  lines added, that run killed 26/33 (no timeouts or errors). Report:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket16-resize-2/reports/mutation/mutation.json`.
- Replaying the seven survivors against the strengthened keyboard check
  killed five more (31/33 across the run and replay): both arrows resize in
  opposite directions, and unrelated keys leave the panes alone. The two
  remaining mutants remove default-event suppression and the guard against
  pressing a resize key during an active pointer drag. Neither changes
  geometry in the supported single-input gestures; no private-state check
  was added.
- For ticket 17: `SequenceWorkspace` stores the preferred widths by pane ID.
  Keep it mounted, filter the rendered panes/separators rather than replacing
  this state, and preserve hidden entries when resizing the visible subset.
  Derive the visible separators from adjacent visible panes. Visibility
  controls are outside ticket 16.
