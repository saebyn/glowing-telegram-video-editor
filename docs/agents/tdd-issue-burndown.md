# TDD issue burndown

In this repository, type `@tdd-issue-burndown` in OpenCode. Add a feature name
if needed, for example: `@tdd-issue-burndown for sequence-editor`. The
[skill](../../.opencode/skills/tdd-issue-burndown/SKILL.md) uses the current
branch by default and picks the first unblocked, unresolved ready ticket.

If you can't load the skill, copy the template below. The original sequence
editor prompt is preserved at the end.

## Reusable prompt

```text
Implement the ready tickets for <feature> on the current branch using TDD.
Read AGENTS.md, GLOSSARY.md, <relevant design docs>, and the PRD and tickets
under .scratch/<feature>/. Treat the tickets as the feature scope and the
project's documented responsibilities as the outer boundary. If a ticket
appears to cross that boundary, flag the conflict before expanding the work.
Confirm the batch if additional tickets become ready during the run.

Skip resolved tickets. Start with the first unblocked ready ticket in the
documented priority order, or the lowest ticket number if no order is given.
Before writing tests, propose test seams and confirm them with me unless the
PRD explicitly agrees to them. Work in small vertical slices: observe one
behavior test fail for the expected reason, implement just enough to pass,
then repeat. For pointer behavior, use real Storybook/Playwright gestures and
observable UI or host callbacks. Use focused Vitest tests for edit rules
and compiler output.

Assign subagents by ticket. Each owns both tests and implementation.
Parallelize only unblocked tickets with non-overlapping edits. Sequence
tickets that need the same files and use a spare agent for review.

Run relevant repo checks and mutation tests for changed code. Record
verification and in-scope blockers in each ticket's Comments. Mark completed
tickets with a Resolution line. Report what passed, what's blocked, and
which tickets are ready next.
```

For the sequence editor, verification ends at observable editing behavior,
host callbacks, and the emitted `CutList`. Do not investigate renderer
implementation or validate rendered media, and do not report either as a
blocker for this library.

## Original prompt

```text
Implement the ready sequence editor tickets on feat/sequence-editor using tdd.
Read AGENTS.md, GLOSSARY.md, docs/sequence-editor-design.md, and the PRD and
tickets under .scratch/sequence-editor/. Treat the tickets as the scope.

Start with ticket 01: exact drop preview and sequence growth for a single
placement move. Before writing tests, propose the test seams and confirm
them with me unless they were explicitly agreed in the PRD. Work in small
vertical slices: observe one behavior test fail, implement just enough to
pass, then repeat. Use real Storybook/Playwright gestures for pointer
behavior and focused Vitest tests where they best verify edit rules.

Coordinate multiple subagents by ticket. Each owns both tests and
implementation. Parallelize only unblocked tickets with non-overlapping edits.
Playhead transport is a candidate; group moves wait for ticket 01. If two
tickets need the same timeline code, sequence them and use the spare agent
for review instead.

Run the relevant repo checks and mutation tests for changed code. Record
verification and blockers in each ticket’s Comments. Report what passed,
what’s blocked, and which tickets are ready next.
```
