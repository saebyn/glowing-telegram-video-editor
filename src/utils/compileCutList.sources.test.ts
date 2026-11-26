import { expect, it } from "vitest";
import {
  compileCutList,
  type CutListResult,
  type CutListSource,
  type Sequence,
  type SequenceSource,
  type SourcesById,
  type VideoClip,
} from "@/index";

it("compiles two clips from the same source ID into ordered sections of one render source", () => {
  const frameRate = { numerator: 30, denominator: 1 };
  const clips: readonly VideoClip[] = [
    {
      id: "harbor",
      sourceId: "recording",
      sourceFrameRate: frameRate,
      sourceInFrame: 20,
      sourceOutFrame: 30,
    },
    {
      id: "departure",
      sourceId: "recording",
      sourceFrameRate: frameRate,
      sourceInFrame: 50,
      sourceOutFrame: 55,
    },
  ];
  const sequence: Sequence = {
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          { id: "opening", clipId: "harbor", sequenceStartFrame: 0 },
          { id: "closing", clipId: "departure", sequenceStartFrame: 10 },
        ],
      },
    ],
  };
  const sources = {
    unrelated: { s3Location: "s3://archive/unrelated.mp4" },
    recording: { s3Location: "s3://archive/shared.mp4" },
  };

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: true,
    issues: [],
    cutList: {
      version: "1.0.0",
      inputMedia: [
        {
          s3Location: "s3://archive/shared.mp4",
          sections: [
            { startFrame: 20, endFrame: 30 },
            { startFrame: 50, endFrame: 55 },
          ],
        },
      ],
      outputTrack: [
        { mediaIndex: 0, sectionIndex: 0 },
        { mediaIndex: 0, sectionIndex: 1 },
      ],
    },
  });
});

it("ends output at the last placement before and after a trailing trim or removal", () => {
  const frameRate = { numerator: 30, denominator: 1 };
  const clips = [
    {
      id: "harbor",
      sourceId: "recording",
      sourceFrameRate: frameRate,
      sourceInFrame: 20,
      sourceOutFrame: 30,
    },
    {
      id: "departure",
      sourceId: "recording",
      sourceFrameRate: frameRate,
      sourceInFrame: 50,
      sourceOutFrame: 60,
    },
  ];
  const sources = { recording: { s3Location: "s3://archive/harbor.mp4" } };
  const opening = { id: "opening", clipId: "harbor", sequenceStartFrame: 0 };
  const closing = { id: "closing", clipId: "departure", sequenceStartFrame: 10 };
  const cases = [
    {
      placements: [opening, closing],
      sections: [
        { startFrame: 20, endFrame: 30 },
        { startFrame: 50, endFrame: 60 },
      ],
      outputTrack: [
        { mediaIndex: 0, sectionIndex: 0 },
        { mediaIndex: 0, sectionIndex: 1 },
      ],
    },
    {
      placements: [opening, { ...closing, sourceOutOffsetFrames: -4 }],
      sections: [
        { startFrame: 20, endFrame: 30 },
        { startFrame: 50, endFrame: 56 },
      ],
      outputTrack: [
        { mediaIndex: 0, sectionIndex: 0 },
        { mediaIndex: 0, sectionIndex: 1 },
      ],
    },
    {
      placements: [opening],
      sections: [{ startFrame: 20, endFrame: 30 }],
      outputTrack: [{ mediaIndex: 0, sectionIndex: 0 }],
    },
  ];
  for (const { placements, sections, outputTrack } of cases) {
    const sequence: Sequence = { tracks: [{ id: "main", label: "Main", placements }] };
    expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
      ok: true,
      issues: [],
      cutList: {
        version: "1.0.0",
        inputMedia: [{ s3Location: "s3://archive/harbor.mp4", sections }],
        outputTrack,
      },
    });
  }
});

