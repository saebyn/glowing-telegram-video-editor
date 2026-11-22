# 28 — Keep empty tracks neutral for fades

Status: ready-for-agent
Resolution: implemented in `2077dd8`

## Acceptance criteria

- An otherwise compilable sequence with fades emits the same `CutList`
  with or without empty tracks above or below its placements.
- The editor can adjust those fades through the Inspector and timeline
  handles regardless of the occupied track's index. The edit preserves the
  empty tracks and changes only the intended placement's fade.
- Do not add track management or decide how to render overlapping sources
  during a fade in this slice; see
  [13](13-add-and-remove-tracks.md) and
  [27](27-flatten-multitrack-sequences-with-transitions.md).

## Comments

- The compiler and fade authoring now share the occupied-track rule. Empty
  tracks remain in the authored sequence; more than one occupied track still
  prevents fade authoring and compilation of authored fades. This does not
  change track priority, gap handling, or downstream rendering.
- TDD: `compileCutList` returned `null` with empty tracks above and below an
  otherwise compilable edit; after the fix, both layouts emit the same literal
  sections and fades. The Storybook Inspector initially lacked the entry fade
  control on the middle track. Its entry edit and a real timeline reveal-grip
  drag now each emit one exact sequence and `CutList`, preserving both empty
  tracks and the other placement. A drag preview emits nothing. Multiple
  occupied tracks still hide the controls, and the compiler's covered-fade
  regression remains green.
- Checks: all 89 Vitest tests, all 10 fade Playwright tests (Storybook on 6018,
  local Chromium), typecheck, focused lint/format, and `git diff --check` passed
  in the shared checkout. Repo-wide lint exited successfully with unrelated
  warnings. A later shared-checkout rerun passed all 103 Vitest tests; typecheck
  flagged the concurrent Storybook `acceptEdits` args typing, and repo-wide
  format checking flagged concurrent shorten/split files. Those changes are
  outside this ticket.
- Stryker (concurrency 2): the compiler killed 11/11 mutants; the editor
  killed 26/29 with no timeouts. Two survivors target the unchanged
  positive placement-length condition on the same line. The third removes
  the no-occupied-track guard: neither UI can request a fade edit without
  a placement, so the approved browser seam cannot reach it. Reports are
  under `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket28-compiler` and
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket28-editor`.
