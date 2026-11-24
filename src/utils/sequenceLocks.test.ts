import { expect, test } from "vitest";
import type { Sequence, VideoClip } from "@/types";
import compileCutList from "./compileCutList";
import { evaluatePlacementMove, evaluatePoolDrop } from "./placementDrag";
import { evaluateTransitionEdit, removePlacementTransition } from "./placementTransition";
import { toggleSequenceTrackLock } from "./sequenceTracks";
import { canSplitPlacementsAtPlayhead, splitPlacementsAtPlayhead } from "./splitPlacement";
import { applyLeadingTrim, applyTrailingTrim } from "./trimPlacement";

const frameRate = { numerator: 30, denominator: 1 };
const harbor: VideoClip = {
  id: "harbor",
  sourceId: "harbor-media",
  sourceFrameRate: frameRate,
  sourceInFrame: 20,
  sourceOutFrame: 50,
  sourceDurationFrames: 100,
};
const sources = {
  "harbor-media": {
    s3Location: "s3://media/harbor.mp4",
    previewHlsUrl: "/fixtures/harbor.m3u8",
  },
};
const overlay = { id: "over", clipId: "harbor", sequenceStartFrame: 0 };
const bed = { id: "under", clipId: "harbor", sequenceStartFrame: 0 };
const sequence: Sequence = {
  durationFrames: 30,
  tracks: [
    { id: "top", label: "Top", locked: true, placements: [overlay] },
    { id: "middle", label: "Middle", placements: [bed] },
    { id: "bottom", label: "Bottom", placements: [] },
  ],
};

test("lock is authored on the intended track but does not change the compiled result", () => {
  const next = toggleSequenceTrackLock(sequence, "middle")!;
  expect(next).toEqual({
    ...sequence,
    tracks: [sequence.tracks[0], { ...sequence.tracks[1], locked: true }, sequence.tracks[2]],
  });
  expect(toggleSequenceTrackLock(next, "middle")?.tracks[1].locked).toBe(false);
  expect(toggleSequenceTrackLock(next, "missing")).toBeNull();
  const expected = {
    version: "1.0.0",
    inputMedia: [
      { s3Location: "s3://media/harbor.mp4", sections: [{ startFrame: 20, endFrame: 50 }] },
    ],
    outputTrack: [{ mediaIndex: 0, sectionIndex: 0 }],
  };
  expect(compileCutList(sequence, [harbor], sources, frameRate)).toEqual({
    ok: true,
    cutList: expected,
    issues: [],
  });
  expect(compileCutList(next, [harbor], sources, frameRate)).toEqual({
    ok: true,
    cutList: expected,
    issues: [],
  });
});

test("a lock blocks whole group moves out of the track and any move or drop into it", () => {
  expect(
    evaluatePlacementMove(sequence, [harbor], frameRate, "under", "middle", 10, ["under", "over"]),
  ).toMatchObject({ kind: "blocked", reason: "locked-track", trackId: "top" });
  expect(evaluatePlacementMove(sequence, [harbor], frameRate, "over", "bottom", 35)).toMatchObject({
    kind: "blocked",
    reason: "locked-track",
    trackId: "top",
  });
  expect(evaluatePlacementMove(sequence, [harbor], frameRate, "under", "top", 35)).toMatchObject({
    kind: "blocked",
    reason: "locked-track",
    trackId: "top",
  });
  expect(evaluatePoolDrop(sequence, [harbor], frameRate, harbor.id, "top", 35)).toEqual({
    kind: "blocked",
    reason: "locked",
    duration: 30,
    sequenceStartFrame: 35,
  });
});

test("locked placements reject trims and transition edits", () => {
  expect(applyLeadingTrim(sequence, [harbor], frameRate, "over", 21)).toBeNull();
  expect(applyTrailingTrim(sequence, [harbor], frameRate, "over", 49)).toBeNull();
  const existing = {
    ...sequence,
    tracks: [
      {
        ...sequence.tracks[0],
        placements: [
          {
            ...overlay,
            entryTransition: { id: "locked-fade", kind: "fade", durationFrames: 10 } as const,
          },
        ],
      },
      ...sequence.tracks.slice(1),
    ],
  };
  for (const kind of ["fade", "dissolve"] as const) {
    expect(
      evaluateTransitionEdit(existing, [harbor], sources, frameRate, {
        placementId: "over",
        edge: "leading",
        transition: { kind, durationFrames: 8 },
      }),
    ).toEqual({ kind: "locked" });
  }
  expect(removePlacementTransition(existing, "over", "leading")).toBeNull();
});

test("the playhead split ignores locked targets even when they cover unlocked targets", () => {
  expect(canSplitPlacementsAtPlayhead(sequence, [harbor], frameRate, ["over"], 10)).toBe(false);
  expect(canSplitPlacementsAtPlayhead(sequence, [harbor], frameRate, ["over", "under"], 10)).toBe(
    true,
  );
  expect(
    splitPlacementsAtPlayhead(sequence, [harbor], frameRate, ["over", "under"], 10, () => "right"),
  ).toEqual({
    ...sequence,
    tracks: [
      sequence.tracks[0],
      {
        ...sequence.tracks[1],
        placements: [
          { ...bed, sourceOutOffsetFrames: -20 },
          { ...bed, id: "right", sequenceStartFrame: 10, sourceInOffsetFrames: 10 },
        ],
      },
      sequence.tracks[2],
    ],
  });
});
