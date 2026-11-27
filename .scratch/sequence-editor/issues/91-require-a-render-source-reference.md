# 91 — Report a missing render source reference without interpreting it

Status: ready-for-agent
Resolution: Report missing render references as `missing-source`, without falling back to source IDs or interpreting supplied strings.
Review priority: P2
Related: [47 — Separate render and preview source inputs](47-separate-render-and-preview-source-inputs.md)

## Problem

If a source record exists but omits `s3Location`, the
[compiler's layout resolver](../../../src/utils/visibleSequence.ts) can
substitute `VideoClip.sourceId` and yield `ok: true`. A source ID identifies
the metadata record, not the render source. A Preview HLS URL also cannot
stand in for the render reference.

## Acceptance criteria

- Missing source records or missing render reference values produce an
  export issue. A missing reference does not block placement editing or
  invalidate an otherwise usable Preview rendition.
- Pass supplied strings through unchanged, including `""`, whitespace, and
  values that do not look like URLs. Do not parse, trim, or validate the
  meaning of the opaque reference; the host owns that meaning.
- Test both a source record with an omitted `s3Location` at the runtime
  boundary and a supplied empty string. The first must not fall back to the
  source ID or Preview URL; the second must compile as supplied.
- Keep the field name and public interface for now. A more neutral API name
  is a separate decision.

## Comments

- Red: an omitted `s3Location` compiled with the source ID even when a
  Preview URL was supplied. The compiler now reports `missing-source`;
  placement geometry and Preview do not require a render reference.
- The full Vitest unit project, typecheck, lint (existing VideoPlayer
  captions warning only), changed-file formatting, and `git diff --check`
  passed. The compiler tests preserve empty, whitespace-only, and non-URL
  references as supplied.
- Three isolated mutants were caught: restore the source-ID fallback,
  treat an empty string as absent, or trim the render reference.
