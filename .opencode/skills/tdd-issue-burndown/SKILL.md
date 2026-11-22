---
name: tdd-issue-burndown
description: Implement ready local Markdown tickets using TDD. Pick the first unblocked, unresolved ticket automatically, coordinate work by ticket, and verify and commit each completed ticket.
---

# TDD issue burndown

1. Use the current branch unless the user names another. Read the repository's
   `AGENTS.md`, `GLOSSARY.md`, relevant design docs, and the issue tracker
   guidance. Use the feature directory the user names. Otherwise, infer
   `.scratch/<feature>/` from the branch or the only feature directory with a
   PRD and tickets. Ask which feature only if the scope is unclear.
2. Read the PRD, tickets, and any triage notes. The tickets set feature scope;
   the project's responsibilities are the outer boundary. Flag conflicts
   instead of crossing that boundary. Take the initial batch from unresolved
   `ready-for-agent` tickets. Skip tickets with a completed `Resolution:`, and
   check existing code and verification notes if completion is unclear. Do
   not redo shipped work. Confirm before adding tickets that become ready
   during the run.
3. Pick the first ready ticket whose dependencies are satisfied. Honor an
   explicit user choice or documented implementation priority; otherwise pick
   the lowest ticket number among unblocked candidates. No starting ticket is
   required from the user. If none can start, report what is complete and
   what is blocked instead of expanding scope.
4. Use the `tdd` skill. Confirm proposed test seams before writing tests unless
   the PRD explicitly agrees to them. Work one behavior at a time: observe the
   expected failure, make the smallest change that passes, and repeat. Use
   real Storybook/Playwright gestures for pointer behavior, observing UI and
   host callbacks. Use focused Vitest tests for edit rules and compiler
   output. For the sequence editor, verification ends at the emitted
   `CutList`; downstream rendering is not a goal or a blocker.
5. Assign subagents by ticket when independent work can run in parallel.
   Each owns its tests and implementation. Sequence tickets that share files
   or have unsatisfied dependencies; use spare agents for review rather than
   overlapping edits.
6. Run relevant repo checks and mutation tests for changed code. Record
   verification and in-scope blockers under each ticket's `## Comments`.
   Mark completed tickets with a `Resolution:` line following tracker
   conventions.
7. Commit each completed ticket on the working branch as soon as it is
   verified and resolved, before starting the next dependent ticket. Include
   its implementation, tests, and tracker updates in one ticket-scoped commit.
   Keep unrelated working-tree changes and other tickets out of it. When
   subagents work in parallel, integrate and commit their tickets separately.
   If you can't safely isolate a ticket's changes, report the blocker rather
   than bundling unrelated work.
8. Report the commits, what passed, what's blocked, and what's ready next.
