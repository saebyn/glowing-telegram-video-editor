# 51 — Key source metadata by source ID

Status: ready-for-agent

## Problem

The source array can contain multiple records with the same ID.
`SequenceTimeline` takes the last and `compileCutList` takes the first, so the
editor can show thumbnails from one asset while compiling against another.
Source order has no meaning, and multiple clips can reference the same source.

## Acceptance criteria

- Replace source arrays at the public interface with a readonly, sparse
  `Record` keyed by source ID. Use the key as the only ID; remove the `id`
  field from the metadata value. Clips still reference it via `sourceId`.
  Do not add a legacy array overload or a compatibility adapter.
- Apply the same shape to the default editor, standalone editing modules
  that accept sources, and `compileCutList`. The compiler still accepts
  render-only metadata; preview URLs and thumbnails remain editor inputs.
- Look up only keys present in the supplied record, not inherited object
  properties. A missing key remains a missing source, and the compiler
  still reports it using the existing `missing-source` issue.
- Update the README, stories, and in-repo callers. Verify that multiple
  clips resolve to one source entry in both the editor and compiler,
  that absent keys stay absent, and that the public types no longer accept
  source arrays.

## Comments

- The maintainer explicitly approved replacing the public source arrays
  with the source-ID-keyed `Record` described above, without an array overload.
- Duplicate IDs are a host input bug. The keyed interface makes them
  unrepresentable in the library's input. If a host starts with a list,
  it must catch duplicates before constructing the record; the library
  cannot recover entries already overwritten by that conversion. There
  are no downstream hosts to migrate before 1.0.
