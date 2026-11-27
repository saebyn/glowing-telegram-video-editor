# 54 — Change transition type and duration, or remove it

Status: ready-for-agent
Resolution: apply transition type and duration atomically, and remove the transition in one host-acknowledged edit.
Depends on: [53](53-separate-placement-and-transition-properties.md)

## Proposal

Give Transition Properties one **Type** selector, one **Duration** field, and
an explicit **Remove transition** action. Fade and centered dissolve are kinds
of the same authored transition, not separate forms or separate objects on an
edge.

## Acceptance criteria

- **Apply** submits the chosen type and duration together as one named edit.
  Switching in either direction keeps the transition ID and owning edge. A
  valid edit leaves placement positions, trims, and sequence duration
  unchanged, preserves transition selection, and refreshes the resolved
  details for the chosen kind.
- Use one shared placement-edge type and one kind-neutral transition edit
  intent for fades and dissolves. Route Add, Apply, and the existing timeline
  fade resize through the same validation for setting a transition. The
  timeline gesture can stay fade-specific; kind-specific bounds belong in
  the shared evaluator, not in separate edit paths.
- Replace `PlacementFadeField` and `ResolvedFade` with kind-neutral types
  wherever they already represent both kinds. Resolved transition data may
  carry derived details such as windows and coverage, but reuse the authored
  `PlacementTransition` fields instead of redefining kind or duration.
  Keep the persisted sequence shape unchanged.
- Duration is positive whole sequence frames. Changing the draft type doesn't
  silently change the draft duration. Revalidate using the proposed kind and
  duration together: e.g. a 40-frame dissolve on a 24-frame placement can't
  become a 40-frame fade, but can become a 24-frame fade in one Apply. Report
  invalid bounds or conflicts without mutating the authored transition,
  emitting callbacks, or creating a history step.
- **Remove transition** clears only that edge's authored transition and is
  one undoable edit. Once the host accepts it, select just the owning placement
  so the empty edge offers **Add transition** again. Undo restores the same
  transition ID, kind, and duration without changing the current selection.
  Zero is not a substitute for removal.
- Revalidate locks and conflicts in the editing session. Locked or read-only
  transitions remain inspectable but cannot be edited or removed. For each
  valid edit, send one sequence proposal and one `CutList` result; a valid
  conversion to a dissolve can succeed as an edit even when `CutList` can't
  represent it. No new export format or timeline gestures in this ticket.
- Verify frame bounds and competition at the same cut or over visible frames
  through the edit evaluator. Use Storybook/Playwright to verify atomic
  conversion, blocked Apply, removal, Undo, and host-observable results.

## Comments

- A single evaluator now serves Add, Apply, and timeline fade resizing. Authored
  fields and the owner edge carry through resolution. Same-cut checks remain
  independent of overlap, and a partly covered fade competes with a dissolve
  only over the fade's visible frames. An unrelated malformed transition no
  longer suppresses conflicts in a resolvable layout.
- Browser checks exercised conversion in both directions without changing the
  placement or transition identity, blocking a 40-frame fade on a 24-frame
  placement, rejected and accepted removal, Undo, and the exact host callback
  results. The evaluator and UI also cover lock, read-only, and duration rules.
- Verified with 199 Vitest tests, 53 targeted Playwright tests and two
  additional dark-mode Playwright checks, typecheck, formatting, lint (existing
  `VideoPlayer` captions warning), build, and `git diff --check`. Port 6007
  was free after verification.
- Eight temporary mutations failed their intended assertions: validating the
  old kind, replacing the transition ID, removing on a locked track, ignoring
  same-cut and visible-overlap conflicts, switching selection before removal
  acceptance, resetting typed duration on type change, and rendering controls
  on a locked standalone Inspector. Mutation logs: `/tmp/opencode/issue54-mutations.VPRSJH`.
