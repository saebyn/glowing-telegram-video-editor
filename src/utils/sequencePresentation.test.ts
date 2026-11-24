import { expect, test } from "vitest";
import type { Sequence, SequenceSource, SourcesById, VideoClip } from "@/types";
import { createSequencePresentation } from "./sequencePresentation";

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
    durationFrames: 12,
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
  const at = createSequencePresentation(
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
    durationFrames: 10,
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
  const at = createSequencePresentation(
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
    durationFrames: 20,
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
  const at = createSequencePresentation(
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
    durationFrames: 10,
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
  const at = createSequencePresentation(
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
    durationFrames: 20,
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
  const at = createSequencePresentation(
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
    durationFrames: 22,
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
  const at = createSequencePresentation(
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
    durationFrames: 2,
    tracks: [
      { id: "main", label: "Main", placements: [{ id: "a", clipId: "a", sequenceStartFrame: 0 }] },
    ],
  };
  // Two source frames at 6 fps end at 1/3 s, before the second sequence frame ends at 0.4 s.
  const at = createSequencePresentation(sequence, [clip("a", 0, 2, 6)], { a: source("a") }, rate);
  expect(at(1).picture).toEqual([{ sourceId: "a", time: 0.2, weight: 1 }]);
  expect(at(1).sound[0].length).toBeCloseTo(0.1333333);
});

test("entry and reveal fades on the same visible cut cannot both define it", () => {
  const sequence: Sequence = {
    durationFrames: 20,
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
  const at = createSequencePresentation(
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
    durationFrames: 12,
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
  const at = createSequencePresentation(
    sequence,
    [clip("a", 10, 14)],
    { a: source("a") },
    projectRate,
  );
  expect(at(5).picture).toEqual([{ sourceId: "a", time: 1.5, weight: 0.6875, extension: true }]);
  expect(at(8).picture).toEqual([]);
});
