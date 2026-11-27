# 112 — Apply edit intents to the current working sequence

Status: ready-for-agent
Review priority: P1
Depends on: [111](111-own-the-working-sequence-and-history.md)
Design: [Action intent and history](../../../docs/sequence-editor-design.md#action-intent-and-history).

## Problem

An interaction may retain a callback while another local edit commits. Some
slot handlers still apply edits to the sequence they closed over, so a
retained action can undo unrelated work or bypass a newly applicable rule.

## Acceptance criteria

- Built-in and host-provided UI capture draft values and target IDs, not an
  edited sequence. The session applies named edit actions against its current
  working sequence and inputs. An earlier preview or enabled control is not
  permission to commit a now-invalid action. Keep edit rules and notifications
  in the session rather than in slot UI.
- Open Rename for track A, change selection or edit another track, then
  submit. `renameTrack(trackId, label)` looks up A by ID, preserves the
  intervening edit, and does not retarget the rename. Missing A or an unchanged
  label emits nothing. If Undo restored A, its ID still identifies it. No
  cross-session ID tracking or generic command interface.
- Carry forward [#95](95-revalidate-retained-track-actions.md): retained
  `removeTrack(trackId)` cannot delete a now-populated or missing track.
  Replace `toggleTrackLock` with `setTrackLocked(trackId, locked)` in the
  Timeline slot interface, defaults, stories, and all callers. A retained
  **Lock track** action against an already locked track is a no-op, not an
  unlock. A real Remove or Lock change preserves unrelated edits and notifies
  once through each supplied listener. No compatibility alias.
- Audit the other edit actions exposed through the Toolbar, Inspector,
  Timeline, and shortcuts for stale-sequence use. Preserve the regressions
  from [#68](68-revalidate-retained-timeline-actions.md) and
  [#83](83-revalidate-remaining-timeline-actions.md), using intervening local
  edits where the fixtures used host replacement. Keep paste confirmation
  single-use and inactive after cancellation. No gesture or touch redesign.
- Verify retained actions through a replacement slot, including a newly
  populated track, a repeated request for the same lock state, and a valid
  action that preserves an intervening edit. Blocked or unchanged actions
  emit no edit callbacks.
