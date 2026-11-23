# 04 — Drop from the clip pool past the endpoint

Resolution: implemented in `dc35b6b`
Depends on: [01](01-preview-and-move-one-placement.md) for reaching beyond the authored endpoint

## Acceptance criteria

- A clip can be dropped from the pool onto an existing destination track where the resulting placement extends beyond the old endpoint, including a destination past that endpoint.
- The new placement uses the reusable clip's current source range. The new placement and duration increase appear in one committed edit, with duration growing only as far as needed.
- Extending duration does not permit a same-track collision. An invalid drop changes nothing; a clip that fits in an existing gap can still be placed without growing the sequence.

## Comments

- Initial Stryker pass over the pool-drop evaluator, using focused Vitest and
  native Storybook drag tests: 54 killed, 13 survived, no timeouts (67 total).
  Report: `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket04-rules/reports/mutation/mutation.json`.
- Observed red → green at the agreed seams:
  1. Vitest initially returned `null` for a drop at frame 107; it now preserves
     the existing trimmed placement and adds a 20-frame placement, growing to 127.
  2. The native drop at frame 225 on Cutaways initially emitted nothing. It now
     grows to 345 and emits exactly one sequence and the exact Harbor
     `[114, 339)` / Lighthouse `[501, 621)` `CutList`, with no edit before release.
  3. Holding the native drag near the right edge initially did not pan. It now
     exposes frame 270 without changing the scale or authored duration. Releasing
     on Alternate grows to 390 and emits one sequence and a `null` `CutList`.
- Regression coverage rejects a drop at Alternate frame 180 and still backfits
  the bounded gap drop to frame 120 without growth. Added the Stryker follow-up
  at the evaluator seam: placement offsets leave a 19-frame gap and a 20-frame
  clip is rejected instead of backing into the preceding placement.
- Native drops retain the existing clip pool JSON contract: dragover sees
  `application/json`, and drop requires an array with exactly one known clip ID.
  It is not an origin marker for external drags.
- Focused checks passed: 20 Vitest cases across the drop, move, and compiler files;
  9 Chromium cases across the drop and move browser files on Storybook port 6014.
  The four native pool-drop cases also passed on a static Storybook build in
  both light and dark Chromium color schemes.
- Follow-up Stryker run including the bounded-gap case and native drop adapter:
  88 killed, 52 survived, no timeouts (140 total). Survivors include malformed
  payloads, cancelled external drags, and invalid model inputs. Report:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket04-final/reports/mutation/mutation.json`.
- Follow-up: native pool hover now shows the fitted placement on its target track,
  using the same edit rule as release. The preview follows horizontal panning,
  shows blocked destinations, and clears on exit without emitting an edit.
  Browser tests reproduced the missing fitted and blocked previews before the
  fix and verify the exact frame, track, and callbacks on release.
- The 18 targeted browser cases passed in both Chromium color schemes.
  Initial follow-up Stryker on the preview and shared edit rule: 27 killed,
  12 survived, no timeouts. Added focused check for a legal edge touch and
  the precise short-gap proposal. Survivors included visual-only blocked
  styling and native event guards. Report:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/followup-pool-preview/reports/mutation/mutation.json`.
- Full follow-up: 41 Playwright tests passed on the dev server with one worker.
  An earlier two-worker run timed out waiting for the unrelated Storybook
  Controls playhead fixture to load; that case passed on the full rerun.
- The focused pool-boundary mutation rerun killed 9 of 10 mutants, with
  no timeouts. Report:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/followup-pool-bounds/reports/mutation/mutation.json`.
- Recheck on `feat/sequence-editor`: the existing-gap drop and all five
  pool-drop-specific cases passed in the 41-test static Storybook/Chromium
  suite. No pool-drop blocker found.
- A later repeated Chromium check reproduced an intermittent right-edge
  release failure: the correct frame-270 preview appeared, but the browser
  sent `dragend` without `drop` in 3 of 5 runs while the grid was scrolling.
  Keeping track rows hit-testable only during the native pool gesture
  passed 8 of 8 runs on an isolated static Storybook build. The release
  requirement and native gesture were unchanged; `dragend` still cannot
  commit an edit.
- Manual CSS mutation: removing only the `[data-pool-dragging]` row
  hit-testing rule from that same static bundle, with the attribute and
  native test unchanged, reproduced missing sequence and `CutList`
  callbacks in 2 of 5 Chromium runs. The untouched bundle passed all 3
  replays. Logs: `/tmp/opencode/gtve-ticket04-css-mutant.IfAttP/mutant.log`
  and `/tmp/opencode/gtve-ticket04-css-mutant.IfAttP/good.log`.
