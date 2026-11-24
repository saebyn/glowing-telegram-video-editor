# 66 — Reuse decoders across sequential Preview reads

Status: needs-triage
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
