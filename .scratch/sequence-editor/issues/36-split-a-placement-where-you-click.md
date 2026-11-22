# 36 — Split a placement where you click

Status: ready-for-agent
Depends on: [35](35-split-all-placements-at-the-playhead.md)

Add a separate Split mode for cutting on the sequence timeline without
first placing the playhead or selecting a placement.

## Proposed acceptance criteria

- Provide a visible toggle and active indication. The mode stays active
  after a cut until toggled off or dismissed with Escape. Entering or
  leaving Split mode does not edit the sequence.
- While active, use the sequence frame at the pointer rather than the
  playhead. Split only the clicked placement, without requiring it to be
  selected. Use the same source alignment and eligibility rules as the
  toolbar action. Clicking empty space or a placement edge does not split
  anything.
- One click commits one edit that can be undone. It does not seek or
  select the clicked placement. When Split mode is off, timeline clicks
  keep their existing behavior.
- While active, placement gestures do not start a move or trim; clicking
  empty track space does nothing. Ruler seeking, playhead dragging, pan,
  and zoom still work.

## Comments

- Separate from [35](35-split-all-placements-at-the-playhead.md), which
  splits placements across tracks at the playhead.
- Design review: click-to-split is a persistent tool mode, not a seek or
  selection gesture.
