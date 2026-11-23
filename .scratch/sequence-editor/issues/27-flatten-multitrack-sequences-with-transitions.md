# 27 — Flatten multitrack sequences with transitions

Resolution: implemented and verified at the `CutList` boundary

## Goal

Compile to the existing ordered `CutList.outputTrack`. Authored tracks
determine which placement is visible at each sequence position; they are
not carried into the `CutList` as tracks or overlays. Do not reject a fade
solely because more tracks exist.

## Starting point

Straight cuts already flattened across tracks. The compiler initially
rejected fades when more than one track was authored, even if the
additional tracks were empty.

## Acceptance criteria

- Resolve a reveal fade's destination from the flattened sequence: at the
  outgoing placement's exclusive end, apply all placement starts and ends,
  then choose the uppermost active placement. Emit its section immediately
  after the outgoing section carrying `transitionOut`. The destination may
  be a lower placement resuming or another placement starting at that
  boundary. Do not skip an uncovered interval to look for a destination.
- Entry fades use the preceding section in flattened order. Keep
  `transitionIn` and `transitionOut` on the section edges where they were
  authored; do not copy them onto fragments that do not contain those edges.
- Verify a lower A, upper B, lower A example: A covers sequence `[0, 100)`
  from source `[100, 200)` and B covers sequence `[40, 60)` from source
  `[500, 520)`. The output order is A → B with a reveal fade → A. At
  sequence frame 60, A resumes at source frame 160, not 140.
- Verify the emitted `CutList` section order, source-frame ranges, and
  transition fields and durations. If the existing schema cannot represent
  the authored result, return `null` rather than dropping a fade or
  shifting source ranges. Downstream rendering is outside this ticket.

## Comments

- Triage: use ordered sections to identify the transition destination.
  [28](28-keep-empty-tracks-neutral-for-fades.md) covers the smaller
  empty-track case independently.
- Scope correction: completion is determined by the emitted `CutList`.
  Downstream renderer behavior is not an acceptance criterion or a blocker.
- Implemented at the public `compileCutList` boundary. The canonical export
  is A `[100, 140)`, B `[500, 520)` with `transitionOut`, then A `[160, 200)`.
  The existing priority sweep also selects a newly starting placement after
  a reveal when it is the uppermost active placement at that boundary. A gap
  still returns `null`, rather than searching forward for a destination.
- Entry and reveal fields are emitted only on the fragments that contain
  their authored edges and full fade regions. A hidden or shortened fade
  region makes the sequence unrepresentable and returns `null`. Fade
  authoring controls still follow ticket 28's occupied-track rule.
- Observed red → green through `compileCutList` for the canonical reveal,
  the rejected truncated reveal, and the entry/reveal attached to separate
  fragments. Regression checks also cover the simultaneous handoff, a gap
  after a reveal, a truncated entry, and an entirely covered reveal.
- Verification: 19 compiler tests, 113 total Vitest tests, typecheck,
  focused lint and formatting, and `git diff --check` passed. The later
  repo-wide formatter flagged `SequenceEditor.keyboard.browser.ts` from
  concurrent work, outside this ticket.
- Live Storybook timed out waiting for the editor to load. A frozen static
  Storybook rerun on port 6027 passed all 20 fade browser checks (10 in light
  mode and 10 in dark mode), including ticket 28 and the renamed Inspector
  locator from ticket 14.
- Stryker on the changed compiler ranges killed 61/64 mutants with no
  timeouts. The three survivors were on existing validation: skipping
  individual fade duration checks or rejecting adjacent fade regions.
  Added public compiler regressions for zero/fractional durations and
  adjacent fade regions; a targeted rerun killed all 13 validation mutants,
  including those three. Reports: `/tmp/opencode/gtve-ready-mutation.5Yxjq3/`
  under `ticket27-compiler` and `ticket27-validation`.
