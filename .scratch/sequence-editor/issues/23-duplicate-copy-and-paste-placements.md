# 23 — Duplicate, copy, and paste placements

Resolution: implemented and verified.
Depends on: [02](02-select-and-move-placements-together.md)

## Proposal

Let editors duplicate a placement or group in the current sequence and copy
and paste a selection elsewhere in it.

## Acceptance criteria

- **Copy** snapshots the selection in the editor without editing the
  sequence. Cross-sequence paste and the system clipboard are out of scope.
- **Duplicate** puts the earliest new placement at the end of the last
  selected placement to finish, staying on the original tracks. If the
  whole group doesn't fit there, reject the duplicate rather than moving
  it elsewhere.
- **Paste** aligns the earliest copied placement with the sequence frame
  under the pointer and maps the topmost copied track to the hovered track.
  Paste immediately if the whole group fits there. If there's no track under
  the pointer or the destination is blocked, enter drop mode instead of
  shifting the group to a nearby gap.
- In drop mode, preview the group under the pointer using the same anchors
  and validation. A valid click commits; an invalid click leaves drop mode
  active without editing. Escape cancels without editing.
- Preserve the copied group's relative timing and track spacing, effective
  source ranges, and authored transitions. Reuse the clips but assign new
  placement and transition IDs. Reject destinations that overlap another
  placement on the same track or require a locked or missing destination track.
- Use shared editor actions and host-accepted history. A valid Duplicate or
  Paste commits the entire group and any needed sequence-duration increase as
  one undoable edit. Copy, preview, and cancel emit no edit. Editing is
  unavailable in a read-only editor.

## Comments

- Confirmed that both the paste track and sequence frame come from the
  pointer, not the playhead. Get separate maintainer approval for any public
  interface changes.
- Maintainer approved the optional `SequenceTimelineProps.placementPaste`
  interface: Timeline reports a `{ trackId, sequenceFrame }` target or `null`,
  renders the shared session's drop preview, and confirms the clicked target.
  Copy, Duplicate, Paste, Escape, validation, and host-accepted history stay in
  the shared session. Ctrl/Cmd+C/D/V are editor-scoped, leave text fields alone,
  and do not use the system clipboard.
- Red → green at the callable edit seam: Duplicate's latest selected exclusive
  end, atomic collision rejection, destination lock, and fresh transition IDs;
  Paste's independent frame/track anchors, effective source range after a clip
  retrim, exact blocked preview, collisions between copied members, and a
  shortened source that can no longer fit the snapshot. Added passing checks
  for frame zero, a nonzero source-track anchor, missing destination tracks, and
  invalid sequence frames.
- Red → green in Storybook/Playwright: Duplicate initially emitted no edit;
  immediate Paste initially did not add the placement on the exact hovered track
  and frame; a blocked Paste initially rendered no proposed placement. Each
  passed after wiring the corresponding action. Additional real-gesture checks
  covered a locked click and Escape, a stationary pointer during pan, read-only,
  host acceptance/replacement, and a focused source trim input.
- Verified `npm test -- --run --project unit` (161 passed, including 12 for
  placement copies) and `npm run test:browser -- placementCopies splitMode
  viewport keyboard` (23 passed, including eight for placement copies) with the
  local Nix Chromium executable and a hard timeout. Port 6007 was closed
  afterward. `npm run typecheck`, `npm run format:check`, and `git diff --check`
  passed; `npm run lint` passed with the existing `VideoPlayer` caption warning.
- The targeted browser suite caught six seeded faults, all restored before
  verification: using sequence frame 0 from the playhead instead of the
  pointer's frame 40, leaving a stale target after pan, ending drop mode on an
  invalid click, not clearing drop mode on Escape, retaining the clipboard
  after host replacement, and processing shortcuts in the source trim input.
- The initial isolated Stryker sweep killed 147 of 233 pure-rule mutants
  (86 survived, no timeouts). Its survivors prompted the valid preview,
  nonzero anchor, missing-track, and invalid-coordinate checks above. The
  follow-up killed 161 of 233 (72 survived, no timeouts). Remaining
  survivors include defensive handling for missing clips or changed source
  metadata and variants that only change whether zero trim offsets are
  explicit. Report: `/tmp/opencode/sequence-stryker.8r2aDwWH/clipboard/reports/mutation/mutation.json`.
