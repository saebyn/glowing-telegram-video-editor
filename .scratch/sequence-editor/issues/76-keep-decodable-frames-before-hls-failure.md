# 76 — Keep decodable Preview frames before an HLS segment failure

Status: ready-for-agent
Resolution: keep pictures yielded before a decode-window failure; still reject a picture that does not cover the requested source time.
Review priority: P2
Related: [49 — Sequence Preview HLS playback](49-design-hls-playback-for-sequence-preview.md),
[66 — Reuse sequential Preview decoders](66-reuse-sequential-preview-decoders.md)

## Problem

[The rendition reader](../../../src/utils/previewRendition.ts#L90) waits for
the entire half-second decode window. If the decoder yields the requested
picture and then fails on a later HLS segment in the same window, the window
promise rejects before the exact-time fallback runs. Preview reports missing
media at positions that were decodable.

## Acceptance criteria

- If a later segment fails inside the decode window, an earlier picture that
  covers the requested elapsed source time is still usable.
- A position genuinely missing its required media still reports `No media`;
  it must not show stale picture as though that picture covered the request.
- Add a deterministic fault case that yields a picture before the segment
  fails. Use a local HLS fixture or a controlled reader seam, not public media.

## Comments

- Red → green: a controlled Mediabunny iterator yielded the picture at
  source elapsed time 0.125s, then failed. The reader previously rejected
  the request and now keeps the picture. A request at 0.375s in that same
  window still rejects even if the exact lookup returns the stale picture.
  Preview maps the rejection to its existing `No media` state.
- Both Vitest reader checks passed. All 15 existing Preview Playwright checks
  passed in Chromium 158 using the local fixtures. Typecheck and formatting
  of the changed files passed.
- Two isolated mutations were caught: rethrowing the whole window's error
  despite a covering picture, and accepting a stale result on exact lookup.
