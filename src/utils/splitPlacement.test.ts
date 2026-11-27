import { expect, test } from "vitest";
import type { FrameRate, Sequence, VideoClip } from "@/types";
import { splitPlacementsAtPlayhead } from "./splitPlacement";

const frameRate: FrameRate = { numerator: 24, denominator: 1 };
const harbor: VideoClip = {
  id: "harbor",
  sourceId: "harbor-recording",
  sourceFrameRate: frameRate,
  sourceInFrame: 100,
  sourceOutFrame: 140,
  sourceDurationFrames: 200,
};
const opening = {
  id: "opening",
  clipId: "harbor",
  sequenceStartFrame: 20,
  sourceInOffsetFrames: -5,
  sourceOutOffsetFrames: 3,
};
const sequence: Sequence = {
  tracks: [{ id: "main", label: "Main", placements: [opening] }],
};

test("splitting a trimmed placement preserves its source alignment on both sides", () => {
  const split = splitPlacementsAtPlayhead(
    sequence,
    [harbor],
    frameRate,
    ["opening"],
    32,
    () => "right",
  );

  // Sequence [20, 68) plays source [95, 143); sequence frame 32 is source frame 107.
  expect(split).toStrictEqual({
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "opening",
            clipId: "harbor",
            sequenceStartFrame: 20,
            sourceInOffsetFrames: -5,
            sourceOutOffsetFrames: -33,
          },
          {
            id: "right",
            clipId: "harbor",
            sequenceStartFrame: 32,
            sourceInOffsetFrames: 7,
            sourceOutOffsetFrames: 3,
          },
        ],
      },
    ],
  });
  expect(sequence.tracks[0].placements).toStrictEqual([
    {
      id: "opening",
      clipId: "harbor",
      sequenceStartFrame: 20,
      sourceInOffsetFrames: -5,
      sourceOutOffsetFrames: 3,
    },
  ]);
});

test("a selection that only meets the playhead at its edges produces no edit", () => {
  const touching: Sequence = {
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          { id: "first", clipId: "harbor", sequenceStartFrame: 0 },
          { id: "second", clipId: "harbor", sequenceStartFrame: 40 },
        ],
      },
    ],
  };
  const allocatePlacementId = () => {
    throw new Error("No split should allocate a placement ID");
  };

  expect(
    splitPlacementsAtPlayhead(
      touching,
      [harbor],
      frameRate,
      ["first", "second"],
      40,
      allocatePlacementId,
    ),
  ).toBeNull();
});

test("a placement cannot split between whole sequence frames", () => {
  expect(
    splitPlacementsAtPlayhead(sequence, [harbor], frameRate, ["opening"], 32.5, () => "right"),
  ).toBeNull();
});

test("a split requires exact matching rates, including equivalent rate fractions", () => {
  const projectRate = { numerator: 72, denominator: 3 };
  const equivalent = { ...harbor, sourceFrameRate: { numerator: 48, denominator: 2 } };
  const mixed = { ...harbor, sourceFrameRate: { numerator: 25, denominator: 1 } };
  const allocatePlacementId = () => "right";

  expect(
    splitPlacementsAtPlayhead(
      sequence,
      [equivalent],
      projectRate,
      ["opening"],
      32,
      allocatePlacementId,
    ),
  ).not.toBeNull();
  expect(
    splitPlacementsAtPlayhead(sequence, [mixed], projectRate, ["opening"], 32, allocatePlacementId),
  ).toBeNull();
});

test("a split keeps the full fade and its ID at each original edge", () => {
  const transitionIn = { id: "enter-opening", kind: "fade", durationFrames: 20 } as const;
  const transitionOut = { id: "reveal-opening", kind: "fade", durationFrames: 11 } as const;
  const withFades: Sequence = {
    ...sequence,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [{ ...opening, transitionIn, transitionOut }],
      },
    ],
  };
  const transitions = (playheadFrame: number) =>
    splitPlacementsAtPlayhead(
      withFades,
      [harbor],
      frameRate,
      ["opening"],
      playheadFrame,
      () => "right",
    )?.tracks[0].placements.map(({ transitionIn, transitionOut }) => [transitionIn, transitionOut]);

  expect(transitions(28)).toStrictEqual([
    [transitionIn, undefined],
    [undefined, transitionOut],
  ]);
  expect(transitions(62)).toStrictEqual([
    [transitionIn, undefined],
    [undefined, transitionOut],
  ]);
});

test("only selected placements spanning the playhead at the project rate split in one edit", () => {
  const later = { id: "later", clipId: "harbor", sequenceStartFrame: 68 };
  const paired = { id: "paired", clipId: "harbor", sequenceStartFrame: 6 };
  const unselected = { id: "unselected", clipId: "harbor", sequenceStartFrame: 10 };
  const touching = { id: "touching", clipId: "harbor", sequenceStartFrame: 32 };
  const offRate = { id: "off-rate", clipId: "off-rate-clip", sequenceStartFrame: 10 };
  const mixedClip = {
    ...harbor,
    id: "off-rate-clip",
    sourceFrameRate: { numerator: 25, denominator: 1 },
  };
  const unselectedTrack = { id: "unselected-track", label: "Unselected", placements: [unselected] };
  const touchingTrack = { id: "touching-track", label: "Touching", placements: [touching] };
  const offRateTrack = { id: "off-rate-track", label: "Off rate", placements: [offRate] };
  const layered: Sequence = {
    tracks: [
      { id: "main", label: "Main", placements: [opening, later] },
      { id: "overlay", label: "Overlay", placements: [paired] },
      unselectedTrack,
      touchingTrack,
      offRateTrack,
    ],
  };
  const newIds = ["opening-right", "paired-right"];
  const split = splitPlacementsAtPlayhead(
    layered,
    [mixedClip, harbor],
    frameRate,
    ["opening", "paired", "touching", "off-rate"],
    32,
    () => {
      const id = newIds.shift();
      if (!id) throw new Error("Only the two eligible placements need new IDs");
      return id;
    },
  );

  // The overlay starts at sequence 6 and source 100, so its right half starts at source 126.
  expect(split).toStrictEqual({
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          { ...opening, sourceOutOffsetFrames: -33 },
          {
            id: "opening-right",
            clipId: "harbor",
            sequenceStartFrame: 32,
            sourceInOffsetFrames: 7,
            sourceOutOffsetFrames: 3,
          },
          later,
        ],
      },
      {
        id: "overlay",
        label: "Overlay",
        placements: [
          { ...paired, sourceOutOffsetFrames: -14 },
          {
            id: "paired-right",
            clipId: "harbor",
            sequenceStartFrame: 32,
            sourceInOffsetFrames: 26,
          },
        ],
      },
      unselectedTrack,
      touchingTrack,
      offRateTrack,
    ],
  });
});

test("a selection with a clip missing from the pool leaves that placement intact", () => {
  const missing = { id: "missing", clipId: "unavailable", sequenceStartFrame: 68 };
  const withMissing: Sequence = {
    ...sequence,
    tracks: [{ ...sequence.tracks[0], placements: [opening, missing] }],
  };

  const split = splitPlacementsAtPlayhead(
    withMissing,
    [harbor],
    frameRate,
    ["opening", "missing"],
    32,
    () => "right",
  );
  expect(split?.tracks[0].placements.map(({ id }) => id)).toStrictEqual([
    "opening",
    "right",
    "missing",
  ]);
  expect(split?.tracks[0].placements[2]).toStrictEqual(missing);
});
