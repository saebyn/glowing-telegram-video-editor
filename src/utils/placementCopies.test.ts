import { expect, it } from "vitest";
import type { Sequence, VideoClip } from "@/types";
import {
  copyPlacements,
  duplicatePlacements,
  pastePlacements,
  previewPlacementPaste,
} from "./placementCopies";

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
const layered: Sequence = {
  durationFrames: 65,
  tracks: [
    {
      id: "top",
      label: "Top",
      placements: [
        {
          id: "later",
          clipId: "clip",
          sequenceStartFrame: 30,
          sourceInOffsetFrames: -5,
          sourceOutOffsetFrames: 10,
        },
      ],
    },
    { id: "middle", label: "Middle", placements: [] },
    {
      id: "bottom",
      label: "Bottom",
      placements: [{ id: "earliest", clipId: "clip", sequenceStartFrame: 20 }],
    },
  ],
};

it("duplicates after the last selected exclusive end on the original tracks", () => {
  const result = duplicatePlacements(layered, clips, frameRate, ["later", "earliest"]);

  // The bottom placement starts earliest at 20; the trimmed top placement ends last at 65.
  expect(result).toMatchObject({
    durationFrames: 110,
    tracks: [
      { id: "top", placements: [{ sequenceStartFrame: 30 }, { sequenceStartFrame: 75 }] },
      { id: "middle", placements: [] },
      { id: "bottom", placements: [{ sequenceStartFrame: 20 }, { sequenceStartFrame: 65 }] },
    ],
  });
});

it("rejects an entire duplicate when a new placement would hit an unselected placement", () => {
  const sequence: Sequence = {
    durationFrames: 95,
    tracks: [
      layered.tracks[0],
      layered.tracks[1],
      {
        ...layered.tracks[2],
        placements: [
          ...layered.tracks[2].placements,
          { id: "blocker", clipId: "clip", sequenceStartFrame: 75 },
        ],
      },
    ],
  };

  // The same-track [65, 85) would intersect [75, 95), even though the next gap is free.
  expect(duplicatePlacements(sequence, clips, frameRate, ["later", "earliest"])).toBeNull();
});

it("rejects a duplicate if any destination track is locked", () => {
  const sequence: Sequence = {
    ...layered,
    tracks: [layered.tracks[0], layered.tracks[1], { ...layered.tracks[2], locked: true }],
  };
  expect(duplicatePlacements(sequence, clips, frameRate, ["later", "earliest"])).toBeNull();
});

it("duplicates authored trims and transitions with new IDs", () => {
  const placement = {
    ...layered.tracks[0].placements[0],
    transitionIn: { id: "entry", kind: "dissolve", durationFrames: 10 },
    transitionOut: { id: "reveal", kind: "fade", durationFrames: 6 },
  } as const;
  const sequence: Sequence = {
    ...layered,
    tracks: [{ ...layered.tracks[0], placements: [placement] }],
  };

  const placements = duplicatePlacements(sequence, clips, frameRate, ["later"])?.tracks[0]
    .placements;
  expect(placements?.[0]).toEqual(placement);
  expect(placements?.[1]).toMatchObject({
    clipId: "clip",
    sourceInOffsetFrames: -5,
    sourceOutOffsetFrames: 10,
    transitionIn: { kind: "dissolve", durationFrames: 10 },
    transitionOut: { kind: "fade", durationFrames: 6 },
  });
  const copy = placements![1];
  const ids = [copy.id, copy.transitionIn!.id, copy.transitionOut!.id];
  expect(ids).toEqual(Array(3).fill(expect.stringMatching(/\S/)));
  expect(new Set([...ids, "later", "entry", "reveal"]).size).toBe(6);
});

it("pastes the earliest frame and topmost track at independently positioned anchors", () => {
  const sequence: Sequence = {
    ...layered,
    tracks: [
      ...layered.tracks,
      { id: "fourth", label: "Fourth", placements: [] },
      { id: "fifth", label: "Fifth", placements: [] },
    ],
  };
  const copied = copyPlacements(sequence, clips, frameRate, ["later", "earliest"]);
  const result = pastePlacements(sequence, clips, frameRate, copied, {
    trackId: "middle",
    sequenceFrame: 13,
  });

  expect(result).toMatchObject({
    durationFrames: 65,
    tracks: [
      { id: "top", placements: [{ id: "later", sequenceStartFrame: 30 }] },
      { id: "middle", placements: [{ sequenceStartFrame: 23 }] },
      { id: "bottom", placements: [{ id: "earliest", sequenceStartFrame: 20 }] },
      { id: "fourth", placements: [{ sequenceStartFrame: 13 }] },
      { id: "fifth", placements: [] },
    ],
  });
});

