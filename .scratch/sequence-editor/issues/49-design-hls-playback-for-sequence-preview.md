# 49 — Design HLS playback for `SequencePreview`

Status: ready-for-agent
Depends on: [47 — Separate render and preview source inputs](47-separate-render-and-preview-source-inputs.md)

## Target

Simulate the latest authored Sequence in the default `SequencePreview`
using host-supplied HLS renditions. Match the source times, picture and
sound contributions, and transitions specified by the edit, not the
quality of a downstream render. No custom Preview slot, pre-rendered
sequence, or successful `CutList` compile is required.

The [sequence preview target](../../../docs/sequence-editor-design.md#sequence-preview-target)
defines the presentation and transport contract. The intended host supplies
seekable MPEG-TS HLS over the whole source. The session owns the clock;
active Preview can ask it to hold during buffering without dropping the
current play intent. Prop changes to `SequencePreview` are approved. Audio-only
placement behavior is part of this target; [#50](50-design-audio-only-sequence-preview.md)
owns the delivery format and source timing metadata for audio-only inputs.

## Playback library shortlist

Try the best fit first and fall through if it fails the feasibility
checks. This is an evaluation order, not a dependency decision or a
requirement to ship multiple playback backends.

| Order | Candidate | Advantages | Trade-offs to verify |
| --- | --- | --- | --- |
| 1 | [Mediabunny](https://mediabunny.dev/guide/reading-hls) (MPL-2.0) | Direct master or media HLS ingest including MPEG-TS; timestamped video and decoded audio; independent sample readers. Least custom ingest code. | Verify timestamp normalization and browser codec support. Naive backward access can restart decoding from a key packet at every step; use bounded decoded lookbehind if needed. |
| 2 | [libmedia](https://github.com/zhaohappy/libmedia) (LGPL-3.0-or-later) | Direct HLS loader, decoded video and PCM through lower-level pipelines, WebCodecs and WASM decode options. | More I/O, demux, and decoder coordination; segment seeks still need decoder preroll. Verify concurrent reads, worker/WASM packaging in a consumer build, any deployment headers, and distribution obligations. |
| 3 | [mux.js](https://github.com/videojs/mux.js) (Apache-2.0) + [MP4Box.js](https://github.com/gpac/mp4box.js) (BSD-3-Clause) + [WebCodecs](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) | Explicit control of encoded sample timing: transmux compatible TS segments to fragmented MP4, then extract and decode samples. | Own playlist fetching, segment indexing, init data, timestamp alignment, separate audio alignment if present, decode preroll, and caching. MP4Box.js alone does not read MPEG-TS HLS. |

None of these libraries resolves the Sequence, composites the result, or
implements its transport. A virtual playlist or one MSE stream can order
compatible segments but cannot implement the authored picture blends or
audio crossfades by stitching segments alone. The existing hls.js media
element path is not an exact timestamped video-frame and PCM reader.

## Feasibility checks for the implementing agent

Use a small local MPEG-TS HLS fixture with known picture IDs and audio
markers for correctness, and representative host playlists for compatibility.
Use current desktop Chromium as the verification baseline; API presence
alone does not prove that the actual codec and device can decode the input.
Keep the test cases the same if trying the next candidate.

- Seek to a non-keyframe across a segment boundary and verify the returned
  picture against source elapsed time. Include a lower-cadence rendition
  and verify that adjacent requests can correctly use the same picture.
- Read two different positions in the same rendition concurrently. Verify
  that each can supply its own picture and audio for a dissolve, without
  moving or invalidating the other read.
- Check audio marker alignment at a trim and across a segment boundary;
  do not infer alignment solely from playlist durations.
- Exercise sustained picture-only reverse. Record cold seek and reverse
  latency, fetch behavior, and memory use as evidence for the selection.
- Before shipping a candidate, verify that it works as packaged in a real
  consumer, not just in an upstream demo. Report unsupported browser or
  codec combinations rather than silently falling back to a less faithful
  preview.

The design sets the full target. Implementation slicing and dependency
selection are intentionally deferred.

## Behavior to verify when implementing the target

- For a Storybook example with real media, reuse the
  [public Mux HLS sample](https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8)
  from the [`VideoSelectionPage` Default story](../../../src/components/pages/VideoSelectionPage.stories.tsx#L10)
  as a `previewHlsUrl` in a `SequencePreview` story. Use it for an
  interactive playback smoke check; keep automated timing assertions on
  the local fixture so they don't depend on the network.
- Test the browser-independent presentation rules with mixed-rate trims,
  separate picture and sound winners, a reveal whose counterpart starts
  at the cut, and a clipped dissolve that retains its authored phase.
- Test the session and Preview together: a dissolve waits for both
  contributions, playback resumes at the held position, and pause or
  seek prevents stale readiness from resuming an old request. Also check
  a host edit or URL replacement during buffering and hiding Preview.
- Check that an ordinary gap plays as black and silence, while a media
  failure or an undefined transition span stops at the affected position
  with distinct feedback and does not prevent seeking past it.

## Comments

- Design review clarified that browser playback needs to compose decoded
  source contributions, not merely stitch compatible HLS segments. The
  host confirmed full-source `.ts` playlists and that the rendition may
  differ in quality or frame cadence from the original.
