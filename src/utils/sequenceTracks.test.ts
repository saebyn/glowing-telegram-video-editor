import { expect, test } from "vitest";
import type { Sequence, SequenceTrack } from "@/types";
import { addSequenceTrack, removeSequenceTrack } from "./sequenceTracks";

const opening: SequenceTrack = {
  id: "opening",
  label: "Track 1",
  placements: [{ id: "first-placement", clipId: "harbor", sequenceStartFrame: 12 }],
};
const empty: SequenceTrack = { id: "empty", label: "Cutaways", placements: [] };
const closing: SequenceTrack = {
  id: "closing",
  label: "Cutaways",
  placements: [{ id: "final-placement", clipId: "lighthouse", sequenceStartFrame: 240 }],
};
const sequence: Sequence = { durationFrames: 480, tracks: [opening, empty, closing] };

test("add uses an unused default name and preserves placement positions and track order", () => {
  expect(addSequenceTrack(sequence, "new-track")).toStrictEqual({
    durationFrames: 480,
    tracks: [{ id: "new-track", label: "Track 2", placements: [] }, opening, empty, closing],
  });
});

test("remove targets the empty track by identity and preserves the ordered survivors", () => {
  expect(removeSequenceTrack(sequence, "empty")).toStrictEqual({
    durationFrames: 480,
    tracks: [opening, closing],
  });
});

test("remove rejects occupied, missing, and last remaining tracks", () => {
  expect(removeSequenceTrack(sequence, "opening")).toBeNull();
  expect(removeSequenceTrack(sequence, "missing")).toBeNull();
  expect(removeSequenceTrack({ durationFrames: 480, tracks: [empty] }, "empty")).toBeNull();
});
