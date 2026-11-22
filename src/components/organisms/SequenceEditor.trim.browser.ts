import { expect, test } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";
import type { Sequence } from "@/types";

test("trimming one use of a clip leaves the other use aligned to sequence time", async ({
  page,
}) => {
  const expectedSequence: Sequence = {
    durationFrames: 360,
    tracks: [
      {
        id: "cutaways",
        label: "Cutaways",
        placements: [
          {
            id: "harbor-cutaway",
            clipId: "harbor",
            sequenceStartFrame: 120,
            sourceInOffsetFrames: 6,
            sourceOutOffsetFrames: -24,
          },
        ],
      },
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "harbor-main",
            clipId: "harbor",
            sequenceStartFrame: 0,
            sourceOutOffsetFrames: 240,
          },
        ],
      },
    ],
  };
  const expectedCutList: CutList = {
    version: "1.0.0",
    inputMedia: [
      {
        s3Location: "s3://sequence-fixtures/harbor.mp4",
        sections: [
          { startFrame: 114, endFrame: 234 },
          { startFrame: 120, endFrame: 210 },
          { startFrame: 324, endFrame: 474 },
        ],
      },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 0, sectionIndex: 1 },
      { mediaIndex: 0, sectionIndex: 2 },
    ],
  };

  const sequences: Sequence[] = [];
  const cutLists: (CutList | null)[] = [];
  await page.exposeFunction("recordSequence", (next: Sequence) => sequences.push(next));
  await page.exposeFunction("recordCutList", (next: CutList | null) => cutLists.push(next));
  await page.addInitScript(() => {
    const host = window as Window & {
      recordSequence?(next: Sequence): Promise<void>;
      recordCutList?(next: CutList | null): Promise<void>;
    };
    host.addEventListener("sequence-editor:sequence-change", (event) => {
      void host.recordSequence?.((event as CustomEvent<Sequence>).detail);
    });
    host.addEventListener("sequence-editor:cut-list-change", (event) => {
      void host.recordCutList?.((event as CustomEvent<CutList | null>).detail);
    });
  });

  await page.goto("/iframe.html?id=organisms-sequenceeditor--trailing-trim-fixture&viewMode=story");
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  // There are two placements of the same clip, one on each track.
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  await expect(harbor).toHaveCount(2, { timeout: 10_000 });
  await harbor.first().click();
  const outFrame = page.getByLabel("Source out (exclusive frame)");
  const submit = page.getByRole("button", { name: "Trim placement" });
  await expect(outFrame).toHaveValue("240");

  // The placement must retain at least one source frame and stay inside the sequence.
  for (const invalidEnd of [120, 361]) {
    await outFrame.fill(String(invalidEnd));
    await submit.click();
    expect(sequences).toEqual([]);
    expect(cutLists).toEqual([]);
    await expect(outFrame).toHaveValue(String(invalidEnd));
  }

  await outFrame.fill("210");
  expect(sequences).toEqual([]);
  expect(cutLists).toEqual([]);
  await submit.click();
  await expect.poll(() => sequences).toStrictEqual([expectedSequence]);
  await expect.poll(() => cutLists).toStrictEqual([expectedCutList]);

  await harbor.last().click();
  await expect(outFrame).toHaveValue("474");
});
