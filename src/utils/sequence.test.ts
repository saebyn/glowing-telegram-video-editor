import type { CutList } from "@saebyn/glowing-telegram-types";
import { expect, it } from "vitest";
import { compileCutList } from "@/index";
import type { Sequence, SequenceSource, VideoClip } from "@/types";
import { getSequenceDissolves, hasTransitionAuthoringConflict } from "./sequenceTransitions";

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
const fade = (id: string, durationFrames: number) =>
  ({ id, kind: "fade", durationFrames }) as const;

it("reports each sequence gap alongside a visible unsupported dissolve", () => {
  const sequence: Sequence = {
    durationFrames: 150,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          { id: "a", clipId: "a", sequenceStartFrame: 10 },
          {
            id: "b",
            clipId: "b",
            sequenceStartFrame: 110,
            entryTransition: { id: "blend", kind: "dissolve", durationFrames: 8 },
          },
        ],
      },
    ],
  };

  expect(compileCutList(sequence, clips, sources, frameRate)).toEqual({
    ok: false,
    issues: [
      { code: "sequence-gap", startFrame: 0, endFrame: 10 },
      { code: "sequence-gap", startFrame: 130, endFrame: 150 },
      { code: "unsupported-dissolve", transitionId: "blend" },
    ],
  });
});

it("collects missing references without claiming that an unresolved placement leaves a gap", () => {
  const sequence: Sequence = {
    durationFrames: 120,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          { id: "unknown", clipId: "missing", sequenceStartFrame: 0 },
          { id: "known", clipId: "b", sequenceStartFrame: 100 },
        ],
      },
    ],
  };
  expect(compileCutList(sequence, clips, [], frameRate)).toStrictEqual({
    ok: false,
    issues: [
      { code: "missing-clip", placementId: "unknown", clipId: "missing" },
      { code: "missing-source", placementId: "known", sourceId: "source-b" },
    ],
  });
});

it("omits a dissolve clipped to zero visible frames at the exclusive sequence end", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "a",
            clipId: "a",
            sequenceStartFrame: 0,
            revealTransition: { id: "end", kind: "dissolve", durationFrames: 1 },
          },
        ],
      },
    ],
  };
  expect(compileCutList(sequence, clips, sources, frameRate)).toMatchObject({
    ok: true,
    issues: [],
    cutList: { outputTrack: [{ mediaIndex: 0, sectionIndex: 0 }] },
  });
});

it("still finds two competing dissolve owners when unrelated footage has another frame rate", () => {
  const sequence: Sequence = {
    durationFrames: 150,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "a",
            clipId: "a",
            sequenceStartFrame: 0,
            revealTransition: { id: "out", kind: "dissolve", durationFrames: 12 },
          },
          {
            id: "b",
            clipId: "b",
            sequenceStartFrame: 100,
            entryTransition: { id: "in", kind: "dissolve", durationFrames: 12 },
          },
          { id: "other", clipId: "mixed", sequenceStartFrame: 120 },
        ],
      },
    ],
  };
  const mixed = { ...clips[1], id: "mixed", sourceFrameRate: { numerator: 24, denominator: 1 } };
  expect(
    hasTransitionAuthoringConflict(sequence, [...clips, mixed], sources, frameRate, "in"),
  ).toBe(true);
});

it("omits a centered dissolve when a higher track hides the owning cut", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      { id: "top", label: "Top", placements: [{ id: "a", clipId: "a", sequenceStartFrame: 0 }] },
      {
        id: "bottom",
        label: "Bottom",
        placements: [
          {
            id: "b",
            clipId: "b",
            sequenceStartFrame: 40,
            entryTransition: { id: "covered-dissolve", kind: "dissolve", durationFrames: 9 },
          },
        ],
      },
    ],
  };
  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: true,
    issues: [],
    cutList: {
      version: "1.0.0",
      inputMedia: [
        { s3Location: "s3://media/a.mp4", sections: [{ startFrame: 100, endFrame: 200 }] },
      ],
      outputTrack: [{ mediaIndex: 0, sectionIndex: 0 }],
    },
  });
});

