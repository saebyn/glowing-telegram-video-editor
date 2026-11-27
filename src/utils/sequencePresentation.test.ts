import { expect, test } from "vitest";
import type { Sequence, SequenceSource, SourcesById, VideoClip } from "@/types";
import { createSequencePresentation } from "./sequencePresentation";
import { splitPlacementsAtPlayhead } from "./splitPlacement";

const projectRate = { numerator: 10, denominator: 1 };

function clip(id: string, sourceInFrame: number, sourceOutFrame: number, rate = 10): VideoClip {
  return {
    id,
    sourceId: id,
    sourceInFrame,
    sourceOutFrame,
    sourceFrameRate: { numerator: rate, denominator: 1 },
    sourceDurationFrames: 100,
  };
}

function source(
  id: string,
  mediaKind: SequenceSource["mediaKind"] = "audio-video",
): SequenceSource {
  return { s3Location: `s3://media/${id}`, previewHlsUrl: `/${id}.m3u8`, mediaKind };
}

test("resuming a covered mixed-rate placement samples its trimmed source range by elapsed time", () => {
  const sequence: Sequence = {
    tracks: [
      {
        id: "top",
        label: "Top",
        placements: [{ id: "cover", clipId: "b", sequenceStartFrame: 3 }],
      },
      {
        id: "bottom",
        label: "Bottom",
        placements: [{ id: "base", clipId: "a", sequenceStartFrame: 2, sourceInOffsetFrames: 2 }],
      },
    ],
  };
  const sources: SourcesById<SequenceSource> = { a: source("a"), b: source("b") };
  const { at } = createSequencePresentation(
    sequence,
    [clip("a", 11, 31, 20), clip("b", 0, 2)],
    sources,
    projectRate,
  );
  const frame = at(5);
  expect(frame.picture).toEqual([{ sourceId: "a", time: 0.95, weight: 1 }]);
});

test("the top sound and top picture can come from different tracks", () => {
  const sequence: Sequence = {
    tracks: [
      {
        id: "voice",
        label: "Voice",
        placements: [{ id: "v", clipId: "v", sequenceStartFrame: 0 }],
      },
      {
        id: "picture",
        label: "Picture",
        placements: [{ id: "p", clipId: "p", sequenceStartFrame: 0 }],
      },
      { id: "base", label: "Base", placements: [{ id: "b", clipId: "b", sequenceStartFrame: 0 }] },
    ],
  };
  const sources = { v: source("v", "audio-only"), p: source("p", "video-only"), b: source("b") };
  const { at } = createSequencePresentation(
    sequence,
    [clip("v", 10, 20), clip("p", 20, 30), clip("b", 0, 10)],
    sources,
    projectRate,
  );
  expect(at(5)).toEqual({
    picture: [{ sourceId: "p", time: 2.5, weight: 1 }],
    sound: [{ sourceId: "v", time: 1.5, weight: 1 }],
  });
});

test("a reveal uses the contribution that starts at the cut, not the underlying track", () => {
  const sequence: Sequence = {
    tracks: [
      {
        id: "top",
        label: "Top",
        placements: [
          {
            id: "outgoing",
            clipId: "b",
            sequenceStartFrame: 0,
            transitionOut: { id: "reveal", kind: "fade", durationFrames: 4 },
          },
          { id: "incoming", clipId: "c", sequenceStartFrame: 10 },
        ],
      },
      {
        id: "bed",
        label: "Bed",
        placements: [{ id: "bed", clipId: "a", sequenceStartFrame: 0 }],
      },
    ],
  };
  const { at } = createSequencePresentation(
    sequence,
    [clip("a", 0, 20), clip("b", 20, 30), clip("c", 10, 20)],
    { a: source("a"), b: source("b"), c: source("c") },
    projectRate,
  );
  expect(at(7)).toEqual({
    picture: [
      { sourceId: "b", time: 2.7, weight: 0.625 },
      { sourceId: "c", time: 0.7, weight: 0.375, extension: true },
    ],
    sound: [
      { sourceId: "b", time: 2.7, weight: 0.75, endWeight: 0.5 },
      { sourceId: "c", time: 0.7, weight: 0.25, endWeight: 0.5, extension: true },
    ],
  });
});

test("a dissolve clipped by sequence start retains its authored blend phase", () => {
  const sequence: Sequence = {
    tracks: [
      {
        id: "picture",
        label: "Picture",
        placements: [
          {
            id: "opening",
            clipId: "a",
            sequenceStartFrame: 0,
            transitionIn: { id: "opening-dissolve", kind: "dissolve", durationFrames: 5 },
          },
        ],
      },
    ],
  };
  const { at } = createSequencePresentation(
    sequence,
    [clip("a", 10, 20)],
    { a: source("a") },
    projectRate,
  );
  expect(at(0)).toEqual({
    picture: [{ sourceId: "a", time: 1, weight: 0.5 }],
    sound: [{ sourceId: "a", time: 1, weight: 0.4, endWeight: 0.6 }],
  });
});

