import { expect, it } from "vitest";
import {
  compileCutList,
  type CutListResult,
  type CutListSource,
  type Sequence,
  type SequenceSource,
  type VideoClip,
} from "@/index";

it("compiles the same fade from render-only and full source records without loading presentation data", () => {
  const frameRate = { numerator: 30, denominator: 1 };
  const clips: readonly VideoClip[] = [
    {
      id: "harbor",
      sourceId: "harbor-recording",
      sourceFrameRate: frameRate,
      sourceInFrame: 20,
      sourceOutFrame: 50,
    },
  ];
  const sequence: Sequence = {
    durationFrames: 20,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "opening",
            clipId: "harbor",
            sequenceStartFrame: 0,
            sourceInOffsetFrames: 10,
            entryTransition: { id: "entrance", kind: "fade", durationFrames: 5 },
          },
        ],
      },
    ],
  };
  const renderSources: readonly CutListSource[] = [
    { id: "harbor-recording", s3Location: "s3://archive/harbor.mp4" },
  ];
  const fullSources: readonly SequenceSource[] = [
    {
      id: "harbor-recording",
      s3Location: "s3://archive/harbor.mp4",
      mediaKind: "video-only",
      previewHlsUrl: "https://preview.example/harbor/index.m3u8",
      frameThumbnails: [{ sourceFrame: 32, url: "https://preview.example/harbor/32.jpg" }],
    },
  ];
  const expected: CutListResult = {
    ok: true,
    issues: [],
    cutList: {
      version: "1.0.0",
      inputMedia: [
        { s3Location: "s3://archive/harbor.mp4", sections: [{ startFrame: 30, endFrame: 50 }] },
      ],
      outputTrack: [
        { mediaIndex: 0, sectionIndex: 0, transitionIn: { type: "fade", duration: 5 } },
      ],
    },
  };

  const lazyFullSources = fullSources.map(
    (source) =>
      new Proxy(source, {
        get(target, key, receiver) {
          if (key === "mediaKind" || key === "previewHlsUrl" || key === "frameThumbnails") {
            throw new Error(`Render-only compilation cannot load preview metadata: ${key}`);
          }
          return Reflect.get(target, key, receiver);
        },
      }),
  );

  expect(compileCutList(sequence, clips, renderSources, frameRate)).toStrictEqual(expected);
  expect(compileCutList(sequence, clips, fullSources, frameRate)).toStrictEqual(expected);
  expect(compileCutList(sequence, clips, lazyFullSources, frameRate)).toStrictEqual(expected);
});
