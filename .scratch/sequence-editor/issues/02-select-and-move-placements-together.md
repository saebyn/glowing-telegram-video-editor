# 02 — Select and move placements together

Status: ready-for-agent
Resolution: implemented in `dc35b6b`
Depends on: [01](01-preview-and-move-one-placement.md)

## Acceptance criteria

- Click selects one placement; Shift-click toggles a placement across tracks. Empty track space clears selection. Ruler seeking is handled separately by the playhead interaction.
- Dragging a selected placement previews every member at its proposed destination. Dragging an unselected placement moves only that placement. Multiple selection shows a count and tracks in the Inspector rather than bulk edit controls.
- All moving placements keep their relative sequence positions, track spacing, source ranges, and transitions. Check collisions with stationary placements after vacating the moving placements' old positions.
- If any member cannot land, none moves and duration does not change, even if another member goes past the old endpoint. Otherwise one release commits all members and any duration growth together, with one sequence change and one compiler result.

## Comments

- Implemented transient placement selection and a multi-selection Inspector summary.
  Dragging a selected placement proposes one group move; an unselected placement
  moves alone without replacing the selection. Empty widget rows clear selection;
  the ruler does not.
- One evaluator projects all destinations and checks them against the stationary
  layout before committing. The preview marks the blocked group and identifies the
  conflicting track. A companion readout names every proposed track and exact
  sequence frame, including offscreen and outside-track destinations, without
  changing the grabbed status or the drag scale.
- Observed red → green for moving into another member's vacated position, rejecting
  a non-grabbed member that would start at −1, cross-track Shift selection and
  Inspector changes, and the collision on Cutaways instead of Main. The companion
  readout also failed before it was added, including when the grabbed destination
  itself was outside the rows.
- The layered Storybook fixture verifies that the frame-150 drop previews both
  placements but emits neither callback, and the exact edge touch at frame 180
  emits one sequence ending at frame 300 and one `CutList`: Lighthouse
  `[501, 561)` → Harbor `[114, 354)`. Existing single-move stories and tests remain
  in place for ticket 07.
- Verified with Vitest (17 move/compiler tests) and Storybook/Playwright on 6007
  with the local Chromium (10 group/single-move tests). Typecheck and
  `git diff --check` passed; lint reported only existing warnings outside the
  sequence editor. The group scenarios also passed on a static Storybook
  build in both light and dark Chromium color schemes.
- Stryker mutated the group move evaluator and Editor selection handler using
  focused Vitest and group gestures: 91 killed, 30 survived, no timeouts
  (121 total). Survivors include defensive invalid-input checks and alternate
  ordering of a successful same-track move. Report:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket02-current/reports/mutation/mutation.json`.
- Targeted Stryker pass on the Timeline proposal readout: 34 killed, 10
  survived, no timeouts (44 total). Some survivors are redundant fallback
  paths or affect placements that cannot be rendered. Report:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket02-preview/reports/mutation/mutation.json`.
- Rechecked on `feat/sequence-editor` after ticket 01's move suite: all five
  `SequenceEditor.group.browser.ts` cases passed in Chromium. No blocker for
  the placement selection used by ticket 11.
