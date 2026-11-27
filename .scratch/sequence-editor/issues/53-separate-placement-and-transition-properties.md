# 53 — Separate placement and transition properties

Status: ready-for-agent
Resolution: split the Inspector into placement and transition properties; add or inspect from each edge, and select new fades only after host acceptance.
Depends on: [32](32-show-cut-spanning-dissolves-and-source-extensions.md), [41](41-extract-toolbar-and-inspector-slot-components.md)

## Proposal

Keep one replaceable Inspector slot, with separate Placement Properties and
Transition Properties components. Make direct transition inspection the place
to edit an authored transition. Give each placement edge an explicit way to add
or inspect its transition, so authoring and inspection don't depend on small
timeline targets.

## Acceptance criteria

- The Inspector slot describes an empty state, an inspected placement, or an
  inspected transition. Keep the placement selection summary and chooser.
  Placement Properties shows effective source and sequence ranges, applicable
  trim controls, and an action for each of the start and end edges. It does not
  include editable fields for an existing transition.
- On an occupied edge, **Inspect transition** does the same thing as clicking
  its timeline indicator: highlight that transition, clear the entire placement
  selection, and show only Transition Properties. This is session state and
  emits neither host callback. Read-only and locked tracks still allow
  inspection.
- On an editable empty edge, **Add transition** immediately proposes one
  entry or reveal fade, depending on the edge. Use half a second rounded to
  whole sequence frames, at least one frame and capped at the placement's
  duration. This is a single undoable edit, not a draft. On host acceptance,
  select the new transition. If blocked by a conflict, explain why, emit no
  edit, and keep the placement selection; don't shorten the default to make
  it fit. Read-only or locked edges can't add.
- Transition Properties identifies the owning placement and edge, shows the
  authored kind, and retains applicable resolved details and duration editing.
  Use the existing `PlacementTransition` for fades and dissolves. Pass bounds,
  availability, and named actions from the editing session, not prebuilt
  `fades`/`dissolves` forms, form keys, or disclosure flags. Leave labels and
  form rendering to the Inspector. No additional page slots or sequence
  migration.
- Verify both inspection paths, including navigation out of a multi-selection,
  and Add at both edges through Storybook/Playwright and the host callbacks.
  Verify a pending or rejected proposal does not switch properties views.
   Update the slot examples and the [sequence editor design](../../../docs/sequence-editor-design.md);
   this replaces the placement Inspector's inline transition fields.

## Comments

- Verified through the public Inspector and timeline UI and the controlled host
  callbacks. Both inspection paths clear the whole placement selection without
  proposing an edit. Add covers both edges, exact `CutList` output, Undo,
  project-rate rounding, the one-frame floor, the placement-duration cap,
  pending/rejected and delayed acceptance, and conflict rejection without
  shortening the default. Read-only and locked inspection remain available;
  an occupied fade stays highlighted in Split mode without becoming clickable.
- Seeded authored dissolves in the workflow host to preserve coverage of
  centered windows, source extensions, missing contributions, conflicts on
  resize or move, and the unsupported `CutList` result. Transition Properties
  retains the existing kind-specific duration edits; changing kind or removing
  a transition is outside this ticket.
- `npm test -- --run` passed 247 tests; the one-shot Playwright run passed
  51 tests across the default editor, Inspector, dissolve, fade, lock, trim,
  and composition suites. Two additional checks with Playwright's dark color
  scheme passed. `npm run typecheck`, `npm run lint` (existing `VideoPlayer`
  captions warning), `npm run format:check`, `npm run build`, and
  `git diff --check` passed. Port 6007 was free after verification.
- Seven temporary mutations failed the expected browser assertions: retaining
  placement selection, switching before acceptance, ignoring conflict, omitting
  the cap, omitting the one-frame floor, rounding down, and suppressing the
  highlight for an inert Split-mode fade. Restored the original files and
  verified them byte-for-byte. Logs: `/tmp/opencode/issue53-mutations.6sEWIY`.
