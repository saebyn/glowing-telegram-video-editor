# 62 — Call it Dissolve and add a timeline resize handle

Status: ready-for-agent
Resolution: implemented and verified in default and replacement Timelines.

## Proposal

Call the transition **Dissolve**, not **Centered dissolve**. The transition
still spans the cut; only its name changes. Give it a timeline handle so
editors can adjust its duration directly, just as they can for a
[Fade](05-adjust-fades-on-the-timeline.md).

## Acceptance criteria

- Use **Dissolve** in the Inspector and timeline, including tooltips and
  accessible labels. Update user-facing messages, help text, and the
  [glossary](../../../GLOSSARY.md) to match. Keep the saved transition
  type unchanged.
- Drag a separate resize handle to preview the dissolve's new duration in
  whole sequence frames. The window stays centered on the same cut using
  the existing odd-frame and sequence-boundary rules. Clicking the
  transition body still selects it; resizing does not move or trim either
  placement or change the sequence duration.
- Use the same validation as the Inspector. A valid release commits one
  undoable duration edit, preserving the transition ID and owning edge.
  Invalid or canceled drags leave the dissolve unchanged. Respect track
  locks, read-only state, and Split mode. `CutList` support is unchanged.
- Replace the public Timeline slot’s fade-only `previewFade` / `editFade`
  callbacks with one optional `previewTransitionResize` / `resizeTransition`
  pair for both Fade and Dissolve. Both receive `{ transitionId, durationFrames }`.
  Look up the existing transition by ID and revalidate against current state on
  release. A resize cannot create, remove, or change a transition’s type.
  Update in-repo callers and examples without a compatibility shim.
- Verify with a real pointer drag that the window previews and commits at
  the expected frames, Undo restores the old duration, and a drag that
  would conflict with another transition is rejected. Keep the existing fade
  resize behavior and verify the shared interface in both the default editor
  and custom slot composition.

## Comments

- The timeline body already says “Dissolve”; the Inspector, timeline tooltip
  and accessible label, export messages, and glossary still need the rename.
  Reuse the Inspector’s transition edit rules and the existing dissolve-window
  calculation. The fade handle caps duration at the placement length, but
  dissolves have no such cap.
- Maintainer approved replacing the fade-only interface with a shared
  transition resize interface, not adding a separate pair for Dissolve.
- Red → green: the Inspector gesture test first could not find “Select
  dissolve: Lighthouse,” then passed with the revised labels and export
  notice. The resize-by-ID Vitest first failed because the callable entry
  point did not exist, then passed a 7 → 31 frame resize on a 24-frame
  placement. The default Timeline Playwright test first could not find an
  “Adjust dissolve” grip, then passed the [117, 124) → [113, 128) preview,
  one sequence proposal and `unsupported-dissolve` result on release, and
  one-step Undo. The custom Timeline example first did not render; it now
  previews and commits both kinds through the approved callback pair. The
  boundary test first previewed [235, 238) instead of [227, 240); using the
  left grip when the right edge is clipped made it pass, including Escape
  cancellation. Browser regressions cover conflict rejection, track locks,
  read-only mode, Split mode, and the existing Fade `CutList`.
- Manual mutation tests in a temporary copy rejected one-sided duration
  deltas ([115, 126) instead of [113, 128)), ignoring a stale ID (edited the
  replacement), skipping dissolve competition checks (previewed 23 frames
  rather than reporting the conflict), ignoring Escape (draft window stuck),
  treating a dissolve resize as Fade (wrong 24-frame duration cap), and
  enforcing the conflict in preview but still committing it on release
  (the Inspector changed to 23 rather than retaining 7).
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` used Nix Chromium 158; the bundled
  Linux Chromium could not launch on NixOS. `npm test -- --run` passed
  218 tests across 48 files, including the Storybook and unit projects.
  `npm run test:browser -- --workers=2` passed all 177 tests; the one-shot
  Storybook server stopped and port 6007 was clear. Typecheck, format check,
  relative documentation links, and `git diff --check` passed; lint passed
  with the existing captions warning in `VideoPlayer.tsx`. No production
  build was run for this ticket while #63 owned the package build.
- Follow-up review caught a custom Timeline that retained its release
  callback at pointerdown. A real pointer test with a host-applied lock
  between press and release emitted an invalid edit before the fix
  (negative control), and now emits neither host callback. The combined
  production build passed. Light and dark Chromium smoke checks passed on
  static Storybook; Stryker killed 19/20 mutants in the resize-by-ID edit
  path (the survivor skips a redundant early return for an undefined ID).
