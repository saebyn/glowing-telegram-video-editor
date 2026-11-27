import { expect, test } from "vitest";
import type { ClipPlacement, Sequence, SequenceSource } from "@/types";
import { evaluateTransitionEdit, evaluateTransitionResize } from "./placementTransition";

const rate = { numerator: 24, denominator: 1 };
const clips = [
  { id: "a", sourceId: "a", sourceFrameRate: rate, sourceInFrame: 10, sourceOutFrame: 34 },
  { id: "b", sourceId: "b", sourceFrameRate: rate, sourceInFrame: 40, sourceOutFrame: 64 },
];
const a = { id: "a", clipId: "a", sequenceStartFrame: 0 };
const b = { id: "b", clipId: "b", sequenceStartFrame: 24 };

function sequence(a: ClipPlacement, b: ClipPlacement): Sequence {
  return { tracks: [{ id: "picture", label: "Picture", placements: [a, b] }] };
}

test("resize by ID changes only the duration of the existing transition", () => {
  const before = sequence(a, {
    ...b,
    transitionIn: { id: "blend", kind: "dissolve", durationFrames: 7 },
  });
  const transition = { id: "blend", kind: "dissolve", durationFrames: 31 } as const;
  expect(
    evaluateTransitionResize(before, clips, {}, rate, {
      transitionId: "blend",
      durationFrames: 31, // A dissolve can be longer than its 24-frame placement.
    }),
  ).toStrictEqual({
    kind: "edit",
    transition,
    sequence: sequence(a, { ...b, transitionIn: transition }),
  });
});

test("resizing a transition requires a known duration for its placement", () => {
  const before = sequence(a, {
    ...b,
    transitionIn: { id: "blend", kind: "dissolve", durationFrames: 7 },
  });
  const malformed = { ...clips[1], sourceFrameRate: { numerator: 29.97, denominator: 1 } };
  expect(
    evaluateTransitionResize(before, [clips[0], malformed], {}, rate, {
      transitionId: "blend",
      durationFrames: 31,
    }),
  ).toStrictEqual({ kind: "unavailable" });
});

test("a resize intent is evaluated against the currently authored transition", () => {
  const entry = { id: "entry", kind: "fade", durationFrames: 6 } as const;
  const before = sequence(a, { ...b, transitionIn: entry });
  const intent = { transitionId: "entry", durationFrames: 12 };
  expect(evaluateTransitionResize(before, clips, {}, rate, intent).kind).toBe("edit");
  expect(
    evaluateTransitionResize(
      sequence(a, { ...b, transitionIn: { ...entry, id: "replacement" } }),
      clips,
      {},
      rate,
      intent,
    ),
  ).toEqual({ kind: "unavailable" });
  expect(
    evaluateTransitionResize(
      { ...before, tracks: [{ ...before.tracks[0], locked: true }] },
      clips,
      {},
      rate,
      intent,
    ),
  ).toEqual({ kind: "locked" });
  expect(
    evaluateTransitionResize(before, clips, {}, rate, { ...intent, durationFrames: 0 }),
  ).toEqual({ kind: "invalid-duration", min: 1, max: 24 });
});

test("duration is a positive whole count in the proposed kind, not the existing kind", () => {
  const placement = {
    ...a,
    transitionOut: { id: "blend", kind: "dissolve", durationFrames: 40 } as const,
  };
  const before = sequence(placement, b);
  for (const durationFrames of [0, -1, 1.5, NaN]) {
    expect(
      evaluateTransitionEdit(before, clips, {}, rate, {
        placementId: "a",
        edge: "trailing",
        transition: { kind: "dissolve", durationFrames },
      }),
    ).toStrictEqual({ kind: "invalid-duration", min: 1 });
  }
  expect(
    evaluateTransitionEdit(before, clips, {}, rate, {
      placementId: "a",
      edge: "trailing",
      transition: { kind: "fade", durationFrames: 40 },
    }),
  ).toStrictEqual({ kind: "invalid-duration", min: 1, max: 24 });
  const fade = { id: "blend", kind: "fade", durationFrames: 24 } as const;
  expect(
    evaluateTransitionEdit(before, clips, {}, rate, {
      placementId: "a",
      edge: "trailing",
      transition: { kind: "fade", durationFrames: 24 },
    }),
  ).toStrictEqual({
    kind: "edit",
    transition: fade,
    sequence: sequence({ ...a, transitionOut: fade }, b),
  });
  const dissolve = { ...fade, kind: "dissolve" } as const;
  expect(
    evaluateTransitionEdit(sequence({ ...a, transitionOut: fade }, b), clips, {}, rate, {
      placementId: "a",
      edge: "trailing",
      transition: { kind: "dissolve", durationFrames: 24 },
    }),
  ).toStrictEqual({
    kind: "edit",
    transition: dissolve,
    sequence: sequence({ ...a, transitionOut: dissolve }, b),
  });
  expect(before.tracks[0].placements[0]).toStrictEqual(placement);
});

