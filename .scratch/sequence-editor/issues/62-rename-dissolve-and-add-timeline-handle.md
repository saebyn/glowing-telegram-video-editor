# 62 — Call it Dissolve and add a timeline resize handle

Status: needs-triage

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
- Verify with a real pointer drag that the window previews and commits at
  the expected frames, Undo restores the old duration, and a drag that
  would conflict with another transition is rejected.
