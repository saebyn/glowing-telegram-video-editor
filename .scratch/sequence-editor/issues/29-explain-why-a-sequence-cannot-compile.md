# 29 — Explain why a sequence cannot compile

Status: needs-info

Resolution: `compileCutList` and `onCutListResult` now report structured
issues. The default editor continues to show transition notices; the host
can decide how to show other issues.

A **sequence gap** is a span with no placement on any track. Gaps are
valid authored state even though the current compiler cannot represent
them in a `CutList`.

## Proposed acceptance criteria

- When explaining a missing `CutList`, distinguish gaps from missing
  clip/source metadata, mismatched source and project frame rates, and
  unsupported fades. A gap explanation should describe an output
  limitation, not tell the editor the sequence is invalid.
- Return the same discriminated result from `compileCutList` and through
  `onCutListResult`. Diagnostics don't change the sequence or block edits or saves.
- No timeline gap warnings or gap navigation in this proposal. The host
  decides whether to warn or ask for confirmation before approval.

## Comments

- Inspired by [Streamosaic #219](https://github.com/saebyn/streamosaic/issues/219):
  explain unsupported output rather than silently dropping edits. Whether
  the editor or only the host should display these explanations is open.
