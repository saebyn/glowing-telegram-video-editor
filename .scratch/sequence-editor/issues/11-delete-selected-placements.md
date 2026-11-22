# 11 — Delete selected placements

Status: ready-for-agent
Resolution: implemented in `2077dd8`
Depends on: [02](02-select-and-move-placements-together.md)

## Acceptance criteria

- A visible Delete action removes one selected clip placement or the entire
  selection across tracks in one edit. With no placement selected, there is
  nothing to delete and neither edit callback fires.
- Only the selected placements are removed. The reusable clips stay in the
  clip pool, and other placements of those same clips remain unchanged.
- Leave the resulting gaps in place. Do not shift other placements, remove
  tracks, or shorten the sequence.
- Emit one next sequence and one `CutList` result for the edit when the
  callbacks are supplied. The result can be `null` if deletion leaves an
  uncovered gap or an empty sequence.

## Comments

- Not implemented or verified in this batch: the PRD excludes Delete. Confirm the follow-up scope after placement selection is available.
- Confirmed for the next batch: removing placed clips is a priority. This
  removes placements from the sequence, not clips from the clip pool.
- Implemented on `feat/sequence-editor` without a commit. The toolbar's
  Delete action removes currently selected placement IDs in one proposed
  edit via the existing sequence/compiler callback path. The clip pool,
  surviving placements, track order, and duration are preserved. The
  editor does not clear selection on proposal: if the host accepts the edit,
  selection reflects the remaining placements; if it declines or defers,
  the still-present placements remain selected.
- TDD used only the approved Storybook/Playwright seam: real Chromium
  pointer clicks and the existing host callback recorder.
  1. Red: the no-selection Delete button was not found. Green: add the
     visible disabled action; a real click emits neither callback (1 pass).
  2. Red: Delete stayed disabled after selecting the upper Lighthouse.
     Green: remove that placement only. The expected exact sequence keeps
     the other trimmed Lighthouse and the pool card, and the expected
     `CutList` contains only Harbor source frames `[114, 354)`. The initial
     pool title locator did not match the nested title markup; using the
     existing draggable-card locator verified it before and after (2 pass).
  3. Red: Delete stayed disabled after Shift-clicking a second track.
     Green: remove both selected IDs with one callback pair. The surviving
     placement stays at `[120, 228)` in the 240-frame sequence with all
     three tracks, so the expected `CutList` result is `null` (3 pass).
- Verification: `npm run typecheck`, `npm run lint` (seven pre-existing
  warnings), `npm run format:check`, `npm test -- --run` (88 pass),
  `npm run build`, and `git diff --check` passed. Browser ran on port 6007
  with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` set to
  `/nix/store/54ws4g5cbz5vqwllpvyczbvz2cn4lx85-chromium-158.0.8127.36/bin/chromium`:
  `npm run test:browser -- --workers=1` passed 44/44 before the selection
  cleanup; after it, the shared checkout ran 45 tests and passed 44,
  including all three Delete regressions. The only failure was a concurrent
  new one-frame trailing-trim regression: no timeline status appeared.
  Final focused run, `npm run test:browser -- --workers=1 src/components/organisms/SequenceEditor.delete.browser.ts src/components/organisms/SequenceEditor.group.browser.ts src/components/organisms/SequenceEditor.workflows.browser.ts`,
  passed 11/11. No Timeline changes or blockers for Delete.
- Mutation testing used the snapshot browser helper with
  `MUTATION_CONCURRENCY=3` and the same Chromium:
  `node /tmp/opencode/gtve-ready-mutation.5Yxjq3/run.mjs ticket11-delete-2 browser src/components/organisms/SequenceEditor.delete.browser.ts src/components/organisms/SequenceEditor.tsx:99-108 src/components/organisms/SequenceEditor.tsx:194-201`.
  The first run killed 13/14; its only survivor changed the unnecessary
  immediate selection reset, which was removed to preserve controlled-host
  behavior. The final run killed 13/13 (100%; no survivors, timeouts or
  errors). Report: `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket11-delete-2/reports/mutation/mutation.json`.
