# 49 — Design HLS playback for `SequencePreview`

Resolution: implemented in `f653116` and accepted after maintainer playback testing with a real HLS stream
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
markers for correctness, and a real HLS stream for manual playback verification.
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
- Implemented the reviewable preview in `SequencePreview` itself. The
  session owns play intent and gates advancement on the current mounted
  preview. Preview does not require or change `CutList`. Audio-only delivery
  and source timing metadata remain in #50.
- Mediabunny 1.66.3 passed the Chromium 158 local H.264/AAC MPEG-TS probe:
  non-keyframe seek across a segment boundary, shared source time for
  adjacent requests, and concurrent reads of distinct picture and audio
  positions of one rendition. Cold seek was 45–309 ms in repeated runs;
  18 reverse requests with bounded lookbehind took 15–17 ms, fetched each
  fixture segment once, and retained at most five decoded 64×36 pictures
  (about 45 KiB as RGBA, not total browser memory). The production reader
  bounds its decoded lookbehind and loads the decoder in a deferred chunk.
- Passed typecheck, formatting, library and static Storybook builds, 214
  Vitest checks, the 164-test Chromium regression run and all seven final
  targeted Preview browser checks. Six targeted presentation mutations
  were caught (elapsed-time mapping, channel priority, dissolve phase,
  fade extension, same-cut conflict, and mixed-rate audio trim). Lint has
  the existing `VideoPlayer` captions warning. A separate Vite consumer
  installed from `npm pack` decoded the local fixture and played to the
  sequence endpoint.
- Manual test surface: **Pages / SequenceEditorPreview** has **Local
  Dissolve**, **Missing Expected Sound**, and **Undefined Dissolve**.
  **Molecules / SequencePreview / Public HLS Smoke** started playback and
  switched direction in desktop Chromium. See the
  [manual checklist](../../../docs/development.md#manual-sequence-preview-checks)
  for listening, scrubbing, and using network throttling.
- Manual review found a hold every 30 sequence frames at 60 fps in the
  Mux story, and audible corruption. Chromium measurements showed that
  cold half-second windows were decoding the 1920px variant (~0.7–1s per
  window). Preview now prefers a variant sized for its canvas and warms
  future decode windows during forward playback. A rerun reached frame
  591 in ~10 seconds, crossed a segment boundary, and showed only the
  initial loading indicator. The Mux story now exposes an editable
  **Controls → Media** object.
- Audio had gaps and overlaps when blocks were scheduled from animation
  ticks. The transport now schedules ready sound ahead of the picture, and
  contiguous blocks share the same Web Audio clock. The Mux trace had
  288 gaps and five overlaps larger than 1ms before the fix and none in
  the first 300 blocks afterward. The local 60-fps browser regression
  records the mixed audio output and checks the 440Hz tone for dropouts and
  incorrect pitch.
- Follow-up verification: 215 Vitest and 20 targeted Chromium checks
  passed, along with typecheck, formatting, library and Storybook builds,
  and playback in a freshly packed consumer. Four targeted mutations
  were caught: ignoring the Media control, choosing the oversized
  variant, removing decode lookahead, and waiting to queue audio.
- Public HLS Smoke now demonstrates three placements with an opening fade,
  a centered dissolve, a hard cut, and a closing fade. A read-only timeline
  shows the transition windows and scrubs the Preview. The local tone
  story remains a separate, single-placement audio reference. Chromium
  verified the timeline without network media and played the Mux edit
  to its endpoint without a Preview diagnostic.
- Reproduced stutter through the same-source dissolve. The two positions
  and their lookahead evicted each other's decoded windows. With a bounded
  six-window cache, Chromium configured 14 decoders during the dissolve
  instead of 94; the 12-second Mux edit finished in 12.2s instead of 14.0s
  with no mid-playback loading in that run. All 13 Preview browser tests
  passed, and reducing the cache back to three failed the regression.
- On a slower display clock, a ready decoded window was not enough:
  Preview prepared only the next sequence frame, so a tick crossing
  multiple frames would stall on the first frame it hadn't prepared.
  Preview now prepares a short contiguous run as well as the existing
  decode lookahead. The 60 fps local fixture finishes on a simulated
  ~30 Hz display clock; reverting to one prepared frame fails the test.
  This doesn't increase the decoded-window limit. At 4× CPU throttling,
  the Mux edit still showed decode-window stalls, so the slower-display
  regression does not guarantee smooth playback on a heavily loaded CPU.
- The maintainer tested playback with a real HLS stream and confirmed that
  no separate host-playlist check was needed to close the ticket. Further
  optimization is deferred to [#66](66-reuse-sequential-preview-decoders.md)
  and [#67](67-profile-warm-preview-playback.md).
