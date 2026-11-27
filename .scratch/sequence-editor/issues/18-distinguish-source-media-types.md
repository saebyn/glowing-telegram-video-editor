# 18 — Distinguish source media types

Resolution: implemented in `2077dd8`

## Proposal

Visually distinguish video-only, audio-only, and audio-and-video media in the
Clip pool and on sequence placements. Suggested first pass: label the media
type and give audio-only placements a distinct appearance. For sources with
video, show frame thumbnails when available. A missing thumbnail must not
make a source look audio-only.

The host can supply the media kind. Extend `SequenceSource` with an optional
`mediaKind` field for video-only, audio-only, or audio-and-video. Use a neutral
appearance when the kind is omitted rather than guessing from the presence
of images or the media filename. Coordinate the source type change with
[12](12-show-frame-thumbnails-on-taller-tracks.md).

Treat waveform generation, audio-only placement and compilation support,
and track-role changes as separate questions, not implicit requirements of
this visual change.

## Comments

- Confirmed: the editor defines a small `MediaKind` type (`"video-only"`,
  `"audio-only"`, or `"audio-video"`), and the host maps its own media
  information to those values. Omitted `mediaKind` means unknown, not
  audio-only or video-only.
- Agreed test seam: pass source metadata through the public Sequence Editor
  Storybook args and inspect the visible clip cards and sequence placements.
  This tests presentation, not playback or compilation.
- Implementation: `SequenceSource.mediaKind` is optional and exported with
  `MediaKind` from the library. Both views use the source ID and the same
  labels. Explicit audio-only placements use a distinct palette and omit
  frame thumbnails; omitted kinds use the normal appearance and retain
  available thumbnails. Standalone clip pools do not require source metadata.
- Verified red before implementation, then seven Storybook browser tests
  green after integrating the pool mount (four media-kind tests and three thumbnail
  regressions). Type checking, declaration build, and touched-file lint and
  formatting passed. Seven isolated mutations were caught: removed pool
  mount, wrong pool lookup key, guessed unknown kind in either view,
  audio-only thumbnail, audio-only palette regression, and a wrong
  audio-and-video label.
- Light/dark visual review found that stacking the media kind above the
  thumbnail reduced the strip from 18 px to 6 px. A regression test and a
  fix that places the media kind beside the clip title are green in the
  isolated snapshot (seven browser tests passed). Ticket 19 integrated the
  layout fix and its height regression into the shared timeline after
  taking ownership of that file.
