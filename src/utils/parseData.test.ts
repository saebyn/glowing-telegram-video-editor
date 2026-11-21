import { expect, it } from "vitest";
import * as editor from "@/index";
import type { RawVideoMetadata } from "@/types";
import parseContent from "./parseData";

const metadata: RawVideoMetadata = {
  sourceId: "source",
  frameRate: { numerator: 60, denominator: 1 },
  title: "Source",
  video_url: "",
  length: "PT1.025S",
  highlights: [],
  attentions: [],
  transcription_errors: [],
  silences: [],
  chat_history: [],
  transcript: [],
};

it("rounds exact metadata half-frame times up without rounding earlier times up", () => {
  const content = parseContent({
    ...metadata,
    highlights: [
      { timestamp_start: "PT1.024999999S", timestamp_end: "PT1.025S" },
      { timestamp_start: "PT1.025000001S" },
    ],
  });

  expect(content.durationFrames).toBe(62);
  expect(content.highlights).toEqual([
    { sourceFrame: 61, sourceOutFrame: 62 },
    { sourceFrame: 62 },
  ]);
});

it("uses the source-rate denominator for fractional-rate metadata", () => {
  const content = parseContent({
    ...metadata,
    frameRate: { numerator: 30_000, denominator: 1001 },
    length: "PT1001S",
    transcript: [
      { text: "Before halfway", timestamp_start: "PT0.050049999S" },
      { text: "At halfway", timestamp_start: "PT0.05005S" },
    ],
  });

  expect(content.durationFrames).toBe(30_000);
  expect(content.transcript.map(({ sourceFrame }) => sourceFrame)).toEqual([1, 2]);
});

it("migrates integer milliseconds to the same frames as equivalent ISO timestamps", () => {
  const content = editor.parseContent({
    ...metadata,
    transcript: [
      { text: "Before halfway", timestamp_start: "PT1.024S" },
      { text: "At halfway", timestamp_start: "PT1.025S" },
    ],
  });
  expect([1024, 1025].map((ms) => editor.millisecondsToFrame(ms, metadata.frameRate))).toEqual(
    content.transcript.map(({ sourceFrame }) => sourceFrame),
  );
  expect(editor.millisecondsToFrame(1001, { numerator: 30_000, denominator: 1001 })).toBe(30);
  expect(() => editor.millisecondsToFrame(1025.5, metadata.frameRate)).toThrow(RangeError);
  expect(() => editor.millisecondsToFrame(Number.MAX_SAFE_INTEGER + 1, metadata.frameRate)).toThrow(
    RangeError,
  );
});
