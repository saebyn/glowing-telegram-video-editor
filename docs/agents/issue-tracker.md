# Issue tracker: Local Markdown

- Put PRDs at `.scratch/<feature>/PRD.md`.
- Put tickets at `.scratch/<feature>/issues/<NN>-<slug>.md`, numbered from `01`.
- Read tickets from their file paths.
- Record triage on a `Status:` line near the top; see [triage labels](triage-labels.md).
- Mark completed work with a `Resolution:` line, without adding a triage status.
- Append discussion under `## Comments`.

For an implementation batch, use `@tdd-issue-burndown` in OpenCode or copy the
[TDD issue burndown prompt](tdd-issue-burndown.md).
