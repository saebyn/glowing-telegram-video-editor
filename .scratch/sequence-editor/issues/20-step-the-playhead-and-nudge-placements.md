# 20 — Step the playhead and nudge placements

Status: ready-for-agent
Resolution: implemented in `2077dd8`
Depends on: [06](06-control-the-playhead-without-media.md) for stepping; [02](02-select-and-move-placements-together.md) for nudging

## Proposal

- Step the sequence playhead forward or backward by one sequence frame
  without seeking outside the sequence or emitting an edit.
- Nudge selected placements earlier or later by one sequence frame. Reuse
  group move rules so spacing is preserved, a blocked nudge changes nothing,
  and a valid nudge commits once, growing the sequence only if needed.
- Use distinct keyboard commands for navigation and editing. They should not
  intercept typing or native input controls in the Inspector.

## Comments

- Reproduced both missing shortcuts in Chromium on port 6020: Right Arrow
  stayed at sequence frame 0, and `]` did not emit either host callback.
  The isolated implementation passes both checks. Brackets nudge the entire
  placement selection via the group move evaluator; the browser test also
  verifies that a collision blocks an otherwise extending edit and that
  moving back does not shorten the sequence.
- Confirmed the Inspector focus regression by omitting the native-input
  guard: Right Arrow stepped from frame 0 to 1 while the numeric field had
  focus. Restoring the guard preserves the input's native Up Arrow increment
  and leaves the playhead and edit callbacks unchanged. Shortcuts also do
  nothing outside the editor. All four cases passed in the isolated Storybook.
- In the combined editor, dropping the already-handled-event guard resized a
  focused workspace separator and also stepped the playhead. The fifth browser
  case now verifies the separator resizes without stepping or editing. All five
  tests passed in the shared tree on port 6020, as did typecheck, directed lint
  and formatting, and `git diff --check`. The same five tests passed using
  Chromium's dark color scheme on port 6040. The move evaluator's nine unit
  tests passed, as did the 14 existing group-move, playhead, and resize browser
  tests. No Timeline changes.
- The final isolated Stryker run killed 64 of 66 keyboard-handler mutants,
  with no timeouts. The two survivors remove `preventDefault()` from the step
  or nudge command; the workflow fixtures have no conflicting browser default
  action that the tests can observe. Report:
  `/tmp/opencode/sequence-ticket-20-integrated.kHxKdcGx/reports/mutation/mutation.json`.