test("a higher video-only cover masks a dissolve without retiming picture or sound", () => {
  const sequence: Sequence = {
    tracks: [
      {
        id: "cover",
        label: "Cover",
        placements: [{ id: "c", clipId: "c", sequenceStartFrame: 8 }],
      },
      {
        id: "edit",
        label: "Edit",
        placements: [
          { id: "a", clipId: "a", sequenceStartFrame: 0 },
          {
            id: "b",
            clipId: "b",
            sequenceStartFrame: 10,
            transitionIn: { id: "d", kind: "dissolve", durationFrames: 8 },
          },
        ],
      },
    ],
  };
  const { at } = createSequencePresentation(
    sequence,
    [clip("a", 0, 10), clip("b", 20, 30), clip("c", 30, 31)],
    { a: source("a"), b: source("b"), c: source("c", "video-only") },
    projectRate,
  );
  expect(at(8)).toEqual({
    picture: [{ sourceId: "c", time: 3, weight: 1 }],
    sound: [
      { sourceId: "a", time: 0.8, weight: 0.75, endWeight: 0.625 },
      { sourceId: "b", time: 1.8, weight: 0.25, endWeight: 0.375, extension: true },
    ],
  });
  expect(at(9).picture.map(({ sourceId, weight }) => [sourceId, weight])).toEqual([
    ["a", 0.5625],
    ["b", 0.4375],
  ]);
});

test("an intervening visible cut makes the dissolve undefined, but not the following edit", () => {
  const sequence: Sequence = {
    tracks: [
      {
        id: "edit",
        label: "Edit",
        placements: [
          { id: "a", clipId: "a", sequenceStartFrame: 0 },
          { id: "b", clipId: "b", sequenceStartFrame: 4 },
          {
            id: "c",
            clipId: "c",
            sequenceStartFrame: 8,
            transitionIn: { id: "d", kind: "dissolve", durationFrames: 10 },
          },
        ],
      },
    ],
  };
  const { at } = createSequencePresentation(
    sequence,
    [clip("a", 0, 4), clip("b", 10, 14), clip("c", 20, 34)],
    { a: source("a"), b: source("b"), c: source("c") },
    projectRate,
  );
  expect(at(7)).toMatchObject({ problem: "undefined-transition" });
  expect(at(13).picture).toEqual([{ sourceId: "c", time: 2.5, weight: 1 }]);
});

test("a rounded mixed-rate tail holds the last in-range picture and supplies only recorded sound", () => {
  const rate = { numerator: 5, denominator: 1 };
  const sequence: Sequence = {
    tracks: [
      { id: "main", label: "Main", placements: [{ id: "a", clipId: "a", sequenceStartFrame: 0 }] },
    ],
  };
  // Two source frames at 6 fps end at 1/3 s, before the second sequence frame ends at 0.4 s.
  const { at } = createSequencePresentation(
    sequence,
    [clip("a", 0, 2, 6)],
    { a: source("a") },
    rate,
  );
  expect(at(1).picture).toEqual([{ sourceId: "a", time: 0.2, weight: 1 }]);
  expect(at(1).sound[0].length).toBeCloseTo(0.1333333);
});

test("entry and reveal fades on the same visible cut cannot both define it", () => {
  const sequence: Sequence = {
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "a",
            clipId: "a",
            sequenceStartFrame: 0,
            transitionOut: { id: "leave", kind: "fade", durationFrames: 2 },
          },
          {
            id: "b",
            clipId: "b",
            sequenceStartFrame: 10,
            transitionIn: { id: "enter", kind: "fade", durationFrames: 2 },
          },
        ],
      },
    ],
  };
  const { at } = createSequencePresentation(
    sequence,
    [clip("a", 10, 20), clip("b", 30, 40)],
    { a: source("a"), b: source("b") },
    projectRate,
  );
  expect(at(9).problem).toBe("undefined-transition");
  expect(at(10).problem).toBe("undefined-transition");
});

test("a fade longer than its trimmed placement uses recorded material after the out point", () => {
  const sequence: Sequence = {
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "short",
            clipId: "a",
            sequenceStartFrame: 0,
            transitionIn: { id: "entry", kind: "fade", durationFrames: 8 },
          },
        ],
      },
    ],
  };
  const { at } = createSequencePresentation(
    sequence,
    [clip("a", 10, 14)],
    { a: source("a") },
    projectRate,
  );
  expect(at(5).picture).toEqual([{ sourceId: "a", time: 1.5, weight: 0.6875, extension: true }]);
  expect(at(8).picture).toEqual([]);
});