it("does not count continuous same-source split pieces as an interruption", () => {
  const sequence: Sequence = {
    durationFrames: 120,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          { id: "first-half", clipId: "a", sequenceStartFrame: 0, sourceOutOffsetFrames: -2 },
          { id: "second-half", clipId: "a", sequenceStartFrame: 98, sourceInOffsetFrames: 98 },
          {
            id: "incoming",
            clipId: "b",
            sequenceStartFrame: 100,
            entryTransition: { id: "dissolve", kind: "dissolve", durationFrames: 9 },
          },
        ],
      },
    ],
  };
  expect(getSequenceDissolves(sequence, clips, sources, frameRate).get("dissolve")).toMatchObject({
    cut: 100,
    startFrame: 96,
    endFrame: 105,
    interrupted: false,
    covered: false,
  });
  const [track] = sequence.tracks;
  const interrupted = {
    ...sequence,
    tracks: [
      {
        ...track,
        placements: track.placements.map((placement) =>
          placement.id === "second-half"
            ? { ...placement, sourceInOffsetFrames: 97, sourceOutOffsetFrames: -1 }
            : placement,
        ),
      },
    ],
  };
  expect(
    getSequenceDissolves(interrupted, clips, sources, frameRate).get("dissolve")?.interrupted,
  ).toBe(true);
  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: false,
    issues: [{ code: "unsupported-dissolve", transitionId: "dissolve" }],
  });
  const withMissingSource: Sequence = {
    durationFrames: 140,
    tracks: [
      ...interrupted.tracks,
      {
        id: "tail",
        label: "Tail",
        placements: [{ id: "tail", clipId: "orphaned", sequenceStartFrame: 120 }],
      },
    ],
  };
  const orphanedClip = { ...clips[1], id: "orphaned", sourceId: "unregistered" };
  expect(
    compileCutList(withMissingSource, [...clips, orphanedClip], sources, frameRate),
  ).toStrictEqual({
    ok: false,
    issues: [
      { code: "missing-source", placementId: "tail", sourceId: "unregistered" },
      { code: "dissolve-interrupted", transitionId: "dissolve" },
    ],
  });
});

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
  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: true,
    cutList: expected,
    issues: [],
  });
});

it("keeps a reveal fade on the upper section before the lower source resumes", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [
          {
            id: "placement-b",
            clipId: "b",
            sequenceStartFrame: 40,
            revealTransition: { id: "reveal-b", kind: "fade", durationFrames: 10 },
          },
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

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: true,
    cutList: expected,
    issues: [],
  });
});

it("follows a reveal with the uppermost placement starting at the same boundary", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [
          {
            id: "outgoing",
            clipId: "b",
            sequenceStartFrame: 40,
            revealTransition: fade("outgoing-reveal", 10),
          },
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

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: true,
    cutList: expected,
    issues: [],
  });
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
            entryTransition: fade("middle-entry", 20),
            revealTransition: fade("middle-reveal", 20),
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

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: true,
    cutList: expected,
    issues: [],
  });
});

it("compiles unsorted placements in frame order without splitting at covered boundaries", () => {
  const sequence: Sequence = {
    durationFrames: 120,
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [
          { id: "placement-b", clipId: "b", sequenceStartFrame: 100 },
          { id: "placement-a", clipId: "a", sequenceStartFrame: 0 },
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
  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: true,
    cutList: expected,
    issues: [],
  });
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

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: false,
    issues: [
      {
        code: "track-overlap",
        trackId: "lower",
        placementId: "placement-b2",
        previousPlacementId: "placement-b1",
      },
    ],
  });
});

it.each([
  ["a straight cut", {}, []],
  [
    "a reveal fade",
    { revealTransition: fade("gap-reveal", 10) },
    [{ code: "fade-gap", transitionId: "gap-reveal" }],
  ],
] as const)(
  "does not skip an uncovered gap after %s to reach a placement on another track",
  (_, transition, transitionIssues) => {
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

    expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
      ok: false,
      issues: [{ code: "sequence-gap", startFrame: 100, endFrame: 120 }, ...transitionIssues],
    });
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

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: false,
    issues: [{ code: "sequence-gap", startFrame: 100, endFrame: 120 }],
  });
});

it("has no CutList for an empty sequence", () => {
  const sequence: Sequence = {
    durationFrames: 0,
    tracks: [{ id: "upper", label: "Upper", placements: [] }],
  };

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: false,
    issues: [{ code: "empty-sequence" }],
  });
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

  expect(compileCutList(sequence, clips, sources, { numerator: 30, denominator: 2 })).toStrictEqual(
    {
      ok: false,
      issues: [
        { code: "frame-rate-mismatch", placementId: "placement-a", sourceFrameRate: frameRate },
        { code: "sequence-gap", startFrame: 50, endFrame: 100 },
      ],
    },
  );
});

