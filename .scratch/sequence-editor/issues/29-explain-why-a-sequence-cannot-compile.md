# 29 — Explain why a sequence cannot compile

Status: needs-info

An editor can make and keep a valid edit that returns `null` from
`compileCutList`. A **sequence gap** is a span with no placement on any
track. Gaps are valid authored state even though the current compiler
cannot represent them in a `CutList`.

## Proposed acceptance criteria

- When explaining a missing `CutList`, distinguish gaps from missing
  clip/source metadata, mismatched source and project frame rates, and
  unsupported fades. A gap explanation should describe an output
  limitation, not tell the editor the sequence is invalid.
- Keep the existing `compileCutList` and `onCutListChange` result contract.
  Diagnostics don't change the sequence or block edits or saves.
- No timeline gap warnings or gap navigation in this proposal. The host
  decides whether to warn or ask for confirmation before approval.

## Comments

- Inspired by [Streamosaic #219](https://github.com/saebyn/streamosaic/issues/219):
  explain unsupported output rather than silently dropping edits. Whether
  the editor or only the host should display these explanations is open.
- Triage: decide whether there is a need for general compiler diagnostics
  beyond the specific transition feedback in [30–32](../TRIAGE.md).
  No automatic warning for a valid sequence gap.
