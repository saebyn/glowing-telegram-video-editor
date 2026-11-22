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

it("keeps a reveal fade on the upper section before the lower source resumes", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [
          { id: "placement-b", clipId: "b", sequenceStartFrame: 40, revealTransitionFrames: 10 },
        ],
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
      { mediaIndex: 1, sectionIndex: 0, transitionOut: { type: "fade", duration: 10 } },
      { mediaIndex: 0, sectionIndex: 1 },
    ],
  };

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual(expected);
});

it("follows a reveal with the uppermost placement starting at the same boundary", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [
          { id: "outgoing", clipId: "b", sequenceStartFrame: 40, revealTransitionFrames: 10 },
        ],
      },
      {
        id: "middle",
        label: "Middle",
        placements: [
          {
            id: "incoming",
            clipId: "b",
            sequenceStartFrame: 60,
            sourceInOffsetFrames: 5,
            sourceOutOffsetFrames: 5,
          },
        ],
      },
      {
        id: "lower",
        label: "Lower",
        placements: [{ id: "bed", clipId: "a", sequenceStartFrame: 0 }],
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
          { startFrame: 180, endFrame: 200 },
        ],
      },
      {
        s3Location: "s3://media/b.mp4",
        sections: [
          { startFrame: 500, endFrame: 520 },
          { startFrame: 505, endFrame: 525 },
        ],
      },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0, transitionOut: { type: "fade", duration: 10 } },
      { mediaIndex: 1, sectionIndex: 1 },
      { mediaIndex: 0, sectionIndex: 1 },
    ],
  };

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual(expected);
});

it("attaches an entry and a reveal fade to the distinct fragments containing their edges", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [
          { id: "previous", clipId: "b", sequenceStartFrame: 0 },
          { id: "cover", clipId: "b", sequenceStartFrame: 40 },
          { id: "next", clipId: "b", sequenceStartFrame: 80 },
        ],
      },
      {
        id: "lower",
        label: "Lower",
        placements: [
          {
            id: "placement-a",
            clipId: "a",
            sequenceStartFrame: 20,
            sourceOutOffsetFrames: -40,
            entryTransitionFrames: 20,
            revealTransitionFrames: 20,
          },
        ],
      },
    ],
  };
  const expected: CutList = {
    version: "1.0.0",
    inputMedia: [
      {
        s3Location: "s3://media/b.mp4",
        sections: [
          { startFrame: 500, endFrame: 520 },
          { startFrame: 500, endFrame: 520 },
          { startFrame: 500, endFrame: 520 },
        ],
      },
      {
        s3Location: "s3://media/a.mp4",
        sections: [
          { startFrame: 100, endFrame: 120 },
          { startFrame: 140, endFrame: 160 },
        ],
      },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0, transitionIn: { type: "fade", duration: 20 } },
      { mediaIndex: 0, sectionIndex: 1 },
      { mediaIndex: 1, sectionIndex: 1, transitionOut: { type: "fade", duration: 20 } },
      { mediaIndex: 0, sectionIndex: 2 },
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

it.each([
  ["a straight cut", {}],
  ["a reveal fade", { revealTransitionFrames: 10 }],
] as const)(
  "does not skip an uncovered gap after %s to reach a placement on another track",
  (_, transition) => {
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
          placements: [{ id: "placement-a", clipId: "a", sequenceStartFrame: 0, ...transition }],
        },
      ],
    };

    expect(compileCutList(sequence, clips, sources, frameRate)).toBeNull();
  },
);

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

