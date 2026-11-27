# 103 — Make the packaged compiler types usable with NodeNext

Status: needs-triage
Review priority: P2
Related: [44 — Compose and export the editor](44-compose-and-export-the-sequence-editor-page.md),
[61 — Isolate the compiler package entry](61-isolate-the-compiler-package-entry.md)

## Problem

The new [`compileCutList` export](../../../src/index.ts#L110) ships through an
extensionless declaration re-export. In a TypeScript ESM consumer using
`NodeNext`, the packed package resolves `compileCutList` as `any` and rejects
the import of `Sequence`, even with `skipLibCheck`. Ticket #44 already noted
the underlying declaration limitation; this ticket covers the documented
direct compiler usage.

## Acceptance criteria

- From an installed tarball, a TypeScript ESM consumer using NodeNext can
  import `compileCutList` and `Sequence` from the package root. The function
  has its declared signature and rejects an invalid call at type-check time.
- The existing bundler-resolution consumer and runtime import still work.
- Add a packed-consumer type check. Do not change the public entry points
  without maintainer approval.