it("preserves the copied effective source range after the reusable clip is retrimmed", () => {
  const copied = copyPlacements(layered, clips, frameRate, ["later"]);
  const retrimmed = [{ ...clips[0], sourceInFrame: 110, sourceOutFrame: 125 }];
  const result = pastePlacements(layered, retrimmed, frameRate, copied, {
    trackId: "middle",
    sequenceFrame: 65,
  });

  // The copied range was [95, 130), not the range implied by the old offsets on the new clip.
  expect(result).toMatchObject({
    durationFrames: 100,
    tracks: [
      { id: "top" },
      {
        id: "middle",
        placements: [{ clipId: "clip", sourceInOffsetFrames: -15, sourceOutOffsetFrames: 5 }],
      },
      { id: "bottom" },
    ],
  });
});

it("previews the exact blocked destination without shifting or vacating the originals", () => {
  const copied = copyPlacements(layered, clips, frameRate, ["later", "earliest"]);
  const target = { trackId: "top", sequenceFrame: 39 };

  expect(previewPlacementPaste(layered, clips, frameRate, copied, target)).toEqual({
    kind: "blocked",
    reason: "overlap",
    placements: [
      { trackId: "top", clipId: "clip", sequenceStartFrame: 49, duration: 35 },
      { trackId: "bottom", clipId: "clip", sequenceStartFrame: 39, duration: 20 },
    ],
  });
  expect(pastePlacements(layered, clips, frameRate, copied, target)).toBeNull();
});

it("rejects copied placements that would overlap each other on one destination track", () => {
  const sequence: Sequence = {
    ...layered,
    tracks: [
      {
        ...layered.tracks[0],
        placements: [
          layered.tracks[0].placements[0],
          { id: "overlapping", clipId: "clip", sequenceStartFrame: 60 },
        ],
      },
      layered.tracks[1],
    ],
  };
  const copied = copyPlacements(sequence, clips, frameRate, ["later", "overlapping"]);
  expect(
    pastePlacements(sequence, clips, frameRate, copied, { trackId: "middle", sequenceFrame: 0 }),
  ).toBeNull();
});

it("rejects a snapshot whose effective out point is no longer in the source", () => {
  const copied = copyPlacements(layered, clips, frameRate, ["later"]);
  const shortened = [{ ...clips[0], sourceDurationFrames: 129 }];
  expect(
    pastePlacements(layered, shortened, frameRate, copied, { trackId: "middle", sequenceFrame: 0 }),
  ).toBeNull();
});

it("previews a selection starting below the top track at frame zero, and reports missing tracks", () => {
  const sequence: Sequence = {
    durationFrames: 65,
    tracks: [{ id: "zero", label: "Zero", placements: [] }, ...layered.tracks],
  };
  const copied = copyPlacements(sequence, clips, frameRate, ["later", "earliest"]);
  expect(
    previewPlacementPaste(sequence, clips, frameRate, copied, {
      trackId: "zero",
      sequenceFrame: 0,
    }),
  ).toEqual({
    kind: "valid",
    placements: [
      { trackId: "zero", clipId: "clip", sequenceStartFrame: 10, duration: 35 },
      { trackId: "middle", clipId: "clip", sequenceStartFrame: 0, duration: 20 },
    ],
  });
  expect(
    previewPlacementPaste(sequence, clips, frameRate, copied, {
      trackId: "middle",
      sequenceFrame: 0,
    }),
  ).toMatchObject({ kind: "blocked", reason: "outside-tracks" });
  expect(
    previewPlacementPaste(sequence, clips, frameRate, copied, {
      trackId: "missing",
      sequenceFrame: 0,
    }),
  ).toMatchObject({ kind: "blocked", reason: "outside-tracks" });
});

it.each([-1, 0.5])("rejects %s as the pasted sequence frame", (sequenceFrame) => {
  const copied = copyPlacements(layered, clips, frameRate, ["later"]);
  expect(
    pastePlacements(layered, clips, frameRate, copied, { trackId: "middle", sequenceFrame }),
  ).toBeNull();
});
