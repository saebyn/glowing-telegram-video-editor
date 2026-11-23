import harborThumbnail from "@/fixtures/sequence-harbor.svg?no-inline";
import lighthouseThumbnail from "@/fixtures/sequence-lighthouse.svg?no-inline";
import { sampleFrameRate } from "@/fixtures/video";
import type { SequenceSource, VideoClip } from "@/types";

// Local fixtures: the source locations are identifiers only, not playback URLs.
export const sequenceStoryMedia = {
  clips: [
    {
      id: "harbor",
      sourceId: "harbor-recording",
      sourceFrameRate: sampleFrameRate,
      sourceDurationFrames: 1_000,
      sourceInFrame: 114,
      sourceOutFrame: 234,
      keyframeSrc: harborThumbnail,
    },
    {
      id: "lighthouse",
      sourceId: "lighthouse-recording",
      sourceFrameRate: sampleFrameRate,
      sourceDurationFrames: 1_000,
      sourceInFrame: 501,
      sourceOutFrame: 621,
      keyframeSrc: lighthouseThumbnail,
    },
    {
      id: "ambience",
      sourceId: "harbor-audio",
      sourceFrameRate: sampleFrameRate,
      sourceInFrame: 0,
      sourceOutFrame: 240,
    },
  ] satisfies VideoClip[],
  sources: [
    {
      id: "harbor-recording",
      s3Location: "s3://sequence-fixtures/harbor.mp4",
      mediaKind: "audio-video",
      keyframes: [{ sourceFrame: 114, url: harborThumbnail }],
    },
    {
      id: "lighthouse-recording",
      s3Location: "s3://sequence-fixtures/lighthouse.mp4",
      mediaKind: "video-only",
      keyframes: [{ sourceFrame: 501, url: lighthouseThumbnail }],
    },
    {
      id: "harbor-audio",
      s3Location: "s3://sequence-fixtures/harbor.wav",
      mediaKind: "audio-only",
    },
  ] satisfies SequenceSource[],
  titles: { harbor: "Harbor", lighthouse: "Lighthouse", ambience: "Harbor ambience" },
};
