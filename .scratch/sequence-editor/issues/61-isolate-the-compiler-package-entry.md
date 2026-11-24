# 61 — Isolate the compiler package entry from UI dependencies

Status: needs-triage

## Proposal

Provide a compiler-only package entry for consumers that do not mount an editor.
The [bundle audit](60-profile-dependency-bundle-costs.md) measured HLS.js, the
Keplar widget, and Temporal in the current production bundle when only
`compileCutList` is imported. Retain the compiler export at the package root
and keep both CSS exports stable.

## Acceptance criteria

- Compare a dedicated compiler entry with more tree-shakeable package output.
  Keep `compileCutList` input and output behavior identical, with no React,
  timeline, playback, or stylesheet dependency in the compiler-only fixture.
- Verify the compiler-only and root imports and their TypeScript declarations
  from a packed release. Check a mixed UI and compiler consumer for code
  duplication and preserve compatibility for existing imports.
- Use the [shared bundle measurement rules](../TRIAGE.md#production-bundle-cleanup).
  Report full release and compiler-, source-review-, sequence-editor-, and
  mixed-consumer bytes. Don't count moving code to peer dependencies as savings.
