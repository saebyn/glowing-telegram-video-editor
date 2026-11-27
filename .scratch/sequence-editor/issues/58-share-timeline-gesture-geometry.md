# 58 — Share timeline gesture geometry

Resolution: Shared draft rectangle geometry; kept pointer conversions inline.

## Proposal

In [`SequenceTimeline`](../../../src/components/organisms/SequenceTimeline.tsx),
move, trim, and clip-pool drop calculate content coordinates or render draft
rectangles in similar ways. Compare private helpers for the shared
coordinate conversions and draft geometry against leaving those calculations
inline. Keep the seam inside the timeline adapter: editor actions still take
frame-based intents, not DOM coordinates.

## Acceptance criteria

- Share only calculations that have the same contract. Keep gesture-specific
  rules explicit, including drag thresholds, trailing-trim clamping,
  snapping, native clip-pool dragging, and move release refusing an unpreviewed
  destination. Don't add a generic drag controller or a public interface.
- Verify at the existing browser seam: the preview and commit agree after
  zoom or pan, blocked and cancelled gestures emit nothing, and an accepted
  edit emits one sequence proposal and one `CutList` result. Preserve
  keyboard, focus, and pointer hit targets.
- Use the [shared bundle measurement rules](../TRIAGE.md#production-bundle-cleanup).
  Don't land the extraction if it doesn't reduce the bundle or obscures the
  distinct gesture rules.

## Comments

- Built the original and two candidates in the same archived `7acf633`
  checkout using Node `v24.22.3`, the same lockfile/dependencies/settings, and
  `npm run build`. One shipped JS file, measured with `wc -c` and
  `gzip -n -9 -c`. Source maps and declarations excluded.

  | Variant | JS raw bytes | JS gzip bytes | Gzip change |
  | --- | ---: | ---: | ---: |
  | Original | 1,344,733 | 346,620 | — |
  | Shared rectangle and pointer conversions | 1,344,661 | 346,638 | +18 |
  | Shared rectangle using viewport pixels per frame | 1,344,615 | 346,592 | −28 |

  Both CSS alternatives were unchanged: `styles.css` 5,426,358 raw /
  4,071,619 gzip bytes and `custom-only.css` 19,124 raw / 3,944 gzip
  bytes. No asset changes. Keep only the rectangle, which also makes move,
  pool drop, and trim drafts use the same frame-to-pixel geometry.
- 36 Chromium Playwright tests passed across viewport, move, trim, clip-pool
  drop, snap, and keyboard suites. They cover preview/commit after zoom and
  pan, blocked and cancelled gestures, and exactly one callback per accepted
  edit. The panned preview test failed when the shared rectangle ignored
  scroll, then passed after restoring it. Logs:
  `/tmp/opencode/sequence58-final.cWLOEs/`.