it("compiles the same entry and reveal fades with or without empty tracks above and below", () => {
  const main = {
    id: "main",
    label: "Main",
    placements: [
      {
        id: "placement-a",
        clipId: "a",
        sequenceStartFrame: 0,
        revealTransition: fade("a-reveal", 15),
      },
      {
        id: "placement-b",
        clipId: "b",
        sequenceStartFrame: 100,
        entryTransition: fade("b-entry", 5),
      },
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

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: true,
    cutList: expected,
    issues: [],
  });
  expect(compileCutList(padded, clips, sources, frameRate)).toStrictEqual({
    ok: true,
    cutList: expected,
    issues: [],
  });
});

it("omits a fully covered reveal window even when the owner is visible earlier", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [{ id: "cover", clipId: "b", sequenceStartFrame: 80 }],
      },
      {
        id: "lower",
        label: "Lower",
        placements: [
          {
            id: "placement-b",
            clipId: "a",
            sequenceStartFrame: 0,
            revealTransition: { id: "covered-reveal", kind: "fade", durationFrames: 10 },
          },
        ],
      },
    ],
  };

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: true,
    issues: [],
    cutList: {
      version: "1.0.0",
      inputMedia: [
        { s3Location: "s3://media/a.mp4", sections: [{ startFrame: 100, endFrame: 180 }] },
        { s3Location: "s3://media/b.mp4", sections: [{ startFrame: 500, endFrame: 520 }] },
      ],
      outputTrack: [
        { mediaIndex: 0, sectionIndex: 0 },
        { mediaIndex: 1, sectionIndex: 0 },
      ],
    },
  });
});

it("omits a covered entry ending exactly where its owner becomes visible", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [{ id: "cover", clipId: "b", sequenceStartFrame: 0 }],
      },
      {
        id: "lower",
        label: "Lower",
        placements: [
          { id: "a", clipId: "a", sequenceStartFrame: 0, entryTransition: fade("entry", 20) },
        ],
      },
    ],
  };

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: true,
    issues: [],
    cutList: {
      version: "1.0.0",
      inputMedia: [
        { s3Location: "s3://media/b.mp4", sections: [{ startFrame: 500, endFrame: 520 }] },
        { s3Location: "s3://media/a.mp4", sections: [{ startFrame: 120, endFrame: 200 }] },
      ],
      outputTrack: [
        { mediaIndex: 0, sectionIndex: 0 },
        { mediaIndex: 1, sectionIndex: 0 },
      ],
    },
  });
});

it("rejects a fade when its authored edge is covered but its last frame is visible", () => {
  const sequence: Sequence = {
    durationFrames: 100,
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [
          { id: "cover", clipId: "b", sequenceStartFrame: 0, sourceOutOffsetFrames: -1 },
        ],
      },
      {
        id: "lower",
        label: "Lower",
        placements: [
          { id: "a", clipId: "a", sequenceStartFrame: 0, entryTransition: fade("entry", 20) },
        ],
      },
    ],
  };
  // The higher track covers [0, 19); the twentieth frame of the entry is still visible.
  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: false,
    issues: [{ code: "fade-interrupted", transitionId: "entry" }],
  });
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
          {
            id: "outgoing",
            clipId: "a",
            sequenceStartFrame: 0,
            revealTransition: fade("outgoing-reveal", 20),
          },
        ],
      },
    ],
  };

  // The fade spans [80, 100), but the outgoing placement is only visible again at 95.
  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: false,
    issues: [{ code: "fade-interrupted", transitionId: "outgoing-reveal" }],
  });
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
          {
            id: "incoming",
            clipId: "a",
            sequenceStartFrame: 20,
            entryTransition: fade("incoming-entry", 20),
          },
        ],
      },
    ],
  };

  // The fade spans [20, 40), but the incoming placement is covered starting at 25.
  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: false,
    issues: [{ code: "fade-interrupted", transitionId: "incoming-entry" }],
  });
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
            entryTransition: fade("long-entry", 60),
            revealTransition: fade("long-reveal", 50),
          },
        ],
      },
    ],
  };

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: false,
    issues: [{ code: "fade-overlap", transitionId: "long-reveal" }],
  });
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
            entryTransition: fade("a-entry", 40),
            revealTransition: fade("a-reveal", 60),
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

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: true,
    cutList: expected,
    issues: [],
  });
});

it.each([
  ["zero-frame entry", { entryTransition: fade("zero-entry", 0) }, "zero-entry"],
  [
    "fractional-frame reveal",
    { revealTransition: fade("fractional-reveal", 2.5) },
    "fractional-reveal",
  ],
] as const)("rejects a %s fade even when its edge is visible", (_, transition, transitionId) => {
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

  expect(compileCutList(sequence, clips, sources, frameRate)).toStrictEqual({
    ok: false,
    issues: [{ code: "invalid-transition", transitionId }],
  });
});
