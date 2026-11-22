# 24 — Shorten the sequence explicitly

Status: ready-for-agent

## Proposal

Let editors shorten the sequence by setting its endpoint explicitly.
Suggested first pass: remove only uncovered time at the end, down to the
latest exclusive placement end across all tracks. Reject an endpoint that
would cut through or discard a placement.

Commit the duration change once without moving or trimming any placement.
This is not a gap-closing operation. It does not change the rule that other
edits leave sequence duration intact unless they need to grow it.

## Comments

- Edit-rule TDD: shortening a 100-frame sequence to the exclusive end of
  its last trimmed placement (75) first returned no edit; after the fix
  it preserves all tracks and placements. The next test exposed that
  frame 74 was incorrectly accepted; the evaluator now checks the
  resolved exclusive ends on every track. A third slice rejected unchanged,
  greater, and fractional endpoints.
- Evaluator verification: 8 focused Vitest tests passed. A Stryker follow-up
  killed all 28 mutants after covering endpoint zero on an empty sequence,
  matched-clip lookup, and unresolved placement duration. Report:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket24-endpoint-rules-final/reports/mutation/mutation.json`.
- Browser TDD: the existing rough-cut story had no author-facing endpoint
  control. In the isolated mounted snapshot, shortening 300 to 240 frames
  committed once and filled the output exactly with the two existing
  placements. The mounted form also rejects an endpoint within a placement,
  showing feedback without either callback. Stryker killed all 6 form
  submission and feedback mutants; report:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket24-endpoint-form-mounted/reports/mutation/mutation.json`.
- Shared branch integration: both endpoint browser cases passed in static
  Chromium with the Split and thumbnail checks (7/7). Typecheck, format,
  lint (pre-existing warnings only), and the 113-test Vitest run passed.
