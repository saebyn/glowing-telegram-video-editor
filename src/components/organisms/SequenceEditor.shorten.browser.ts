import { expect, test } from "@playwright/test";
import {
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
  straightCutArgs,
} from "./SequenceEditor.browserHarness";

test("shortening uncovered time commits the new endpoint and its exact CutList", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.durationFrames": 300,
  });

  await page.getByText("Sequence endpoint", { exact: true }).click({ timeout: 3_000 });
  await page.getByRole("spinbutton", { name: "Sequence end (exclusive frame)" }).fill("240");
  expect(await emissions()).toStrictEqual(noEdits);
  await page.getByRole("button", { name: "Shorten sequence", exact: true }).click();

  await expect.poll(emissions).toStrictEqual({
    sequences: [
      {
        durationFrames: 240,
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              { id: "harbor-open", clipId: "harbor", sequenceStartFrame: 0 },
              { id: "lighthouse-next", clipId: "lighthouse", sequenceStartFrame: 120 },
            ],
          },
        ],
      },
    ],
    cutLists: [
      {
        version: "1.0.0",
        inputMedia: [
          {
            s3Location: "s3://sequence-fixtures/harbor.mp4",
            sections: [{ startFrame: 114, endFrame: 234 }],
          },
          {
            s3Location: "s3://sequence-fixtures/lighthouse.mp4",
            sections: [{ startFrame: 501, endFrame: 621 }],
          },
        ],
        outputTrack: [
          { mediaIndex: 0, sectionIndex: 0 },
          { mediaIndex: 1, sectionIndex: 0 },
        ],
      },
    ],
  });
  await expect(page.getByRole("region", { name: "Sequence timeline" })).toContainText(
    "Duration: 00:04",
  );
});

test("rejecting an endpoint inside the last placement leaves the sequence intact", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);
  await page.getByText("Sequence endpoint", { exact: true }).click();
  await page.getByRole("spinbutton", { name: "Sequence end (exclusive frame)" }).fill("359");
  await page.getByRole("button", { name: "Shorten sequence", exact: true }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "Enter a shorter endpoint that leaves every placement intact.",
  );
  await expect(page.getByRole("region", { name: "Sequence timeline" })).toContainText(
    "Duration: 00:06",
  );
  expect(await emissions()).toStrictEqual(noEdits);
});
