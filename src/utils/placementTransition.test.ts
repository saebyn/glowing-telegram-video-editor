import { expect, test } from "vitest";
import type { ClipPlacement, Sequence } from "@/types";
import { evaluateTransitionEdit } from "./placementTransition";

const rate = { numerator: 24, denominator: 1 };
const clips = [
  { id: "a", sourceId: "a", sourceFrameRate: rate, sourceInFrame: 10, sourceOutFrame: 34 },
  { id: "b", sourceId: "b", sourceFrameRate: rate, sourceInFrame: 40, sourceOutFrame: 64 },
];
const a = { id: "a", clipId: "a", sequenceStartFrame: 0 };
const b = { id: "b", clipId: "b", sequenceStartFrame: 24 };

function sequence(a: ClipPlacement, b: ClipPlacement): Sequence {
  return { durationFrames: 48, tracks: [{ id: "picture", label: "Picture", placements: [a, b] }] };
}

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

test("a partially covered fade does not compete with a dissolve only in its covered frames", () => {
  const before: Sequence = {
    durationFrames: 44,
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
