# 110 — Cancel queued forward audio when reverse starts

Status: needs-triage
Review priority: P3
Related: [75 — Cancel queued Preview audio on an endpoint seek](75-cancel-audio-on-seek-to-endpoint.md)

## Problem

Let forward playback finish with final sound buffers still queued, then
immediately press Play reverse. [`play`](../../../src/components/organisms/useSequenceTransport.ts#L116)
does not cancel the forward buffers and Preview exempts cancellation at the
endpoint. The [current browser test](../../../src/components/pages/SequenceEditorPreview.audio.browser.ts#L91)
observes the buffers surviving the switch, even though reverse playback is
picture-only.

## Acceptance criteria

- Natural forward completion alone may drain final queued sound. A new
  reverse command cancels it immediately, even before the first reverse
  display tick at the endpoint.
- Explicit Pause and seek still cancel queued sound. Reverse schedules no
  new sound.
- Update the deterministic Web Audio scheduling regression to distinguish
  natural completion, a new reverse command, and explicit Pause.
