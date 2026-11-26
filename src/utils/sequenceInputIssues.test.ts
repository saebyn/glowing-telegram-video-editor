import { expect, it } from "vitest";
import type { ClipPlacement, Sequence, VideoClip } from "@/types";
import compileCutList, { analyzeSequence } from "./compileCutList";
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

function sequence(placements: readonly ClipPlacement[]): Sequence {
  return { tracks: [{ id: "main", label: "Main", placements }] };
}

it("derives the latest end across tracks from a locked, mixed-rate placement's effective range", () => {
  const mixedRateClip = {
    ...clip,
    id: "mixed",
    sourceFrameRate: { numerator: 24, denominator: 1 },
    sourceInFrame: 4,
    sourceOutFrame: 14,
  };
  const edit: Sequence = {
    tracks: [
      sequence([opening]).tracks[0],
      {
        id: "locked",
        label: "Locked",
        locked: true,
        placements: [
          {
            id: "last",
            clipId: "mixed",
            sequenceStartFrame: 21,
            sourceInOffsetFrames: -2,
            sourceOutOffsetFrames: -1,
            transitionOut: { id: "ending", kind: "dissolve", durationFrames: 8 },
          },
        ],
      },
      { id: "empty", label: "Empty", placements: [] },
    ],
  };
  // Effective [2, 13) is 11 native frames, rounded to 14 project frames; 21 + 14 = 35.
  expect(analyzeSequence(edit, [clip, mixedRateClip], {}, frameRate).durationFrames).toBe(35);
});

it("distinguishes zero duration from an unresolved layout with a valid placement", () => {
  for (const empty of [{ tracks: [] }, sequence([])]) {
    expect(analyzeSequence(empty, [clip], {}, frameRate).durationFrames).toBe(0);
  }
  const invalid = [
    { ...opening, id: "missing", clipId: "missing", sequenceStartFrame: 20 },
    { ...opening, id: "overlap", sequenceStartFrame: 5 },
    { ...opening, id: "negative", sequenceStartFrame: -1 },
    { ...opening, id: "unsafe", sequenceStartFrame: Number.MAX_SAFE_INTEGER - 5 },
    { ...opening, id: "trim", sequenceStartFrame: 20, sourceOutOffsetFrames: 11 },
  ];
  for (const placement of invalid) {
    expect(
      analyzeSequence(sequence([opening, placement]), [clip], {}, frameRate).durationFrames,
    ).toBeNull();
  }
});

it("reports malformed geometry without mistaking an unresolved layout for a sequence gap", () => {
  const issues = compileCutList(
    sequence([
      opening,
      { ...opening, id: "overlapping", sequenceStartFrame: 5 },
      { ...opening, id: "unsafe-end", sequenceStartFrame: Number.MAX_SAFE_INTEGER - 5 },
      { ...opening, id: "bad-start", sequenceStartFrame: -1 },
      { ...opening, id: "bad-trim", sequenceStartFrame: 20, sourceOutOffsetFrames: 11 },
    ]),
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
