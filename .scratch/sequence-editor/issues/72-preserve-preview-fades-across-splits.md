# 72 — Preserve Preview fades across source-continuous splits

Status: ready-for-agent
Resolution: Preview samples source-continuous split pieces as one range through the original fade window.
Review priority: P2
Related: [31 — Protect fades during moves and trims](31-protect-fades-during-moves-and-trims.md),
[49 — Sequence Preview HLS playback](49-design-hls-playback-for-sequence-preview.md)

## Problem

Place an eight-sequence-frame entry fade on a ten-sequence-frame placement
and split it four frames into the fade. The split keeps the original edge,
transition ID, and duration, and both pieces continue the same source at
the same elapsed time. Nevertheless,
[Preview's presentation resolver](../../../src/utils/sequencePresentation.ts#L189)
reports `Undefined transition` across the whole fade, including before the
split. The same issue affects reveal fades.

## Acceptance criteria

- At every sequence frame in the original fade window, a source-continuous
  split preserves picture and sound contributions, source times, and blend phase.
- Cover both entry and reveal fades. A real visible cut that interrupts the
  fade still reports `Undefined transition`.
- Do not change transition ownership, move either split piece, or require the
  `CutList` compiler to represent the split fade.

## Comments

- Red → green with the real split editor and the presentation resolver.
  Both entry and reveal initially reported `undefined-transition`. All eight
  frames of each now preserve the original picture, sound, source time, and
  blend phase; a source-time jump within the same source still reports an
  undefined transition. Transition ownership and compiler behavior are unchanged.
- 19 focused tests passed, plus typecheck, lint (existing captions warning),
  formatting, and `git diff --check`. Four isolated mutations were caught:
  dropping split continuity, accepting source-time jumps, resetting the blend
  phase, and sampling the wrong source time.
