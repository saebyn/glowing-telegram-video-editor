import { expect, test } from "vitest";
import type { FrameRate, Sequence, VideoClip } from "@/types";
import { applyLeadingTrim, applyTrailingTrim } from "./trimPlacement";

const frameRate: FrameRate = { numerator: 24, denominator: 1 };
const clip: VideoClip = {
  id: "harbor",
  sourceId: "harbor-recording",
  sourceFrameRate: frameRate,
  sourceInFrame: 100,
  sourceOutFrame: 140,
  sourceDurationFrames: 200,
};

const placement = { id: "open", clipId: "harbor", sequenceStartFrame: 20 };
const sequence: Sequence = {
  durationFrames: 60,
  tracks: [{ id: "main", label: "Main", placements: [placement] }],
};

test("the exclusive source endpoint can grow the sequence but the trim cannot go beyond it", () => {
  const harbor = { ...clip, sourceFrameRate: { numerator: 48, denominator: 2 } };
  const lighthouse = {
    ...harbor,
    id: "lighthouse",
    sourceId: "lighthouse-recording",
    sourceInFrame: 80,
    sourceOutFrame: 120,
    sourceDurationFrames: 220,
  };
  const clips = [lighthouse, harbor];
  const projectRate = { numerator: 72, denominator: 3 };

  expect(applyTrailingTrim(sequence, clips, projectRate, "open", 200)).toStrictEqual({
    durationFrames: 120,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          { id: "open", clipId: "harbor", sequenceStartFrame: 20, sourceOutOffsetFrames: 60 },
        ],
      },
    ],
  });
  expect(applyTrailingTrim(sequence, clips, projectRate, "open", 201)).toBeNull();
  expect(harbor.sourceOutFrame).toBe(140);
});

test("shortening the last placement preserves the uncovered sequence frames", () => {
  expect(applyTrailingTrim(sequence, [clip], frameRate, "open", 130)).toStrictEqual({
    durationFrames: 60,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          { id: "open", clipId: "harbor", sequenceStartFrame: 20, sourceOutOffsetFrames: -10 },
        ],
      },
    ],
  });
});

test("a trailing trim can leave exactly one source frame but cannot leave zero", () => {
  expect(applyTrailingTrim(sequence, [clip], frameRate, "open", 101)).toStrictEqual({
    durationFrames: 60,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          { id: "open", clipId: "harbor", sequenceStartFrame: 20, sourceOutOffsetFrames: -39 },
        ],
      },
    ],
  });
  expect(applyTrailingTrim(sequence, [clip], frameRate, "open", 100)).toBeNull();
});

test("resubmitting the current source out point produces no edit", () => {
  expect(applyTrailingTrim(sequence, [clip], frameRate, "open", 140)).toBeNull();
});

test("a trailing trim cannot end between whole source frames", () => {
  expect(applyTrailingTrim(sequence, [clip], frameRate, "open", 130.5)).toBeNull();
});

test("a trailing trim can shorten a placement below its fade without changing either transition", () => {
  const faded = {
    ...placement,
    entryTransition: { id: "entry", kind: "fade", durationFrames: 10 },
    revealTransition: { id: "reveal", kind: "fade", durationFrames: 5 },
  } as const;
  const track = { id: "main", label: "Main", placements: [faded] };
  const withFades: Sequence = { ...sequence, tracks: [track] };

  expect(applyTrailingTrim(withFades, [clip], frameRate, "open", 115)).toStrictEqual({
    durationFrames: 60,
    tracks: [{ ...track, placements: [{ ...faded, sourceOutOffsetFrames: -25 }] }],
  });
  expect(applyTrailingTrim(withFades, [clip], frameRate, "open", 109)).toStrictEqual({
    durationFrames: 60,
    tracks: [{ ...track, placements: [{ ...faded, sourceOutOffsetFrames: -31 }] }],
  });
});

test.each([
  ["leading", applyLeadingTrim, 110],
  ["trailing", applyTrailingTrim, 190],
] as const)(
  "a %s trim is blocked when the source and project frame rates differ",
  (_edge, applyTrim, sourceFrame) => {
    const differentRate = { numerator: 24, denominator: 2 };
    expect(applyTrim(sequence, [clip], differentRate, "open", sourceFrame)).toBeNull();
  },
);

test("a trailing trim can touch but cannot cross the next same-track edge", () => {
  const later = { id: "later", clipId: "harbor", sequenceStartFrame: 150 };
  const next = { id: "next", clipId: "harbor", sequenceStartFrame: 90 };
  const trimmed = { ...placement, sourceInOffsetFrames: 5 };
  const track = { id: "main", label: "Main", placements: [later, trimmed, next] };
  const cuts: Sequence = { durationFrames: 190, tracks: [track] };

  expect(applyTrailingTrim(cuts, [clip], frameRate, "open", 175)).toStrictEqual({
    durationFrames: 190,
    tracks: [{ ...track, placements: [later, { ...trimmed, sourceOutOffsetFrames: 35 }, next] }],
  });
  expect(applyTrailingTrim(cuts, [clip], frameRate, "open", 176)).toBeNull();
});

test("without the source duration a trailing trim cannot extend beyond the known source range", () => {
  const clipWithoutDuration: VideoClip = {
    id: "harbor",
    sourceId: "harbor-recording",
    sourceFrameRate: frameRate,
    sourceInFrame: 100,
    sourceOutFrame: 140,
  };
  expect(applyTrailingTrim(sequence, [clipWithoutDuration], frameRate, "open", 141)).toBeNull();
});

