# 73 — Detect audio transition conflicts under video-only placements

Status: ready-for-agent
Resolution: authoring checks picture and sound independently; a video-only placement cannot hide a competing audio transition.
Review priority: P2
Related: [49 — Sequence Preview HLS playback](49-design-hls-playback-for-sequence-preview.md),
[54 — Edit transition type and duration](54-change-transition-type-duration-and-remove.md)

## Problem

Put a video-only placement above two adjacent audio-only placements. Give the
outgoing audio placement a reveal and try to add a dissolve at the same cut.
[Authoring validation](../../../src/utils/sequenceTransitions.ts#L241)
uses one flattened winner, treats the audio cut as covered, and accepts the
dissolve. Preview resolves picture and sound independently and reports an
undefined audio transition.

## Acceptance criteria

- A video-only placement does not mask the sound below it during transition
  conflict checks. The competing dissolve is blocked and emits neither callback.
- Check coverage separately for picture and sound. A transition that does not
  compete on either contribution remains editable.
- Verify the authoring result with declared media kinds; do not change the
  `CutList` compiler's export model or the audio-only delivery contract.

## Comments

- Red → green through the edit evaluator and the Chromium Inspector. Changing
  an audio fade to a competing dissolve under a video-only placement now
  shows a conflict and emits neither host callback. The reverse masking
  case and noncompeting edits are covered; undeclared media kinds still
  count as both contributions during authoring.
- 182 unit tests and 33 targeted browser tests passed. Seven targeted
  mutations were caught. Typecheck, formatting, and `git diff --check`
  passed; lint reported only the existing `VideoPlayer` captions warning.