test("a dissolve requires an owner with a resolved positive placement duration", () => {
  for (const owner of [
    { ...a, clipId: "missing" },
    { ...a, sourceOutOffsetFrames: -24 },
  ]) {
    expect(
      evaluateTransitionEdit(sequence(owner, b), clips, {}, rate, {
        placementId: "a",
        edge: "leading",
        transition: { kind: "dissolve", durationFrames: 1 },
      }),
    ).toStrictEqual({ kind: "unavailable" });
  }
});

test("even nonoverlapping visible fades cannot both own the same cut", () => {
  const before = sequence(
    { ...a, transitionOut: { id: "outgoing", kind: "fade", durationFrames: 1 } },
    b,
  );
  expect(
    evaluateTransitionEdit(
      before,
      clips,
      {},
      rate,
      {
        placementId: "b",
        edge: "leading",
        transition: { kind: "fade", durationFrames: 1 },
      },
      () => "incoming",
    ),
  ).toStrictEqual({ kind: "conflict" });
});

test("a dissolve and fade at the same cut compete even when their windows only touch", () => {
  const before = sequence(
    { ...a, transitionOut: { id: "outgoing", kind: "fade", durationFrames: 1 } },
    b,
  );
  expect(
    evaluateTransitionEdit(
      before,
      clips,
      {},
      rate,
      {
        placementId: "b",
        edge: "leading",
        transition: { kind: "dissolve", durationFrames: 1 },
      },
      () => "incoming",
    ),
  ).toStrictEqual({ kind: "conflict" });
});

const coverClip = { ...clips[0], id: "cover", sourceId: "cover", sourceOutFrame: 58 };
const coverPlacement = { id: "cover", clipId: "cover", sequenceStartFrame: 0 };
const outgoingReveal = {
  ...a,
  transitionOut: { id: "outgoing", kind: "fade", durationFrames: 8 },
} satisfies ClipPlacement;
const audioSource = { mediaKind: "audio-only", s3Location: "s3://audio" } as const;
const pictureSource = {
  mediaKind: "video-only",
  s3Location: "s3://picture",
  previewHlsUrl: "/picture.m3u8",
} as const;
const unknownSource = { s3Location: "s3://unknown", previewHlsUrl: "/unknown.m3u8" };

function layeredSequence(cover: ClipPlacement): Sequence {
  const lower = sequence(outgoingReveal, b);
  return {
    ...lower,
    tracks: [{ id: "upper", label: "Upper", placements: [cover] }, ...lower.tracks],
  };
}

const incomingDissolve = {
  placementId: "b",
  edge: "leading",
  transition: { kind: "dissolve", durationFrames: 8 },
} as const;

test.each([
  { upper: pictureSource, lower: audioSource },
  { upper: audioSource, lower: pictureSource },
])(
  "$upper.mediaKind coverage cannot hide a competing $lower.mediaKind dissolve",
  ({ lower, upper }) => {
    expect(
      evaluateTransitionEdit(
        layeredSequence(coverPlacement),
        [...clips, coverClip],
        { a: lower, b: lower, cover: upper },
        rate,
        incomingDissolve,
        () => "incoming",
      ),
    ).toStrictEqual({ kind: "conflict" });
  },
);

test("a picture dissolve and an audio reveal at the same sequence frame remain editable", () => {
  const picture = { ...coverPlacement, sequenceStartFrame: 24, sourceOutOffsetFrames: -24 };
  expect(
    evaluateTransitionEdit(
      layeredSequence(picture),
      [...clips, coverClip],
      { a: audioSource, b: audioSource, cover: pictureSource },
      rate,
      {
        placementId: "cover",
        edge: "leading",
        transition: { kind: "dissolve", durationFrames: 8 },
      },
      () => "incoming-picture",
    ),
  ).toMatchObject({
    kind: "edit",
    transition: { id: "incoming-picture", kind: "dissolve", durationFrames: 8 },
  });
});

