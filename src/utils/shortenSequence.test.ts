import { expect, it } from "vitest";
import type { Sequence, VideoClip } from "@/types";
import { shortenSequence } from "./shortenSequence";

const frameRate = { numerator: 30, denominator: 1 };
const clips: VideoClip[] = [
  {
    id: "short",
    sourceId: "source",
    sourceFrameRate: frameRate,
    sourceInFrame: 100,
    sourceOutFrame: 110,
  },
  {
    id: "wide",
    sourceId: "source",
    sourceFrameRate: frameRate,
    sourceInFrame: 100,
    sourceOutFrame: 120,
  },
];
const sequence: Sequence = {
  durationFrames: 100,
  tracks: [
    { id: "top", label: "Top", placements: [] },
    {
      id: "main",
      label: "Main",
      placements: [{ id: "first", clipId: "wide", sequenceStartFrame: 10 }],
    },
    {
      id: "alternate",
      label: "Alternate",
      placements: [
        { id: "last", clipId: "wide", sequenceStartFrame: 50, sourceOutOffsetFrames: 5 },
      ],
    },
  ],
};

it("shortens to the latest exclusive placement end without moving any placements", () => {
  expect(shortenSequence(sequence, clips, frameRate, 75)).toStrictEqual({
    durationFrames: 75,
    tracks: sequence.tracks,
  });
});

it("rejects an endpoint one frame before the end of a trimmed placement on another track", () => {
  expect(shortenSequence(sequence, clips, frameRate, 74)).toBeNull();
});

it.each([100, 101, 75.5, -1])("rejects %s as an explicit shortening endpoint", (endFrame) => {
  expect(
    shortenSequence({ durationFrames: 100, tracks: [] }, clips, frameRate, endFrame),
  ).toBeNull();
});

it("can remove all uncovered time from an empty sequence", () => {
  expect(shortenSequence({ durationFrames: 100, tracks: [] }, clips, frameRate, 0)).toStrictEqual({
    durationFrames: 0,
    tracks: [],
  });
});

it("cannot shorten when a placement's duration cannot be resolved", () => {
  expect(shortenSequence(sequence, [], frameRate, 75)).toBeNull();
});

it("cannot shorten when a placement has an invalid source frame rate", () => {
  const malformed = { ...clips[1], sourceFrameRate: { numerator: 30, denominator: 0 } };
  expect(shortenSequence(sequence, [malformed], frameRate, 80)).toBeNull();
});