function expectEightFrameFade(
  at: ReturnType<typeof createSequencePresentation>["at"],
  frames: readonly (readonly [sequenceFrame: number, outgoingTime: number, incomingTime: number])[],
  extensionSourceId: "a" | "b",
) {
  // Picture samples the middle of each frame; sound ramps from its start to its end.
  // Each row gives picture weight, sound start and sound end, alternating a and b.
  const ramp = [
    [0.9375, 0.0625, 1, 0, 0.875, 0.125],
    [0.8125, 0.1875, 0.875, 0.125, 0.75, 0.25],
    [0.6875, 0.3125, 0.75, 0.25, 0.625, 0.375],
    [0.5625, 0.4375, 0.625, 0.375, 0.5, 0.5],
    [0.4375, 0.5625, 0.5, 0.5, 0.375, 0.625],
    [0.3125, 0.6875, 0.375, 0.625, 0.25, 0.75],
    [0.1875, 0.8125, 0.25, 0.75, 0.125, 0.875],
    [0.0625, 0.9375, 0.125, 0.875, 0, 1],
  ];
  for (const [i, [frame, outgoingTime, incomingTime]] of frames.entries()) {
    const [aPicture, bPicture, aStart, bStart, aEnd, bEnd] = ramp[i];
    const a = {
      sourceId: "a",
      time: expect.closeTo(outgoingTime, 9),
      ...(extensionSourceId === "a" ? { extension: true } : {}),
    };
    const b = {
      sourceId: "b",
      time: expect.closeTo(incomingTime, 9),
      ...(extensionSourceId === "b" ? { extension: true } : {}),
    };
    expect(at(frame), `sequence frame ${frame}`).toStrictEqual({
      picture: [
        { ...a, weight: aPicture },
        { ...b, weight: bPicture },
      ],
      sound: [
        { ...a, weight: aStart, endWeight: aEnd },
        { ...b, weight: bStart, endWeight: bEnd },
      ],
    });
  }
}

const fadeClips = [clip("a", 20, 30), clip("b", 50, 60)];
const fadeSources = { a: source("a"), b: source("b") };

function splitFade(edge: "entry" | "reveal") {
  const entry = edge === "entry";
  const fade = { id: edge, kind: "fade", durationFrames: 8 } as const;
  const sequence: Sequence = {
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "outgoing",
            clipId: "a",
            sequenceStartFrame: 0,
            ...(!entry && { transitionOut: fade }),
          },
          {
            id: "incoming",
            clipId: "b",
            sequenceStartFrame: 10,
            ...(entry && { transitionIn: fade }),
          },
        ],
      },
    ],
  };
  const split = splitPlacementsAtPlayhead(
    sequence,
    fadeClips,
    projectRate,
    [entry ? "incoming" : "outgoing"],
    entry ? 14 : 6,
    () => "right",
  );
  if (!split) throw new Error(`Expected to split four sequence frames into the ${edge} fade`);
  return split;
}

test("an entry fade preserves picture and sound through a source-continuous split", () => {
  const { at } = createSequencePresentation(
    splitFade("entry"),
    fadeClips,
    fadeSources,
    projectRate,
  );

  // Sequence [10, 18) blends source a [30, 38) into source b [50, 58) at 10 fps.
  expectEightFrameFade(
    at,
    [
      [10, 3.0, 5.0],
      [11, 3.1, 5.1],
      [12, 3.2, 5.2],
      [13, 3.3, 5.3],
      [14, 3.4, 5.4],
      [15, 3.5, 5.5],
      [16, 3.6, 5.6],
      [17, 3.7, 5.7],
    ],
    "a",
  );
});

test("a reveal fade preserves picture and sound through a source-continuous split", () => {
  const { at } = createSequencePresentation(
    splitFade("reveal"),
    fadeClips,
    fadeSources,
    projectRate,
  );

  // Sequence [2, 10) blends source a [22, 30) into source b [42, 50) at 10 fps.
  expectEightFrameFade(
    at,
    [
      [2, 2.2, 4.2],
      [3, 2.3, 4.3],
      [4, 2.4, 4.4],
      [5, 2.5, 4.5],
      [6, 2.6, 4.6],
      [7, 2.7, 4.7],
      [8, 2.8, 4.8],
      [9, 2.9, 4.9],
    ],
    "b",
  );
});

test("an entry fade is undefined across a visible cut that jumps within the same source", () => {
  const split = splitFade("entry");
  const [track] = split.tracks;
  const sequence: Sequence = {
    ...split,
    tracks: [
      {
        ...track,
        // Sequence [14, 20) now plays source b [74, 80) instead of [54, 60).
        placements: track.placements.map((placement) =>
          placement.id === "right"
            ? { ...placement, sourceInOffsetFrames: 24, sourceOutOffsetFrames: 20 }
            : placement,
        ),
      },
    ],
  };
  const { at } = createSequencePresentation(sequence, fadeClips, fadeSources, projectRate);

  for (const frame of [10, 11, 12, 13, 14, 15, 16, 17]) {
    expect(at(frame).problem, `sequence frame ${frame}`).toBe("undefined-transition");
  }
  const sample = { sourceId: "b", time: expect.closeTo(7.8, 9), weight: 1 };
  expect(at(18)).toStrictEqual({ picture: [sample], sound: [sample] });
});
