# 01 — Preview and move one placement

Status: ready-for-agent
Resolution: implemented in `dc35b6b`
Depends on: None

## Acceptance criteria

- Dragging one placement previews its exact proposed position and destination track, with a sequence position readout for the grabbed placement. The scale stays steady, and a destination to the right of the old endpoint is reachable before release.
- An invalid destination explains why it is blocked. Same-track overlap, a negative sequence position, or release outside the tracks does not move the placement or change duration. Touching edges and overlap across tracks remain legal.
- A valid move past the endpoint extends duration exactly to the new exclusive end. Moving back earlier leaves a trailing gap. Source range, placement identity, and entry/reveal transitions stay intact.
- The preview and drop use the same rules. A valid change emits one next sequence and one compiler result; preview, invalid, unchanged, and cancelled drags emit neither.

## Comments

- Implemented with one evaluator for the move preview and release. The timeline pans
  into temporary space without rescaling during a drag. A move grows the authored
  duration only on a valid release; rejected, unchanged, and cancelled moves emit
  neither host callback.
- Observed red → green, one behavior at a time:
  1. Vitest returned `null` for frame 107. It now returns a sequence ending at 132
     with the same placement ID, effective source range, and both fades.
  2. Playwright found no destination readout on a cross-track drag. It now shows the
     placement on Cutaways at frame 60 before release, with neither callback; release
     emits the expected sequence and exact non-null `CutList`.
  3. The occupied Main-track preview showed a frame but no rejection reason. The
     evaluator now supplies a reason for the preview and blocks the same release.
  4. Holding the pointer at the right edge did not scroll. It now reaches frame 375
     at the original scale and duration (372); release emits one sequence ending at
     495 and one `null` compiler result.
  5. Escape left the preview visible. It now clears the preview and release has no
     effect on the edit or placement selection.
  6. Resizing left a preview on the old frame grid. Resize now cancels the gesture
     and release emits neither callback.
- Verified with Node 24 and local Nix Chromium: `npm test -- --run
  src/utils/sequence.move.test.ts src/utils/sequence.test.ts` (14 passed) and
  `npm run test:browser -- SequenceEditor.move.browser.ts` with
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` set to the local Nix Chromium executable
  (5 passed, default Storybook port 6007).
  `npm run typecheck`, `npm run format:check`, and `git diff --check` passed;
  `npm run lint` reported only existing warnings outside ticket 01.
- The five move cases also passed on a static Storybook build in both light and
  dark Chromium color schemes.
- Stryker against the move-rule lines, through focused Vitest and real browser
  gestures: 84 killed, 20 survived, 0 timeouts (104 total). The survivors include
  missing/invalid inputs and origin rows containing multiple placements.
  Report: `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket01-rules/reports/mutation/mutation.json`.
- A separate Stryker pass on the timeline gesture and scroll adapter killed
  109 mutants; 100 survived and 7 timed out (216 total). The survivor count
  includes ruler formatting, pointer-cancellation paths not exercised by
  mouse gestures, and edge panning not used in the tested direction.
  Report: `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket01-gesture/reports/mutation/mutation.json`.
- Integration follow-up, red → green: on **Assemble a rough cut**, a viewport
  just tall enough for the idle editor (with classic Chromium scrollbars enabled)
  lost the frame-120 move readout while the pointer was still down. Rendering drag
  feedback pushed the page into vertical overflow and triggered the genuine resize
  cancellation. Move, group companion, and trim readouts now share a reserved,
  wrapping, scrollable footer that does not change the editor height. The new
  `SequenceEditor.layout.browser.ts` passes on port 6021: frame 120 remains
  visible with no preview emission, then release emits exactly one sequence
   change and one compiler result. Actual resize cancellation is unchanged.
- Targeted layout mutation: removing the footer's reserved height reproduced
  the missing frame-120 feedback in both light and dark Chromium against
  static Storybook. The unmutated layout passed.
- Collision coverage follow-up: a move to frame 69 is blocked by a different
  clip placement covering `[10, 70)` on the destination track. Vitest failed
  against the exact isolated Stryker mutant that uses the first clip's duration
  for that stationary placement: it incorrectly reported a valid move.
  The unmutated move and compiler suites passed (18 tests), with no change to
  the edit evaluator. Re-running Stryker on the same collision and growth lines
  killed 18 mutants, with 4 survivors and no timeouts (previously 17 killed,
  5 survived).
- Browser regression, red → green: on **Rearrange a layered edit**, scrolling
  down one track height after previewing a blocked Lighthouse move to Main at
  frame 60 left the same blocked readout but committed a move on Alternate.
  Release now cancels if the frame or track differs from the last preview.
  The regression checks the exact blocked readout and neither host callback.
- Browser regression, red → green: grabbing the far end of the full-width
  Harbor placement limited its proposed start to frame 240, the old endpoint.
  Allowing one extra ruler tick just for placement moves keeps the original
  scale and lets the gesture preview frame 241. No callback fires before
  release; release emits one sequence ending at 481 and one `null` compiler
  result.
- Integrated browser check under heavy parallel load: the far-end test was
  still panning at frame 193 when the default five-second poll expired. The
  poll now allows up to 12 seconds for animation-frame-driven panning and
  still requires the same destination and callbacks. The updated test passed
  twice on static Storybook; no production change.
- The frozen ticket 01 snapshot passed 24 Playwright cases across move,
  group move, layout, pool drop, and trim on static Storybook. The working tree's
  extra one-frame trim test remained red while ticket 08 was in progress.
  Vitest passed all 88 tests; type checking and formatting passed, and lint
  reported only existing warnings.
- Stryker on the changed gesture lines: 20 killed, 8 survived, no timeouts.
  The browser checks killed the mutants that ignore a changed destination
  track or remove the extra scroll headroom. Removing only the same-track
  frame comparison survived; the page-scroll case changes the track, not the
  frame. The other survivors affect the exact edge/cap, widget lifetime, or
  release without a draft or after a resize. Report:
  `/tmp/opencode/gtve-ticket01-final.gnG16c/reports/mutation/mutation.json`.
  Report: `/tmp/opencode/gtve-ready-mutation.5Yxjq3/recheck-01-02-move-baseline/reports/mutation/mutation.json`
  (baseline) and the follow-up run noted below.
- The page-scroll regression now aligns the grabbed placement just inside
  the viewport, leaving room for a full row of wheel scrolling even with
  the taller tracks and zoom controls. The exact blocked preview and
  no-edit assertions passed in integrated light and dark Chromium.
