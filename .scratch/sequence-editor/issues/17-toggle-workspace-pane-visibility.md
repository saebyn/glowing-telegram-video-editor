# 17 — Toggle workspace pane visibility

Status: ready-for-agent
Resolution: implemented in `2077dd8`

## Proposal

Add independent toolbar controls to show or hide the Clip pool, Preview,
Inspector, and sequence timeline. Let visible panes use the freed space.
Keep the controls reachable even when the timeline is hidden. Hiding a pane
does not change the authored sequence or clear placement selection; when a pane
is shown again, restore its previous size if it was resized.

Visibility is session-only for the first pass. Coordinate layout changes
with [16](16-resize-workspace-panes.md), but the toggles do not require
resizing to ship.

## Comments

- The first browser test reached the committed trim in **Assemble a rough cut**
  on an isolated static Storybook baseline, then failed because the Inspector
  toggle did not exist. The standalone toggle group is ready for integration
  after #16 freezes the workspace. Keep preferred widths keyed by pane and
  separate from visible columns so a resize cannot discard a hidden pane’s
  preferred width. Keep selection and transport in the editor, and put the
  toggles in the always-rendered toolbar, outside the timeline.
- Integrated all four independent toggles with #16’s layout. Visible panes
  fill the workspace, and resizing a visible pair does not overwrite a
  hidden pane’s preferred width. Timeline visibility leaves the sequence
  playhead and placement selection intact. No pane toggle emits host edits.
- Verified the four visibility cases and all three resize regressions in the
  existing rough-cut Storybook workflow in both light and dark (14 passed).
  Type-checking, formatting, and `git diff --check` passed. Lint reported only
  existing warnings outside the changed files.
- Isolated browser mutations were caught for incomplete single-pane fill,
  discarded hidden-pane width, cleared selection, and spurious host callbacks
  (4/4).
