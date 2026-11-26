# 94 — Keep decodable Preview audio before an HLS segment failure

Status: ready-for-agent
Resolution: Keep decoded sound that continuously covers the request; report failures for missing recorded sound without replacing it with silence.
Review priority: P2
Related: [76 — Keep decodable Preview pictures before an HLS failure](76-keep-decodable-frames-before-hls-failure.md)

## Problem

[`previewRendition`](../../../src/utils/previewRendition.ts) discards an
entire half-second audio window if iteration fails. A controlled reader
yielded a buffer covering `[0, 0.25)` and then threw on the next segment;
even the fully covered request `[0.1, 0.2)` failed. Playback can stop before
the first frame whose requested audio is actually affected.

## Acceptance criteria

- Keep decoded buffers when they cover the requested source-time interval,
  even if a later segment in the same window fails.
- A requested interval that needs the failed data still reports a media
  error. Do not replace it with silence or accept partial coverage as full.
  Preserve intentional silence where a transition extends beyond recorded
  material.
- Use a deterministic iterator fault or local HLS fixture. Check an earlier
  covered request and a later uncovered request in the same decode window.

## Comments

- Red → green with deterministic iterator faults. The early covered request
  now succeeds, later or partially covered recorded audio preserves the
  segment error, and transition requests can still have intentional silence
  beyond recorded sound.
- All 9 rendition tests and 21 tests including sequence presentation passed.
  Typecheck, targeted lint and formatting, and `git diff --check` passed.
  All eight type-valid isolated mutations were caught.