it("compiles the same entry and reveal fades with or without empty tracks above and below", () => {
  const main = {
    id: "main",
    label: "Main",
    placements: [
      { id: "placement-a", clipId: "a", sequenceStartFrame: 0, revealTransitionFrames: 15 },
      { id: "placement-b", clipId: "b", sequenceStartFrame: 100, entryTransitionFrames: 5 },
    ],
  };
  const sequence: Sequence = { durationFrames: 120, tracks: [main] };
  const padded: Sequence = {
    ...sequence,
    tracks: [
      { id: "upper", label: "Upper", placements: [] },
      main,
      { id: "lower", label: "Lower", placements: [] },
    ],
  };
  const expected: CutList = {
    version: "1.0.0",
    inputMedia: [
      { s3Location: "s3://media/a.mp4", sections: [{ startFrame: 100, endFrame: 200 }] },
      { s3Location: "s3://media/b.mp4", sections: [{ startFrame: 500, endFrame: 520 }] },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0, transitionOut: { type: "fade", duration: 15 } },
      { mediaIndex: 1, sectionIndex: 0, transitionIn: { type: "fade", duration: 5 } },
    ],
  };

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual(expected);
  expect(compileCutList(padded, clips, sources, frameRate)).toStrictEqual(expected);
});

it("does not silently discard a reveal fade on a covered track", () => {
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
          {
            id: "placement-b",
            clipId: "b",
            sequenceStartFrame: 40,
            revealTransitionFrames: 10,
          },
        ],
      },
    ],
  };

  expect(compileCutList(sequence, clips, sources, frameRate)).toBeNull();
});

it("rejects a reveal fade when the visible trailing fragment is shorter than the fade", () => {
  const sequence: Sequence = {
    durationFrames: 120,
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [
          { id: "cover", clipId: "b", sequenceStartFrame: 75 },
          { id: "next", clipId: "b", sequenceStartFrame: 100 },
        ],
      },
      {
        id: "lower",
        label: "Lower",
        placements: [
          { id: "outgoing", clipId: "a", sequenceStartFrame: 0, revealTransitionFrames: 20 },
        ],
      },
    ],
  };

  // The fade spans [80, 100), but the outgoing placement is only visible again at 95.
  expect(compileCutList(sequence, clips, sources, frameRate)).toBeNull();
});

it("rejects an entry fade when the visible leading fragment is shorter than the fade", () => {
  const sequence: Sequence = {
    durationFrames: 120,
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [
          { id: "previous", clipId: "b", sequenceStartFrame: 0 },
          { id: "cover", clipId: "b", sequenceStartFrame: 25 },
        ],
      },
      {
        id: "lower",
        label: "Lower",
        placements: [
          { id: "incoming", clipId: "a", sequenceStartFrame: 20, entryTransitionFrames: 20 },
        ],
      },
    ],
  };

  // The fade spans [20, 40), but the incoming placement is covered starting at 25.
  expect(compileCutList(sequence, clips, sources, frameRate)).toBeNull();
});

it("does not compile entry and reveal fades whose regions intersect", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "placement-a",
            clipId: "a",
            sequenceStartFrame: 0,
            entryTransitionFrames: 60,
            revealTransitionFrames: 50,
          },
        ],
      },
    ],
  };

  expect(compileCutList(sequence, clips, sources, frameRate)).toBeNull();
});

it("retains entry and reveal fades that meet without intersecting", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "placement-a",
            clipId: "a",
            sequenceStartFrame: 0,
            entryTransitionFrames: 40,
            revealTransitionFrames: 60,
          },
        ],
      },
    ],
  };
  const expected: CutList = {
    version: "1.0.0",
    inputMedia: [
      { s3Location: "s3://media/a.mp4", sections: [{ startFrame: 100, endFrame: 200 }] },
    ],
    outputTrack: [
      {
        mediaIndex: 0,
        sectionIndex: 0,
        transitionIn: { type: "fade", duration: 40 },
        transitionOut: { type: "fade", duration: 60 },
      },
    ],
  };

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual(expected);
});

it.each([
  ["zero-frame entry", { entryTransitionFrames: 0 }],
  ["fractional-frame reveal", { revealTransitionFrames: 2.5 }],
] as const)("rejects a %s fade even when its edge is visible", (_, transition) => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [{ id: "placement-b", clipId: "b", sequenceStartFrame: 40, ...transition }],
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
