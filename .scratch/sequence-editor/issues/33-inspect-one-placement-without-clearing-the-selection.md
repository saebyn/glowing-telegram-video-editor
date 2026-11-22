# 33 — Inspect one placement without clearing the selection

Status: ready-for-agent
Resolution: implemented and verified in Storybook

[02](02-select-and-move-placements-together.md) deliberately shows only a
summary for multiple selected placements. Let an editor check or adjust one
member and then move the same selection without rebuilding it.

## Proposed acceptance criteria

- Keep the selection count and make it clear which selected placement the
  Inspector is showing. Let the editor switch that target without adding
  or removing members. If it leaves the selection, never show stale fields
  for it.
- Show the target's source and sequence ranges and apply the existing
  single-placement Inspector trim and fade controls only to that
  placement. Changing the Inspector target is not an edit.
- A normal timeline click still selects one placement and Shift-click still
  toggles membership. Group drag, nudge, and Delete keep their
  existing selection behavior. No bulk Inspector controls.

## Comments

- Inspired by the [focused-placement clarification in Streamosaic #219](https://github.com/saebyn/streamosaic/issues/219#issuecomment-6952887207).
  Split scope is a separate change in
  [35](35-split-all-placements-at-the-playhead.md).
- **Inspect placement** shows the clip, track and sequence frame. Repeated
  track labels get track numbers for disambiguation. Switching is session
  state; it does not change membership, emit either edit callback, or
  create an Undo entry. If the target leaves the selection, the Inspector
  switches to a remaining placement without reviving the old target on re-add.
- Playwright red → green covered switching, the stale-target fallback, and
  duplicate labels. Four targeted mutations were caught: collapsing the
  selection on a switch, reviving a stale target, and sending trim or fade
  edits to the wrong placement. The #37-based suite passed 96/96, and the
  combined #30–31 Inspector, group, and fade run passed 26/26. Logs:
  `/tmp/opencode/gtve-ticket33-delivery.LAc5wn/evidence/handoff.md`.
