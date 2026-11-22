import { expect, it } from "vitest";
import type { Sequence, VideoClip } from "@/types";
import { evaluatePlacementMove } from "./sequence";

const frameRate = { numerator: 30, denominator: 1 };
const clips: readonly VideoClip[] = [
  {
    id: "clip",
    sourceId: "source",
    sourceInFrame: 100,
    sourceOutFrame: 120,
    sourceFrameRate: frameRate,
  },
];
const original: Sequence = {
  durationFrames: 100,
  tracks: [
    {
      id: "main",
      label: "Main",
      placements: [
        {
          id: "placement",
          clipId: "clip",
          sequenceStartFrame: 75,
          sourceInOffsetFrames: -2,
          sourceOutOffsetFrames: 3,
          entryTransitionFrames: 4,
          revealTransitionFrames: 6,
        },
      ],
    },
  ],
};

it("moves beyond the old endpoint and grows to the exclusive end of the effective source range", () => {
  const result = evaluatePlacementMove(original, clips, frameRate, "placement", "main", 107);
  expect(result.kind === "move" && result.sequence).toStrictEqual({
    durationFrames: 132,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "placement",
            clipId: "clip",
            sequenceStartFrame: 107,
            sourceInOffsetFrames: -2,
            sourceOutOffsetFrames: 3,
            entryTransitionFrames: 4,
            revealTransitionFrames: 6,
          },
        ],
      },
    ],
  });
});

it("vacates the entire moving selection before applying a shared frame and track shift", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      { id: "cutaways", label: "Cutaways", placements: [] },
      original.tracks[0],
      {
        id: "alternate",
        label: "Alternate",
        placements: [{ id: "second", clipId: "clip", sequenceStartFrame: 83 }],
      },
    ],
  };
  // Main's old [75, 100) would block the grabbed placement's new [90, 110).
  const result = evaluatePlacementMove(sequence, clips, frameRate, "second", "main", 90, [
    "placement",
    "second",
  ]);
  expect(result.kind === "move" && result.sequence).toStrictEqual({
    durationFrames: 110,
    tracks: [
      {
        id: "cutaways",
        label: "Cutaways",
        placements: [
          {
            id: "placement",
            clipId: "clip",
            sequenceStartFrame: 82,
            sourceInOffsetFrames: -2,
            sourceOutOffsetFrames: 3,
            entryTransitionFrames: 4,
            revealTransitionFrames: 6,
          },
        ],
      },
      {
        id: "main",
        label: "Main",
        placements: [{ id: "second", clipId: "clip", sequenceStartFrame: 90 }],
      },
      { id: "alternate", label: "Alternate", placements: [] },
    ],
  });
});

it("blocks moving a selection left if a member other than the grabbed placement crosses frame zero", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      original.tracks[0],
      {
        id: "alternate",
        label: "Alternate",
        placements: [{ id: "early", clipId: "clip", sequenceStartFrame: 20 }],
      },
    ],
  };
  // The grabbed placement would land at frame 54, but the other would start at -1.
  expect(
    evaluatePlacementMove(sequence, clips, frameRate, "placement", "main", 54, [
      "placement",
      "early",
    ]),
  ).toMatchObject({ kind: "blocked", reason: "negative-frame" });
});

it("blocks a group move if a member would land below the bottom track", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      original.tracks[0],
      {
        id: "alternate",
        label: "Alternate",
        placements: [{ id: "bottom", clipId: "clip", sequenceStartFrame: 0 }],
      },
    ],
  };
  // Main's placement could land on Alternate at frame 80; Alternate has no track below it.
  expect(
    evaluatePlacementMove(sequence, clips, frameRate, "placement", "alternate", 80, [
      "placement",
      "bottom",
    ]),
  ).toMatchObject({ kind: "blocked", reason: "outside-tracks" });
});

it("rejects a collision even if the move would extend the sequence by one frame", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      original.tracks[0],
      {
        id: "other",
        label: "Other",
        placements: [{ id: "stationary", clipId: "clip", sequenceStartFrame: 57 }],
      },
    ],
  };
  // The stationary placement ends at 77, so [76, 101) conflicts for one frame.
  expect(evaluatePlacementMove(sequence, clips, frameRate, "placement", "other", 76)).toMatchObject(
    { kind: "blocked", reason: "overlap" },
  );
  expect(sequence.durationFrames).toBe(100);
});

it("accepts an exact edge touch without shortening the sequence", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      {
        ...original.tracks[0],
        placements: [
          { id: "stationary", clipId: "clip", sequenceStartFrame: 0 },
          ...original.tracks[0].placements,
        ],
      },
    ],
  };
  const result = evaluatePlacementMove(sequence, clips, frameRate, "placement", "main", 20);
  expect(result.kind === "move" && result.sequence).toMatchObject({
    durationFrames: 100,
    tracks: [
      { placements: [{ id: "stationary", sequenceStartFrame: 0 }, { sequenceStartFrame: 20 }] },
    ],
  });
});

it.each([
  [-1, "negative-frame"],
  [2.5, "invalid-placement"],
])("rejects sequence frame %s as a destination", (frame, reason) => {
  expect(
    evaluatePlacementMove(original, clips, frameRate, "placement", "main", frame),
  ).toMatchObject({ kind: "blocked", reason });
});
