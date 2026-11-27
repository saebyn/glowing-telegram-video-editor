# 108 — Resume Preview sound after audio context suspension

Status: needs-triage
Review priority: P2
Related: [49 — Sequence Preview HLS playback](49-design-hls-playback-for-sequence-preview.md)

## Problem

[`previewSound`](../../../src/utils/previewSound.ts#L16) caches the first
successful `AudioContext` unlock. Start audiovisual playback, suspend the
context, then pause and press Play again. The gate still reports ready, no
new resume is attempted, and picture advances while sound is dropped.

## Acceptance criteria

- If a previously running context is suspended, a new Play gesture can
  resume it. Gate readiness reflects the actual context state rather than
  the result of an earlier unlock.
- If the context cannot resume, do not silently treat missing expected sound
  as successful playback. Preserve the existing picture-only behavior for
  reverse and frames that require no sound.
- Verify suspension and reactivation using a controlled audio context or
  local audiovisual fixture.
