# 97 — Skip media-kind probes for covered fades

Status: needs-triage
Review priority: P2
Related: [49 — Sequence Preview HLS playback](49-design-hls-playback-for-sequence-preview.md),
[89 — Omit fully hidden fades from the CutList](89-omit-fully-hidden-fades-from-cutlist.md)

## Problem

The [presentation resolver](../../../src/utils/sequencePresentation.ts#L144)
probes the fade anchor before deciding whether the fade contributes at the
requested sequence frame. Put a playable audiovisual placement at `[0, 4)`
above a placement at `[0, 10)` whose reveal fade spans `[2, 10)` and whose
source has neither a declared media kind nor a playback rendition. At
sequence frame 2, the upper placement is the only contributor, but Preview
reports “No media” for the lower source.

## Acceptance criteria

- At a frame where a fade cannot contribute, the fade must not require a
  media-kind probe or load its playback rendition for the covered contribution.
- Resolve coverage independently for picture and sound. A covered picture
  must not suppress a needed sound probe, and genuinely missing required
  media must still report an error once exposed.
- Verify that the covered frame becomes ready in a deterministic reader test
  with the lower source unavailable.
