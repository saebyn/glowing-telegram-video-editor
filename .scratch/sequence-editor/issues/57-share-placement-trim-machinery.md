# 57 — Share placement trim machinery

Resolution: Retained the separate trim implementations; neither extraction reduced gzip bytes.

## Proposal

In [`trimPlacement.ts`](../../../src/utils/trimPlacement.ts), leading and
trailing trim repeat placement and clip lookup, lock checks, and immutable
placement replacement. Compare a private shared trim operation against
sharing only lookup and replacement, keeping the smaller straightforward
interface. The module owns placement trim rules; it does not need React, a
timeline widget, or adapters for the two edges.

## Acceptance criteria

- Keep edge-specific rules explicit: leading trim changes the source in
  point and sequence start together; trailing trim keeps the start fixed
  and can grow the sequence. Preserve exclusive source out points,
  frame-rate checks, exact adjacency, lock handling, untouched transitions,
  and no-op behavior. Leave the public interface unchanged.
- Verify through the trim module's existing interface and the timeline and
  Inspector behaviors, including blocked edits and callback counts.
- Use the [shared bundle measurement rules](../TRIAGE.md#production-bundle-cleanup).
  If the extraction doesn't save bundle bytes or makes the edge rules harder
  to follow, document the comparison without landing the abstraction.

## Comments

- Ran `npm run build` in a `git archive` snapshot of
  `de937aa80fc5a1ddc8a0c3ba0b270fb0a59f9662`, using Node `v24.22.3` and the
  same lockfile, installed dependencies, and build settings for every run.
  Only `trimPlacement.ts` changed between candidates. Measured with `wc -c`
  and `gzip -n -9 -c < file | wc -c`; excluded maps and types.

  | Variant | Shipped JS raw | Shipped JS gzip | Gzip change |
  | --- | ---: | ---: | ---: |
  | Original | 1,344,733 | 346,620 | — |
  | A: shared lookup and replacement (best gzip variant, using `findPlacementTrack`) | 1,344,651 | 346,665 | +45 |
  | B: one private trim operation with explicit leading and trailing branches | 1,344,557 | 346,666 | +46 |

  Both CSS exports were unchanged in every comparison: `styles.css`
  5,426,358 raw / 4,071,619 gzip bytes; `custom-only.css` 19,124 raw /
  3,944 gzip bytes. Other straightforward variants also grew gzip output
  (+48 to +52 bytes). Both approaches passed the existing trim and lock
  tests (17 tests), but the original ships less compressed JS. Rebuilding
  with only the new tests reproduced the original JS and CSS sizes.
- Added callable-evaluator regressions for a leading trim's effective
  exclusive out point, trailing trims between whole source frames, and
  mixed-rate leading trims. In isolation the checks failed when allowing a
  leading trim to reach the out point, removing the trailing integer guard,
  or skipping the leading frame-rate check, respectively. After restoration,
  the trim and lock suites passed (20 tests), as did typecheck, focused lint
  and formatting, and `git diff --check`.
- Stryker against `trimPlacement.ts` with the two focused suites: 161 killed,
  14 survived, no timeouts. Remaining unit-test gaps include missing
  placement or clip data, multi-track lookup/replacement, source-frame-zero
  limits, and fallback bounds when source duration is unknown.
  Report: `/tmp/opencode/gtve-ready-mutation.5Yxjq3/ticket57-trim-final-Q4kHYdII/reports/mutation/mutation.json`.
- The full one-shot Playwright suite passed (144 tests) on the `de937aa`
  snapshot with #56's independent legacy-view deletions applied. The trim,
  Inspector, and lock suites passed, covering both timeline edges, rejected
  and unchanged gestures, and host callback payloads and counts. The trim
  implementation and its UI adapters were unchanged in that snapshot.
