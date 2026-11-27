# 106 — Prioritize a seek that needs a media-kind probe

Status: needs-triage
Review priority: P2
Related: [77 — Bound the decoded-media cache](77-bound-preview-cache-across-renditions.md),
[92 — Prioritize the current Preview seek](92-prioritize-the-current-preview-seek.md)

## Problem

In the [Preview reader](../../../src/utils/previewReader.ts#L216), an
unresolved media-kind probe protects every in-flight window for the
rendition URL. At 60 fps, fill all 23 preparation slots with stalled reads,
then seek to a healthy decode window of a second source ID that shares the
URL but omits `mediaKind`. The probe waits for a slot while protecting the
obsolete reads that hold those slots. Declaring the second source's kind
lets the same seek complete.

## Acceptance criteria

- When the rendition has already opened, use its discovered kind before
  deciding which decode windows to protect for the current frame.
- The healthy seek becomes ready before the deterministic stalled reads
  are released. Stale results cannot replace the current result.
- Keep existing preparation and rendition limits and preserve reuse of
  reads that genuinely overlap the current frame's needs.