it("reports a missing source when metadata is inherited instead of owned by the record", () => {
  const frameRate = { numerator: 30, denominator: 1 };
  const clips = [
    {
      id: "harbor",
      sourceId: "constructor",
      sourceFrameRate: frameRate,
      sourceInFrame: 20,
      sourceOutFrame: 30,
    },
  ];
  const sequence: Sequence = {
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [{ id: "opening", clipId: "harbor", sequenceStartFrame: 0 }],
      },
    ],
  };
  const owned = { constructor: { s3Location: "s3://archive/harbor.mp4" } };
  const inherited: typeof owned = Object.create(owned);

  for (const sources of [{}, inherited]) {
    expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
      ok: false,
      issues: [{ code: "missing-source", placementId: "opening", sourceId: "constructor" }],
    });
  }
  expect(compileCutList(sequence, clips, owned, frameRate)).toMatchObject({
    ok: true,
    cutList: { inputMedia: [{ s3Location: "s3://archive/harbor.mp4" }] },
  });
});

const opaqueReferenceRate = { numerator: 30, denominator: 1 };
const opaqueReferenceClip = {
  id: "harbor",
  sourceId: "recording",
  sourceFrameRate: opaqueReferenceRate,
  sourceInFrame: 20,
  sourceOutFrame: 30,
};
const opaqueReferenceSequence: Sequence = {
  tracks: [
    {
      id: "main",
      label: "Main",
      placements: [{ id: "opening", clipId: "harbor", sequenceStartFrame: 0 }],
    },
  ],
};

it("reports a missing render source reference even when a Preview HLS URL is supplied", () => {
  // Model runtime host data that skipped the required TypeScript field.
  const source = { previewHlsUrl: "/preview/harbor/index.m3u8" } as unknown as CutListSource;
  expect(
    compileCutList(
      opaqueReferenceSequence,
      [opaqueReferenceClip],
      { recording: source },
      opaqueReferenceRate,
    ),
  ).toStrictEqual({
    ok: false,
    issues: [{ code: "missing-source", placementId: "opening", sourceId: "recording" }],
  });
});

it.each(["", "  ", "archive/recording:42"])("preserves the opaque render reference %j", (value) => {
  expect(
    compileCutList(
      opaqueReferenceSequence,
      [opaqueReferenceClip],
      { recording: { s3Location: value } },
      opaqueReferenceRate,
    ),
  ).toMatchObject({
    ok: true,
    issues: [],
    cutList: { inputMedia: [{ s3Location: value, sections: [{ startFrame: 20, endFrame: 30 }] }] },
  });
});

it("compiles both placement fades without changing the output shape or loading presentation data", () => {
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
            transitionIn: { id: "entrance", kind: "fade", durationFrames: 5 },
            transitionOut: { id: "reveal", kind: "fade", durationFrames: 3 },
          },
        ],
      },
    ],
  };
  const renderSources: SourcesById<CutListSource> = {
    "harbor-recording": { s3Location: "s3://archive/harbor.mp4" },
  };
  const fullSource: SequenceSource = {
    s3Location: "s3://archive/harbor.mp4",
    mediaKind: "video-only",
    previewHlsUrl: "https://preview.example/harbor/index.m3u8",
    frameThumbnails: [{ sourceFrame: 32, url: "https://preview.example/harbor/32.jpg" }],
  };
  const fullSources = { "harbor-recording": fullSource };
  const expected: CutListResult = {
    ok: true,
    issues: [],
    cutList: {
      version: "1.0.0",
      inputMedia: [
        { s3Location: "s3://archive/harbor.mp4", sections: [{ startFrame: 30, endFrame: 50 }] },
      ],
      outputTrack: [
        {
          mediaIndex: 0,
          sectionIndex: 0,
          transitionIn: { type: "fade", duration: 5 },
          transitionOut: { type: "fade", duration: 3 },
        },
      ],
    },
  };

  const lazyFullSources = {
    "harbor-recording": new Proxy(fullSource, {
      get(target, key, receiver) {
        if (key === "mediaKind" || key === "previewHlsUrl" || key === "frameThumbnails") {
          throw new Error(`Render-only compilation cannot load preview metadata: ${key}`);
        }
        return Reflect.get(target, key, receiver);
      },
    }),
  };

  expect(compileCutList(sequence, clips, renderSources, frameRate)).toStrictEqual(expected);
  expect(compileCutList(sequence, clips, fullSources, frameRate)).toStrictEqual(expected);
  expect(compileCutList(sequence, clips, lazyFullSources, frameRate)).toStrictEqual(expected);
});
