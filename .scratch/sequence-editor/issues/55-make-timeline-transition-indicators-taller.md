# 55 — Make timeline transition indicators taller

Resolution: Rendered full-width transition windows in a shared lane with separate placement and resize targets.
Depends on: [53](53-separate-placement-and-transition-properties.md)

## Proposal

Make authored fades and centered dissolves look like selectable regions on
the sequence timeline, not small badges. The timeline remains a projection
of the same authored transitions.

## Acceptance criteria

- Entry fades, reveal fades, and centered dissolves use roughly the top 80%
  of the track height. Keep their true projected positions and widths,
  including where a dissolve straddles its owning edge; don't add a
  minimum-width marker or inflate its hit area. Short or obscured transitions
  are still inspectable through their owner's Placement Properties.
- Clicking the transition body selects it, not the placement. Leave a
  continuous placement strip below it for click and move gestures, apart
  from the existing trim grips at the corners. Keep trim grips and the
  separate resize grips for authored fades; remove fade creation grips from
  empty edges so adding starts only in Placement Properties. Do not add
  drag-and-drop authoring or timeline resize grips for dissolves.
- If a move or trim leaves indicators overlapping, keep them in the same
  lane at their true positions and widths. Draw the selected one on top and
  retain the conflict warning. Both transitions remain authored and can be
  reached through their owning edges.
- Verify with real Storybook/Playwright pointer interactions that a
  full-placement fade doesn't steal the placement's move target, and that
  clicking, resizing an existing fade, and trimming still hit distinct
  targets. Cover an overlapping pair and the Inspector path for a narrow
  transition. Preserve existing Split mode and track-lock behavior. Update
  the [sequence editor design](../../../docs/sequence-editor-design.md#default-layout-and-timeline)
  to reflect the taller indicators and Inspector-only creation.

## Comments

- In Storybook, the full-placement fade's body initially measured 12 of
  64 pixels high. The new shared lane projects fades and dissolves at their
  true widths, with the selected indicator above any overlap and the
  placement strip and trim grips below it. Empty edges have no fade grips;
  tests that exercised timeline creation now use Inspector Add, or seed an
  authored fade and verify resize through the same pointer gesture.
- Four pointer regressions cover the body and move strip, a fade/dissolve
  overlap reached through both owning edges, a subpixel fade inspected via
  Placement Properties, and a Split beneath an indicator. Three mutations
  failed: intercepting the move strip, not raising the selected dissolve,
  and adding a minimum indicator width.
- The integrated patch on `2a19c00` passed all 158 Playwright tests without
  retries and all 199 Vitest tests, plus typecheck, build, format, and lint
  (existing captions warning only), including the unchanged viewport-fitting
  drag test. The Storybook server
  was stopped and port 6011 was confirmed closed. Full checks and mutation
  logs: `/tmp/opencode/sequence-editor-55-post54.siSh7I/artifacts/`.