test.each([audioSource, pictureSource])(
  "an undeclared media kind can still cover $mediaKind transitions during authoring",
  (lower) => {
    expect(
      evaluateTransitionEdit(
        layeredSequence(coverPlacement),
        [...clips, coverClip],
        { a: lower, b: lower, cover: unknownSource },
        rate,
        incomingDissolve,
        () => "covered",
      ),
    ).toMatchObject({
      kind: "edit",
      transition: { id: "covered", kind: "dissolve", durationFrames: 8 },
    });
  },
);

test("an unrelated invalid transition does not let two valid transitions own a cut", () => {
  const before = sequence(
    { ...a, transitionOut: { id: "outgoing", kind: "fade", durationFrames: 1 } },
    { ...b, transitionOut: { id: "unrelated-invalid", kind: "fade", durationFrames: 0 } },
  );
  expect(
    evaluateTransitionEdit(
      before,
      clips,
      {},
      rate,
      {
        placementId: "b",
        edge: "leading",
        transition: { kind: "dissolve", durationFrames: 1 },
      },
      () => "incoming",
    ),
  ).toStrictEqual({ kind: "conflict" });
});

test("different cuts may touch but cannot compete over a visible frame", () => {
  const before = sequence(
    { ...a, transitionIn: { id: "start", kind: "fade", durationFrames: 16 } },
    b,
  );
  const setReveal = (durationFrames: number) =>
    evaluateTransitionEdit(
      before,
      clips,
      {},
      rate,
      {
        placementId: "a",
        edge: "trailing",
        transition: { kind: "fade", durationFrames },
      },
      () => "end",
    );
  expect(setReveal(8)).toMatchObject({
    kind: "edit",
    transition: { id: "end", durationFrames: 8 },
  });
  expect(setReveal(9)).toStrictEqual({ kind: "conflict" });
});

test.each([
  { split: "continuous", coverEntry: false, sourceJump: 0, expected: "conflict" },
  {
    split: "continuous with a covered entry edge",
    coverEntry: true,
    sourceJump: 0,
    expected: "conflict",
  },
  {
    split: "discontinuous with a covered entry edge",
    coverEntry: true,
    sourceJump: 1,
    expected: "edit",
  },
])(
  "adding a reveal after a $split split returns $expected",
  ({ coverEntry, sourceJump, expected }) => {
    const before: Sequence = {
      tracks: [
        ...(coverEntry
          ? [
              {
                id: "upper",
                label: "Upper",
                placements: [{ ...coverPlacement, sourceOutOffsetFrames: -40 }],
              },
            ]
          : []),
        {
          id: "picture",
          label: "Picture",
          placements: [
            {
              id: "left",
              clipId: "a",
              sequenceStartFrame: 0,
              sourceOutOffsetFrames: -12,
              transitionIn: { id: "entry", kind: "fade", durationFrames: 16 },
            },
            {
              id: "right",
              clipId: "a",
              sequenceStartFrame: 8,
              sourceInOffsetFrames: 8 + sourceJump,
              sourceOutOffsetFrames: sourceJump,
            },
          ],
        },
      ],
    };
    const splitClip = { ...clips[0], sourceOutFrame: 30 };
    // Covering [0, 8) hides the entry's anchor but not its source-continuous continuation.
    expect(
      evaluateTransitionEdit(
        before,
        [splitClip, coverClip],
        {},
        rate,
        {
          placementId: "right",
          edge: "trailing",
          transition: { kind: "fade", durationFrames: 12 },
        },
        () => "reveal",
      ).kind,
    ).toBe(expected);
  },
);

test("a partially covered fade does not compete with a dissolve only in its covered frames", () => {
  const before: Sequence = {
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [
          { id: "cover", clipId: "b", sequenceStartFrame: 12, sourceOutOffsetFrames: -16 },
          { ...b, sequenceStartFrame: 20 },
        ],
      },
      {
        id: "lower",
        label: "Lower",
        placements: [
          {
            ...a,
            transitionIn: { id: "partly-covered", kind: "fade", durationFrames: 24 },
          },
        ],
      },
    ],
  };
  // The lower fade is visible only on [0, 12). The upper dissolve covers [17, 23).
  expect(
    evaluateTransitionEdit(
      before,
      clips,
      {},
      rate,
      {
        placementId: "b",
        edge: "leading",
        transition: { kind: "dissolve", durationFrames: 6 },
      },
      () => "blend",
    ),
  ).toMatchObject({ kind: "edit", transition: { id: "blend", durationFrames: 6 } });
});

