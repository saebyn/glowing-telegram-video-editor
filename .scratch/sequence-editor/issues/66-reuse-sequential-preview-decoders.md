# 66 — Reuse decoders across sequential Preview reads

Status: ready-for-agent
Resolution: keep the post-#77 window reader; the prototype reduces Mux loading holds but regresses local seeks and retains more native decoder resources.
Review priority: P3
Related: [49 — HLS playback in `SequencePreview`](49-design-hls-playback-for-sequence-preview.md)

## Opportunity

Preview holds a bounded cache of decoded half-second windows. After the
same-source dissolve fix, a replay of the 12-second Mux story fetched no
additional media but still configured 55 audio and video decoders in one
Chromium trace. Cold decode-window stalls also remained at 4× CPU throttling.
Keeping more windows could help replay, but would not avoid starting new
decoders as playback moves into uncached ranges.

Compare the current window reader with a forward reader that reuses its
decoder across neighboring windows. Try independent read positions for the
two sides of a same-source dissolve. Consider making already-decoded samples
available before a full window finishes. Keep the current seek and reverse
paths unless the prototype demonstrates an improvement there too.

## Evidence to collect

- Compare cold playback and immediate replay using a local MPEG-TS fixture
  and the Public HLS Smoke story in Chromium. Include the same-source
  dissolve, a segment boundary, and a seek. Record decoder configurations,
  loading-pause count and duration, seeks, and peak retained decoded media.
- Confirm the same source samples and blend phase on both sides of the
  dissolve. Verify pause, seek, reverse, URL replacement, and hiding Preview
  still work, and that obsolete reads release their resources.
- Recommend a change only if it reduces decode work or stalls without
  materially increasing memory, seek latency, or regressions in playback.

## Comments

- Current performance is acceptable. This is a follow-up investigation,
  not a release blocker for #49.
- Triage: use the reader after [#76](76-keep-decodable-frames-before-hls-failure.md)
  and [#77](77-bound-preview-cache-across-renditions.md) as the comparison
  baseline. A measured recommendation is the deliverable; decoder reuse is
  not a required outcome.
- Benchmarked `0b3bfaa` against an isolated forward reader with independent
  source-time cursors for the two sides of a same-rendition dissolve. The
  prototype kept the window reader for seeks and reverse. Used static
  production Storybook and Chromium 158, with two alternating A/B pairs
  per fixture at normal speed and 4× CPU throttling.

  | Story at 4× | Decoder configurations, picture/sound (baseline → prototype) | Loading holds: count / total time |
  | --- | --- | --- |
  | Local cold | 7/7 → 3/2 | 1 / 84 ms → 1 / 150 ms |
  | Local replay | 7/7 → 2/2 | 1 / 36 ms → 1 / 64 ms |
  | Public HLS cold | 28/28 → 5/3 | 19 / 2.36 s → 2–3 / 0.53 s |
  | Public HLS replay | 28/28 → 3/3 | 18–19 / 2.61 s → 1–2 / 0.07 s |

- Public HLS replay submitted 2,517 → 498 picture decodes without new media
  responses in either arm. Both stories had only startup holds at normal
  speed. At 4×, a post-replay dissolve seek went from 20 → 81 ms locally and
  282 → 267 ms on Public HLS. On Public HLS replay, peak converted canvas
  and audio-buffer counts went from 90/72 → 82/38, but outstanding native
  picture and sound outputs increased from 3/3 → 10/10. These are object
  counts, not heap or GPU memory measurements.
- Sampled source times, pictures, blend weights, and audio-buffer timing
  matched across both dissolves and the local segment boundary. Local
  pause, seek, silent reverse, URL replacement, and hide checks passed.
  Hiding released tracked resources while the request was still blocked,
  but pause and seek could leave more decoders open until it resumed.
  Rapid-seek lifetime, worst-case multi-rendition memory, and bit-exact
  audio were not verified. Revisit only if Mux-class stalls warrant the
  work, and require warm seeks and prompt cancellation.
- Reproduction, experimental patch, and raw samples:
  `/tmp/opencode/issue66.AzKjt6/REPRO66.md`. Focused reader tests and typecheck
  passed in the snapshot. No prototype code shipped.
