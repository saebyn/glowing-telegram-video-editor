import { expect, it } from "vitest";
import type { ClipPlacement, Sequence, VideoClip } from "@/types";
import compileCutList from "./compileCutList";
import { getSequenceInputIssues } from "./sequenceInputIssues";

const frameRate = { numerator: 30, denominator: 1 };
const clip: VideoClip = {
  id: "harbor",
  sourceId: "recording",
  sourceFrameRate: frameRate,
  sourceInFrame: 20,
  sourceOutFrame: 30,
  sourceDurationFrames: 40,
};
const opening: ClipPlacement = { id: "opening", clipId: "harbor", sequenceStartFrame: 0 };

function sequence(placements: readonly ClipPlacement[], durationFrames = 20): Sequence {
  return { durationFrames, tracks: [{ id: "main", label: "Main", placements }] };
}

it("reports malformed geometry without mistaking an unresolved layout for a sequence gap", () => {
  const issues = compileCutList(
    sequence(
      [
        opening,
        { ...opening, id: "overlapping", sequenceStartFrame: 5 },
        { ...opening, id: "unsafe-end", sequenceStartFrame: Number.MAX_SAFE_INTEGER - 5 },
        { ...opening, id: "bad-start", sequenceStartFrame: -1 },
        { ...opening, id: "bad-trim", sequenceStartFrame: 20, sourceOutOffsetFrames: 11 },
      ],
      Number.MAX_SAFE_INTEGER,
    ),
    [clip],
    { recording: { s3Location: "s3://archive/harbor.mp4" } },
    frameRate,
  ).issues;

  expect(getSequenceInputIssues(issues)).toEqual([
    { code: "placement-outside-sequence", placementId: "bad-start" },
    {
      code: "track-overlap",
      trackId: "main",
      placementId: "overlapping",
      previousPlacementId: "opening",
    },
    {
      code: "invalid-source-range",
      placementId: "bad-trim",
      sourceInFrame: 20,
      sourceOutFrame: 41,
    },
    { code: "placement-outside-sequence", placementId: "unsafe-end" },
  ]);
  expect(issues).not.toContainEqual(expect.objectContaining({ code: "sequence-gap" }));
});

it("does not classify mixed rates, gaps, or unavailable render media as invalid host inputs", () => {
  const { issues } = compileCutList(
    sequence([{ ...opening, sequenceStartFrame: 5 }]),
    [{ ...clip, sourceFrameRate: { numerator: 60, denominator: 1 } }],
    {},
    frameRate,
  );

  expect(issues.map(({ code }) => code)).toEqual([
    "missing-source",
    "frame-rate-mismatch",
    "sequence-gap",
    "sequence-gap",
  ]);
  expect(getSequenceInputIssues(issues)).toEqual([]);
});

it("does not report an overlap between disjoint placements around an invalid start", () => {
  const { issues } = compileCutList(
    sequence([
      { ...opening, id: "closing", sequenceStartFrame: 10 },
      { ...opening, id: "bad-start", sequenceStartFrame: NaN },
      opening,
    ]),
    [clip],
    { recording: { s3Location: "s3://archive/harbor.mp4" } },
    frameRate,
  );

  expect(getSequenceInputIssues(issues)).toEqual([
    { code: "placement-outside-sequence", placementId: "bad-start" },
  ]);
});
