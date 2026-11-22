# 12 — Show frame thumbnails on taller tracks

Status: ready-for-agent

## Proposal

Make sequence tracks tall enough to show a strip of frame thumbnails inside
video-bearing clip placements. Keep the placement label, selection state,
trim and fade handles, and drop previews legible. Align track headers and
drag targets with the taller rows.

Use **frame thumbnails** for the images shown to editors. Existing props call
them `keyframes`, but the name of the UI feature need not imply these are
codec keyframes. The strip should reflect the placement's effective source
range, including after a trim. Keep a readable placement when no images are
available.

The host can supply thumbnails. Extend `SequenceSource` with optional
`keyframes` entries that pair an image URL with a zero-based native source
frame. Keep them on the source, not the reusable clip or placement, so trims
can use available images outside the clip's original bounds. Use the
placement's effective source range (inclusive in, exclusive out) to choose
images.

Neither the editor's clip-keyed `keyframes` lists nor
`@saebyn/glowing-telegram-types`'s `VideoClip.keyframes` lists include frame
positions. The host can adapt its media records to the editor's source
metadata contract; no shared types package change is needed for this slice.
Coordinate the source type change with [18](18-distinguish-source-media-types.md).

## Comments

- Confirmed: the host knows the mapping and supplies it explicitly. Use
  entries shaped like `{ sourceFrame, url }`. The editor does not parse the
  URL or infer a source frame from the entry's position in the list.
- Triage: the source metadata contract is settled. Verify a trim changes
  which images are eligible without changing the source metadata or the drag
  targets on the taller rows.
- Red → green: the existing rough-cut story received timed `sources` args,
  but rendered zero images for the closing Harbor. The new strip shows the
  inclusive in point and an eligible frame beyond the reusable clip's out
  point; it excludes earlier frames, the exclusive out point, and later
  frames. Thumbnails are ordered by native source frame without mutating
  host metadata.
- A real trailing drag leaves the authored strip unchanged in preview,
  then removes the thumbnail at the new exclusive out point on release.
  The other placement of the same clip keeps its thumbnail. Missing source
  metadata or no eligible images leaves the placement label and selection
  available. Compact placements omit the visual strip so they keep space
  for their controls.
- Track labels, widget rows, hit tests, and previews now share a 72 px row
  height. Some existing pointer specs needed to scroll the target into view
  or use a visible landmark instead of a fixed offset. No new workflow and
  no media-kind or zoom changes.
- Light and dark Storybook probes confirmed the strip, label, and controls
  remain visible on the selected placement, aligned with its track label;
  clicking on a thumbnail selects the placement. Library build, TypeScript,
  formatting, focused lint, and 44 focused Vitest cases passed.
  On the integrated static Storybook, 37 browser cases passed in both
  color schemes. The full focused light run also reproduced the existing
  pool-drop failure below; that case was excluded from the dark run.
- The existing native right-edge pool-drop test is intermittent even on
  the pre-change 40 px rows (four failures in five runs). Nix Chromium can
  emit `dragend` without `drop` despite showing the correct preview.
  Failed releases hit the virtual grid while it had disabled child pointer
  events during scroll; successful releases hit the row. No native pool-drop
  change was made for this ticket.
- Focused Stryker against the three thumbnail browser cases: 23 killed,
  5 survived, no timeouts. Both range boundaries and the missing-source
  guards were detected. Surviving mutants change the empty or compact strip
  layout or remove redundant optional chaining. Report:
  `/tmp/opencode/gtve-12-thumbnails.2Rux1q/reports/mutation/mutation.json`.
