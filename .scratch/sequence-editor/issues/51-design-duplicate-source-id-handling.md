# 51 — Design handling for duplicate source IDs

Status: needs-info

## Problem

The host must supply one source record per ID. Today, if it sends two,
`SequenceTimeline` takes the last record and `compileCutList` takes the first.
The editor could show thumbnails or a future preview from one asset while
compiling against another. Multiple clips sharing a single source ID are valid
and are not duplicates.

## Decisions needed

- Decide where to detect duplicates for editor inputs and direct compiler
  calls, and whether both should share one validation rule.
- Decide how to report the invalid input to the host, whether editing can
  proceed, and what to show for affected placements. Avoid letting the
  timeline, Preview, and compiler silently choose different records.
