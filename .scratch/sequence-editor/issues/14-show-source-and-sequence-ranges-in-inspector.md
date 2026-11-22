# 14 — Show source and sequence ranges in the Inspector

Status: ready-for-agent

## Proposal

Rename **Selection inspector** to **Inspector**. For a single selected
placement, show two clearly labeled ranges:

- **Source in/out:** the effective source range after placement trim, in
  native source frames.
- **Sequence start/end:** where the placement begins and ends in the sequence,
  in sequence frames at the project rate.

Both ranges have an inclusive first boundary and an exclusive last boundary.
For example, a placement can use source frames `[114, 234)` and occupy
sequence frames `[240, 360)` at matching rates. A move changes only the
sequence range; a trim can change both. Keep existing edit controls and the
multi-selection summary. Showing these values does not itself add numeric
controls for moving placements or editing the reusable clip's bounds.

## Comments

- Triage: start with these range readouts and the rename, not new editing
  controls.
- Implemented the **Inspector** rename on the heading and accessible region.
  A single selection now shows effective source in/out in native source
  frames and sequence start/end in project frames, with both boundaries
  labeled inclusive/exclusive. Length uses the same frame conversion as the
  timeline; the readouts are text, not new controls. Trim and fade controls
  and the multi-selection summary are unchanged.
- TDD used real Storybook selection clicks and visible text in
  `SequenceEditor.inspector.browser.ts`. Red: the new Inspector heading did
  not exist. Renamed it, then observed the missing effective-source readout.
  Green: show the second Harbor's effective source `[120, 240)`, without
  emitting edit callbacks. Next red: the sequence range was absent. Green:
  with the story's public sequence arg trimming 60 frames off the end, the
  Inspector shows sequence `[240, 300)` separately from source `[120, 180)`.
  The initial mixed-rate URL experiment hit a Storybook limitation: the
  nested clip-rate override was not applied. The final regression uses the
  supported sequence arg; no mixed-rate editing was added.
- Final focused browser run: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/nix/store/54ws4g5cbz5vqwllpvyczbvz2cn4lx85-chromium-158.0.8127.36/bin/chromium npm run test:browser -- --config /tmp/opencode/gtve-ticket14.playwright.config.ts --workers=1 src/components/organisms/SequenceEditor.inspector.browser.ts src/components/organisms/SequenceEditor.group.browser.ts src/components/organisms/SequenceEditor.delete.browser.ts`
  passed 10/10 on static Storybook at port 6114. Static Storybook built via
  `npm run build-storybook -- --disable-telemetry --output-dir /tmp/opencode/gtve-ticket14-storybook`;
  the dev run on port 6014 hit intermittent cold-start timeouts. Typecheck,
  changed-file formatting, and `git diff --check` passed. Lint returned seven
  pre-existing warnings. A shared-checkout `npm test -- --run` passed 105/106:
  the concurrent multitrack fade compiler test expected a `CutList` but got
  `null`, outside the Inspector change.
- Stryker snapshot (`MUTATION_CONCURRENCY=3`, same Chromium):
  `node /tmp/opencode/gtve-ready-mutation.5Yxjq3/run.mjs ticket14-inspector-1 browser 'src/components/organisms/SequenceEditor.inspector.browser.ts src/components/organisms/SequenceEditor.group.browser.ts' src/components/organisms/SequenceEditor.tsx:75-85 src/components/organisms/SequenceEditor.tsx:228-229 src/components/organisms/SequenceEditor.tsx:242-253`.
  Killed 10/20, including the name, range output, and end-arithmetic
  mutants; 10 survived, no timeouts or errors. Five survivors alter the
  reused fade-control guard, which these selected specs do not exercise on a
  fade-eligible placement. Five alter conjuncts that imply one another for
  normal selectable placements (a clip and placement imply a resolved
  source range and frame count). No new seam or follow-up production edits.
  Report: `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket14-inspector-1/reports/mutation/mutation.json`.
