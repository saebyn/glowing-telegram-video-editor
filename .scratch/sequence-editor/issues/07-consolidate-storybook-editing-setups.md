# 07 — Consolidate Storybook editing setups

Resolution: implemented in `dc35b6b`
Depends on: [01](01-preview-and-move-one-placement.md), [02](02-select-and-move-placements-together.md), [03](03-grow-sequence-on-trailing-trim.md), [04](04-drop-from-clip-pool-past-endpoint.md), [05](05-adjust-fades-on-the-timeline.md), [06](06-control-the-playhead-without-media.md), [08](08-trim-placements-on-the-timeline.md)

## Acceptance criteria

- **Assemble a rough cut** supports gap filling, sequence growth from a pool drop or trailing trim, and trim and fade adjustments through timeline controls and the Inspector.
- **Rearrange a layered edit** has room for valid cross-track moves and a placement that can block a group drop. An editor can try a rejected drop, then move the group past the endpoint.
- Both are editable host-driven stories with the same interactions where applicable, including playhead controls, and surface host callbacks in Storybook Actions.
- Keep useful behavior and compiler regression checks without maintaining a separate interactive story for every gesture. Update browser fixtures or test references when retiring old stories.

## Comments

- Replaced the per-gesture stories with two host-driven workflows: **Assemble
  a rough cut** and **Rearrange a layered edit**. Both feed accepted edits
  back into the editor, show both callbacks in Actions, and work without media.
- Red → green: the browser check first found the old story catalogue, then
  found exactly the two workflows after consolidation. The migrated tests
  keep independent sequence and `CutList` assertions and use the stories'
  public args only where a regression needs different starting positions.
- The default rough-cut story passed the real gap drop; the default layered
  story passed blocked and extending group moves. Both manager tests
  committed a trim, verified the new duration, and saw both host callbacks
  in Actions. There are no outstanding story migration blockers.
- Final static Storybook build passed, with 38 Playwright tests in each
  Chromium color scheme (76 total). Library build, typecheck, formatting,
  package dry-run, `git diff --check`, and all 87 Vitest tests passed. Lint
  reported only existing warnings outside the sequence editor.
- On the first full dev run, a cold Storybook compilation delayed the
  rough-cut story past the first assertion's timeout. The browser harness
  now waits for the editor to appear before starting gestures. Both focused
  drop regressions passed concurrently on a fresh dev server, followed by
  all 38 Playwright tests against the dev server.
- Stryker on the story host callback and feedback wiring: 6 killed,
  2 survived, no timeouts (8 total). The survivors remove optional chaining
  from callbacks supplied by both stories. Report:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket07-combined/reports/mutation/mutation.json`.
- Recheck on `feat/sequence-editor`: the Storybook index still lists exactly two
  editing workflows, and each reports both host callbacks in Actions. All
  41 baseline cases passed with static Storybook and Chromium. An isolated
  dev-server snapshot did not load the Storybook preview with symlinked
  dependencies; the static build of the same snapshot passed.
- Expanded-batch integration: all 90 browser cases in the full static
  Storybook snapshot passed in light and dark Chromium (180 runs);
  both workflows still emit both host callbacks in Actions. The final
  five viewport cases then passed separately in both color schemes,
  including the additional endpoint-grip regression. The production
  sources were unchanged between the full matrix and that focused rerun.
