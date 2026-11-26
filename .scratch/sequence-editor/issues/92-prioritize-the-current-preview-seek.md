# 92 — Keep obsolete Preview reads from blocking the current seek

Status: ready-for-agent
Resolution: Prioritize the displayed frame over obsolete Preview work without expanding the cache or preparation limits.
Review priority: P2
Related: [77 — Bound the decoded-media cache](77-bound-preview-cache-across-renditions.md)

## Problem

At 60 fps, 23 distinct scrub requests to one stalled HLS playlist can occupy
all preparation slots in the [Preview reader](../../../src/utils/previewReader.ts).
Evicting the old requests from the result cache does not stop their work.
The next seek into a gap stays loading; a seek to a healthy rendition won't
even open that rendition until older reads settle.

See the [Preview request sequence diagram](../../../docs/sequence-editor-data-flow.md#from-the-playhead-to-decoded-media).

## Acceptance criteria

- A seek into a gap with no authored contributions can present black and
  silence without waiting on stalled decode work.
- A seek needing available media can begin its required reads without
  waiting for all superseded reads to finish. Preserve reuse for reads still
  relevant to the new frame and keep the existing resource limits.
- Use deterministic stalled reads and assert the new frame can become ready
  before releasing the old reads. Old results cannot change the current
  picture, sound, or play intent after release.

## Comments

- Deterministic regressions cover a gap and a healthy seek while older work
  stalls, including a different decode window on the same rendition. The
  current frame can reclaim obsolete reads without opening more than four
  renditions or increasing the preparation budget. Work that shares the
  needed picture or sound window stays reusable.
- Cancellation happens at the rendition input. An input with an in-flight
  read shared by the current frame is retained instead of being restarted.
- Verified Vitest, all 19 Preview Chromium tests, typecheck, formatting,
  build, and the packed CSS check. All 11 targeted mutants were caught.
  Lint reported only the existing
  VideoPlayer captions warning.
