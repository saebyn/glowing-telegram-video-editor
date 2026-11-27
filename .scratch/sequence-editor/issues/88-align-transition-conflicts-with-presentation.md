# 88 — Check transition conflicts over the frames each transition contributes

Status: ready-for-agent
Resolution: Share Preview’s picture and sound contribution rules with transition authoring, including the separate same-cut rule.
Review priority: P2
Related: [69 — Reject competing fades at the same cut](69-reject-competing-fades-at-one-cut.md),
[72 — Preserve fades across source-continuous splits](72-preserve-preview-fades-across-splits.md),
[73 — Detect audio transition conflicts](73-detect-audio-transition-conflicts.md)

## Problem

[`sequenceTransitions`](../../../src/utils/sequenceTransitions.ts) and
[`sequencePresentation`](../../../src/utils/sequencePresentation.ts) disagree
about which frames two transitions compete over.

- A 16-frame entry fade on `[0, 20)` continues through a source-continuous
  split at frame 8. Adding a 12-frame reveal to the right piece is accepted,
  but Preview reports an undefined transition over `[8, 16)`.
- Dissolves at cuts 30 and 60, each 40 frames long, overlap in `[40, 50)`.
  An audiovisual cover on a higher track covering just `[40, 50)` leaves both
  cuts visible but masks their entire overlap. Authoring rejects the second
  dissolve even though Preview can present both.

## Acceptance criteria

- Reject Add, Apply, and Resize when the proposed transitions compete on
  visible picture or audible sound, including across a source-continuous
  split. Do not reject solely because raw windows overlap under a cover.
- Test picture and sound independently: a video-only cover does not mask
  an audio conflict. Preserve the separate same-cut conflict rule.
- Use consistent contribution rules across authoring and Preview without
  requiring `CutList` to represent the result or requiring authoring to
  fetch media.

## Comments

- Observed the authoring/Preview disagreement on a source-continuous split
  and on overlapping dissolve windows masked by a cover. Regressions exercise
  Add, Apply, and Resize, including covers that mask only picture or only sound.
- Verified 70 focused tests and 204 isolated unit tests, plus typecheck,
  targeted lint, formatting, and `git diff --check`. All nine targeted
  mutations were caught.
