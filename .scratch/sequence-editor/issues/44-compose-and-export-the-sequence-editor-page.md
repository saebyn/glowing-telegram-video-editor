# 44 — Compose and export `SequenceEditorPage`

Resolution: exported the default page, five slots, hook, and reusable controls
Depends on: [43](43-finish-the-timeline-slot-interface.md)

## Proposal

Make the default editor a thin `SequenceEditorPage` under `components/pages`,
analogous to `VideoSelectionPage`. Expose the shared hook and components so a
host can use the default page or assemble its own.

See [Component tree](../../../docs/sequence-editor-design.md#component-tree).

## Acceptance criteria

- Rename the unpublished `SequenceEditor` and its props without an alias.
  Update package exports, README usage, Storybook, and test entry points
  together. Expose all five typed slots in the same public surface:
  `toolbar`, `clipPool`, `preview`, `inspector`, and `timeline`. An
  unspecified slot uses its default; `null` omits it and its toggle.
- Export `useSequenceEditor`, the five defaults, `SequenceWorkspace`, and
  all library-owned components in the editor tree and their props, including
  pane toggles and individual controls. Defaults are usable from supplied
  props without a session provider. Public exports do not add sub-slots or
  leak Keplar types, host edit internals, or history and validation helpers.
- `SequenceWorkspace` accepts rendered Clip Pool, Preview, and Inspector
  nodes, preserves accessible resizing and responsive stacking, and has no
  dependency on the hook. There is no page-level layout slot or controlled
  layout API.
- Hiding a configured pane unmounts it and cancels any drag involving it
  without committing. Preferred widths, selection, and transport survive;
  component-local state such as zoom can reset. Preview omission or hiding
  does not stop playback. An Inspector height cap stays out of scope.
- Both existing default Storybook workflows still work. Exercise an omitted
  slot and a hidden configured pane and check that neither emits an edit.

## Comments

- Exercise hiding a configured pane during a drag, not only while idle.
  A release after cancellation must emit neither host callback.
- Verify the package build and its emitted declarations as well as the
  Storybook workflows; the new components and props must be importable from
  the package root.
- The omitted-Preview test first found the default pane still present.
  Omission now removes both the pane and toggle without stopping transport.
  Hiding the Clip Pool during a real native gesture clears the preview and
  makes release inert. Undo retains focus so Escape still exits Split mode.
- Package and Storybook builds, TypeScript, formatting, lint (existing
  warnings), 127 Vitest tests, 130 Playwright tests, and ten dark-mode cases
  passed. An isolated consumer imported the runtime exports and checked the
  declarations using the repository's bundler resolution. NodeNext still
  rejects extensionless declaration imports, a pre-existing packaging limit.
- Four targeted browser mutations were killed (rendering an omitted pane,
  leaving its toggle, retaining a hidden pool's drag, and losing Undo focus).
  Verification used the committed test configuration in an isolated copy.
