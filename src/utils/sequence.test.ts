import type { CutList } from "@saebyn/glowing-telegram-types";
import { expect, it } from "vitest";
import type { Sequence, SequenceSource, VideoClip } from "@/types";
import { compileCutList } from "./sequence";

const frameRate = { numerator: 30, denominator: 1 };
const clips: readonly VideoClip[] = [
  {
    id: "a",
    sourceId: "source-a",
    sourceInFrame: 100,
    sourceOutFrame: 200,
    sourceFrameRate: frameRate,
  },
  {
    id: "b",
    sourceId: "source-b",
    sourceInFrame: 500,
    sourceOutFrame: 520,
    sourceFrameRate: frameRate,
  },
];
const sources: readonly SequenceSource[] = [
  { id: "source-a", s3Location: "s3://media/a.mp4" },
  { id: "source-b", s3Location: "s3://media/b.mp4" },
];

it("uses the upper placement during overlap and resumes the lower source in sequence time", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [{ id: "placement-b", clipId: "b", sequenceStartFrame: 40 }],
      },
      {
        id: "lower",
        label: "Lower",
        placements: [{ id: "placement-a", clipId: "a", sequenceStartFrame: 0 }],
      },
    ],
  };

  const expected: CutList = {
    version: "1.0.0",
    inputMedia: [
      {
        s3Location: "s3://media/a.mp4",
        sections: [
          { startFrame: 100, endFrame: 140 },
          { startFrame: 160, endFrame: 200 },
        ],
      },
      {
        s3Location: "s3://media/b.mp4",
        sections: [{ startFrame: 500, endFrame: 520 }],
      },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0 },
      { mediaIndex: 0, sectionIndex: 1 },
    ],
  };
  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual(expected);
});

it("does not split upper cuts at the boundaries of a covered placement", () => {
  const sequence: Sequence = {
    durationFrames: 120,
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [
          { id: "placement-a", clipId: "a", sequenceStartFrame: 0 },
          { id: "placement-b", clipId: "b", sequenceStartFrame: 100 },
        ],
      },
      {
        id: "lower",
        label: "Lower",
        placements: [{ id: "placement-b-lower", clipId: "b", sequenceStartFrame: 90 }],
      },
    ],
  };

  const expected: CutList = {
    version: "1.0.0",
    inputMedia: [
      { s3Location: "s3://media/a.mp4", sections: [{ startFrame: 100, endFrame: 200 }] },
      { s3Location: "s3://media/b.mp4", sections: [{ startFrame: 500, endFrame: 520 }] },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0 },
    ],
  };
  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual(expected);
});

it("rejects overlap on one track even when an upper placement covers it", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [{ id: "placement-a", clipId: "a", sequenceStartFrame: 0 }],
      },
      {
        id: "lower",
        label: "Lower",
        placements: [
          { id: "placement-b1", clipId: "b", sequenceStartFrame: 10 },
          { id: "placement-b2", clipId: "b", sequenceStartFrame: 20 },
        ],
      },
    ],
  };

  expect(compileCutList(sequence, clips, sources, frameRate)).toBeNull();
});

it("rejects an uncovered gap between placements on different tracks", () => {
  const sequence: Sequence = {
    durationFrames: 140,
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [{ id: "placement-b", clipId: "b", sequenceStartFrame: 120 }],
      },
      {
        id: "lower",
        label: "Lower",
        placements: [{ id: "placement-a", clipId: "a", sequenceStartFrame: 0 }],
      },
    ],
  };

  expect(compileCutList(sequence, clips, sources, frameRate)).toBeNull();
});

it("rejects an uncovered tail rather than shortening the sequence", () => {
  const sequence: Sequence = {
    durationFrames: 120,
    tracks: [
      {
        id: "lower",
        label: "Lower",
        placements: [{ id: "placement-a", clipId: "a", sequenceStartFrame: 0 }],
      },
    ],
  };

  expect(compileCutList(sequence, clips, sources, frameRate)).toBeNull();
});

it("has no CutList for an empty sequence", () => {
  const sequence: Sequence = {
    durationFrames: 0,
    tracks: [{ id: "upper", label: "Upper", placements: [] }],
  };

  expect(compileCutList(sequence, clips, sources, frameRate)).toBeNull();
});

it("rejects a placement whose source rate differs from the project rate", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      {
        id: "lower",
        label: "Lower",
        placements: [{ id: "placement-a", clipId: "a", sequenceStartFrame: 0 }],
      },
    ],
  };

  expect(compileCutList(sequence, clips, sources, { numerator: 30, denominator: 2 })).toBeNull();
});
