# 19 — Pan and zoom the sequence timeline

Status: ready-for-agent

## Proposal

Let editors pan horizontally to see a different part of the sequence and
zoom in for precise placement edits. Keep the ruler, playhead, tracks, and
drag previews aligned at every zoom level and scroll position.

Suggested first pass: horizontal scrolling, visible Zoom in and Zoom out
controls, and Fit sequence to return to an overview. Zoom around the
playhead when it is visible and around the viewport center otherwise.
Mouse and trackpad shortcuts can follow.

Pan and zoom change only the view. They do not seek, clear the placement
selection, change sequence duration, or emit edit callbacks. Verify that
seeking and placement drags still target the correct sequence frame after
both zooming and panning.

## Comments

- The existing timeline widget now offers Zoom in, Zoom out, Fit sequence,
  and a labeled horizontal pan slider. Zoom retains the visible playhead's
  screen position when bounds allow and uses the viewport center otherwise.
  Pan and zoom are editor UI state, not sequence edits.
- Storybook/Chromium verifies the fitted and zoomed placement scale, both
  zoom anchors, a right-side ruler seek after panning, and a placement move
  that previews and commits at frame 230 without resetting the panned view.
  An endpoint test checks that zoom keeps the whole grip reachable. The fit,
  pan/seek, and move regressions were observed red before the corresponding
  implementation. Five tests passed in both light and dark Chromium:
  `/tmp/opencode/sequence-ticket-19-final-viewport.log` and
  `/tmp/opencode/sequence-ticket-19-dark-viewport.log`.
- Isolated Stryker: 38/53 killed in the core run, then 13/13 grip mutants
  killed with the endpoint regression (three additional kills across the
  same 53 mutations; 41/53 total, no timeouts). Survivors exercise viewport
  anchoring left of the view and exactly at the right edge, the widget's
  redundant scroll-clamp requests, and ruler event/scroll fallbacks not
  distinguished by the tested gestures. Reports:
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket19-viewport-verified/reports/mutation/mutation.json`
  and
  `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket19-endpoint-grip/reports/mutation/mutation.json`.