test("a trailing trim cannot extend beyond safe whole sequence frame positions", () => {
  const longSequence: Sequence = {
    durationFrames: Number.MAX_SAFE_INTEGER - 1,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          { id: "open", clipId: "harbor", sequenceStartFrame: Number.MAX_SAFE_INTEGER - 41 },
        ],
      },
    ],
  };

  expect(applyTrailingTrim(longSequence, [clip], frameRate, "open", 142)).toBeNull();
});

const lighthouse: VideoClip = {
  ...clip,
  id: "lighthouse",
  sourceId: "lighthouse-recording",
  sourceInFrame: 501,
  sourceOutFrame: 621,
  sourceDurationFrames: 1_000,
};
const harbor = { ...clip, sourceInFrame: 114, sourceOutFrame: 233, sourceDurationFrames: 1_000 };
const straightCuts: Sequence = {
  durationFrames: 240,
  tracks: [
    {
      id: "main",
      label: "Main",
      placements: [
        {
          id: "harbor-open",
          clipId: "harbor",
          sequenceStartFrame: 0,
          sourceOutOffsetFrames: 1,
        },
        { id: "lighthouse-next", clipId: "lighthouse", sequenceStartFrame: 120 },
      ],
    },
  ],
};

test("a leading trim shifts the sequence start and source in without moving the trailing edge", () => {
  expect(
    applyLeadingTrim(straightCuts, [lighthouse, harbor], frameRate, "lighthouse-next", 525),
  ).toStrictEqual({
    durationFrames: 240,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "harbor-open",
            clipId: "harbor",
            sequenceStartFrame: 0,
            sourceOutOffsetFrames: 1,
          },
          {
            id: "lighthouse-next",
            clipId: "lighthouse",
            sequenceStartFrame: 144,
            sourceInOffsetFrames: 24,
          },
        ],
      },
    ],
  });
});

test("a leading trim keeps both transition IDs and durations even when they overlap", () => {
  const faded = {
    ...placement,
    entryTransition: { id: "entry", kind: "fade", durationFrames: 10 },
    revealTransition: { id: "reveal", kind: "fade", durationFrames: 5 },
  } as const;
  const track = { id: "main", label: "Main", placements: [faded] };
  const withFades: Sequence = { ...sequence, tracks: [track] };

  expect(applyLeadingTrim(withFades, [clip], frameRate, "open", 125)).toStrictEqual({
    durationFrames: 60,
    tracks: [
      {
        ...track,
        placements: [{ ...faded, sequenceStartFrame: 45, sourceInOffsetFrames: 25 }],
      },
    ],
  });
  expect(applyLeadingTrim(withFades, [clip], frameRate, "open", 126)).toStrictEqual({
    durationFrames: 60,
    tracks: [
      {
        ...track,
        placements: [{ ...faded, sequenceStartFrame: 46, sourceInOffsetFrames: 26 }],
      },
    ],
  });
  expect(applyLeadingTrim(withFades, [clip], frameRate, "open", 100)).toBeNull();
});

test("a leading trim cannot overlap the previous placement even within the source bounds", () => {
  const shortClip = { ...clip, id: "short", sourceInFrame: 1, sourceOutFrame: 2 };
  expect(
    applyLeadingTrim(
      straightCuts,
      [shortClip, lighthouse, harbor],
      frameRate,
      "lighthouse-next",
      500,
    ),
  ).toBeNull();

  const withGap: Sequence = {
    durationFrames: 240,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "harbor-open",
            clipId: "harbor",
            sequenceStartFrame: 0,
            sourceOutOffsetFrames: 1,
          },
          {
            id: "lighthouse-next",
            clipId: "lighthouse",
            sequenceStartFrame: 144,
            sourceInOffsetFrames: 24,
          },
        ],
      },
    ],
  };
  expect(
    applyLeadingTrim(withGap, [shortClip, lighthouse, harbor], frameRate, "lighthouse-next", 501),
  ).toStrictEqual({
    durationFrames: 240,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "harbor-open",
            clipId: "harbor",
            sequenceStartFrame: 0,
            sourceOutOffsetFrames: 1,
          },
          {
            id: "lighthouse-next",
            clipId: "lighthouse",
            sequenceStartFrame: 120,
            sourceInOffsetFrames: 0,
          },
        ],
      },
    ],
  });
});

test("a leading trim can reach sequence frame zero without crossing it", () => {
  expect(applyLeadingTrim(sequence, [clip], frameRate, "open", 80)).toStrictEqual({
    durationFrames: 60,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          { id: "open", clipId: "harbor", sequenceStartFrame: 0, sourceInOffsetFrames: -20 },
        ],
      },
    ],
  });
  expect(applyLeadingTrim(sequence, [clip], frameRate, "open", 79)).toBeNull();
});

test("a leading trim can leave the last source frame but cannot reach the exclusive out point", () => {
  const shortened = { ...placement, sourceOutOffsetFrames: -10 };
  const track = { ...sequence.tracks[0], placements: [shortened] };
  const withShortenedPlacement = { ...sequence, tracks: [track] };

  expect(applyLeadingTrim(withShortenedPlacement, [clip], frameRate, "open", 129)).toStrictEqual({
    durationFrames: 60,
    tracks: [
      {
        ...track,
        placements: [{ ...shortened, sequenceStartFrame: 49, sourceInOffsetFrames: 29 }],
      },
    ],
  });
  expect(applyLeadingTrim(withShortenedPlacement, [clip], frameRate, "open", 130)).toBeNull();
});