function dissolvesUnderCover(
  coverFrames: number,
  transitionIn?: ClipPlacement["transitionIn"],
): Sequence {
  return {
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [
          {
            ...coverPlacement,
            sequenceStartFrame: 40,
            sourceOutOffsetFrames:
              coverFrames - (coverClip.sourceOutFrame - coverClip.sourceInFrame),
          },
        ],
      },
      {
        id: "lower",
        label: "Lower",
        placements: [
          a,
          {
            ...b,
            sequenceStartFrame: 30,
            transitionIn: { id: "first", kind: "dissolve", durationFrames: 40 },
          },
          { id: "c", clipId: "c", sequenceStartFrame: 60, transitionIn },
        ],
      },
    ],
  };
}

const dissolveClips = [
  ...[...clips, { ...clips[0], id: "c", sourceId: "c" }].map((clip) => ({
    ...clip,
    sourceOutFrame: clip.sourceInFrame + 30,
  })),
  coverClip,
];
const secondDissolve = {
  placementId: "c",
  edge: "leading",
  transition: { kind: "dissolve", durationFrames: 40 },
} as const;

test("dissolves can share covered frames, but not one uncovered frame at the end of the cover", () => {
  const addDissolve = (coverFrames: number) =>
    evaluateTransitionEdit(
      dissolvesUnderCover(coverFrames),
      dissolveClips,
      {},
      rate,
      secondDissolve,
      () => "second",
    );

  // The dissolves at 30 and 60 share [40, 50); a 9-frame cover leaves frame 49 exposed.
  expect(addDissolve(10)).toMatchObject({
    kind: "edit",
    transition: { id: "second", kind: "dissolve", durationFrames: 40 },
  });
  expect(addDissolve(9)).toStrictEqual({ kind: "conflict" });
});

test.each([pictureSource, audioSource])(
  "applying a dissolve under $mediaKind coverage still checks the other contribution",
  (cover) => {
    const existing = { id: "second", kind: "fade", durationFrames: 12 } as const;
    const applyDissolve = (source: SequenceSource) =>
      evaluateTransitionEdit(
        dissolvesUnderCover(10, existing),
        dissolveClips,
        { cover: source },
        rate,
        secondDissolve,
      );
    expect(applyDissolve({ ...pictureSource, mediaKind: "audio-video" })).toMatchObject({
      kind: "edit",
      transition: { id: "second", kind: "dissolve", durationFrames: 40 },
    });
    expect(applyDissolve(cover)).toStrictEqual({ kind: "conflict" });
  },
);

test("resizing a dissolve can reveal a conflict before the cover starts", () => {
  const before = dissolvesUnderCover(10, { id: "second", kind: "dissolve", durationFrames: 40 });
  const resize = (durationFrames: number) =>
    evaluateTransitionResize(before, dissolveClips, {}, rate, {
      transitionId: "second",
      durationFrames,
    });
  expect(resize(38)).toMatchObject({
    kind: "edit",
    transition: { id: "second", kind: "dissolve", durationFrames: 38 },
  });
  // Extending the window to [39, 81) exposes its first frame before the cover at 40.
  expect(resize(42)).toStrictEqual({ kind: "conflict" });
});

test("a higher-track outgoing placement can contribute to an incoming dissolve", () => {
  const before: Sequence = {
    tracks: [
      {
        id: "upper",
        label: "Upper",
        placements: [{ ...a, transitionIn: { id: "entry", kind: "fade", durationFrames: 16 } }],
      },
      { id: "lower", label: "Lower", placements: [b] },
    ],
  };
  // The upper placement is the outgoing side at cut 24; it doesn't mask the dissolve on [12, 16).
  expect(
    evaluateTransitionEdit(
      before,
      clips,
      {},
      rate,
      { ...incomingDissolve, transition: { kind: "dissolve", durationFrames: 24 } },
      () => "incoming",
    ),
  ).toStrictEqual({ kind: "conflict" });
});
