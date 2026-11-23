# 46 — Make `CutList` issues actionable

Status: ready-for-agent

## Proposal

Build on [29 — Explain why a sequence cannot compile](29-explain-why-a-sequence-cannot-compile.md).
The compiler already reports structured issues, but the default sequence
editor mainly shows transition notices. Help editors locate what prevents
`CutList` output without treating the authored sequence as invalid.

## Acceptance criteria

- Explain why `CutList` output is unavailable using the existing structured
  compiler issues. Show the explanation on initial load and keep it current
  with the host-supplied sequence, clips, sources, and project frame rate.
  Clear resolved issues. Preserve existing transition notices without
  duplicating them.
- For an uncovered range, show its sequence-frame bounds and offer a
  keyboard-operable **Jump to first gap** action that seeks to the start of
  the earliest reported gap. Explain that gaps are valid in an edit but
  cannot be represented in the current `CutList`. Do not infer gaps when
  the compiler cannot resolve the layout.
- Distinguish missing clip or source metadata from a source/project frame
  rate mismatch. For a source issue with an inspectable placement, offer a
  keyboard-operable action to select it for inspection, including on locked
  tracks. If the placement cannot be inspected, keep the explanation
  visible without a broken action.
- Loading or replacing inputs, jumping to a gap, and selecting a placement
  do not emit either host callback or add Undo history. An edit still
  proposes one sequence and reports one `CutList` result, even when output
  is unavailable.
- Verify in Storybook with a controlled host: a loaded gap is actionable
  without an edit callback, a source issue points to its placement, and the
  gap explanation clears after the host accepts an edit that fills it.

## Out of scope

Changing the `CutList` format or compiler rules, automatically repairing
sequences, adding gap overlays to the Timeline, and deciding whether the host
can save or approve an edit.
