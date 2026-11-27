# 15 — Name and rename tracks

Resolution: implemented in `2077dd8`

## Proposal

Let editors give a track a display name and change it later. Save the name
with the host-owned sequence using the existing track label. Renaming must
not change track identity, order, placements, duration, or compiled content.
An existing track can be renamed independently of adding and removing tracks.

## Comments

- Shared Editor integration: the three rename Playwright cases passed with
  the media-kind, resize, and visibility cases on static Storybook (14/14).

- Triage: rename existing tracks without waiting for track creation or
  removal. Treat the label as an authored edit; cancelling or submitting the
  same name does not commit.
- The standalone `RenameSequenceTrack` control sits next to the sequence
  timeline. Open its dialog, choose an existing track, and save explicitly.
  The dialog does not move timeline labels while drafting. Integrate the
  control only when `onSequenceChange` is supplied and use the shared
  `commitEdit` path so the host remains authoritative and Undo treats the
  rename as one edit.
- TDD: the layered Storybook workflow failed first for the missing Rename
  track control, then for callbacks on an unchanged submission, then for
  the missing Cancel button. All three browser tests pass in a private
  Storybook build with the Editor mount (port 6045, local Chromium). They
  check real mouse and keyboard gestures, unchanged label geometry during
  drafting, the full next sequence and exact unchanged `CutList` on save,
  and no callbacks on Cancel, Escape, or an unchanged Enter submission.
  Typecheck, all 113 Vitest tests, and focused lint/format passed; the narrow
  dialog was checked in light and dark modes. Shared Editor mount is
  coordinated separately.
- Mutation check: the browser spec killed all seven targeted regressions
  in a private copy: renaming the wrong track, dropping its placements,
  changing duration, replacing the compiled result with `null`, committing
  an unchanged name, submitting on Cancel, and restoring a discarded draft
  on reopen. See `/tmp/opencode/sequence-rename-15-mutation-summary.log`.
