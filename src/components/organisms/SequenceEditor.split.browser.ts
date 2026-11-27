import { expect, test, type Locator, type Page } from "@playwright/test";
import type { Sequence } from "@/types";
import {
  blockedOutput,
  compiled,
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

async function seek(page: Page, timeline: Locator, fraction: number, frame: number) {
  const ruler = timeline.locator(".timeline-editor-time-area-interact");
  const rail = await ruler.boundingBox();
  if (!rail) throw new Error("Expected a visible sequence ruler");
  await ruler.click({ position: { x: rail.width * fraction, y: rail.height / 2 } });
  await expect(page.getByLabel("Sequence playhead position")).toHaveText(`Sequence frame ${frame}`);
}

const layeredBeforeSplit: Sequence = {
  tracks: [
    {
      id: "cutaways",
      label: "Cutaways",
      placements: [
        {
          id: "lighthouse-open",
          clipId: "lighthouse",
          sequenceStartFrame: 0,
          sourceOutOffsetFrames: -60,
        },
      ],
    },
    {
      id: "main",
      label: "Main",
      placements: [
        { id: "harbor-bed", clipId: "harbor", sequenceStartFrame: 0, sourceOutOffsetFrames: 120 },
      ],
    },
    {
      id: "alternate",
      label: "Alternate",
      placements: [
        {
          id: "lighthouse-alternate",
          clipId: "lighthouse",
          sequenceStartFrame: 120,
          sourceInOffsetFrames: 6,
          sourceOutOffsetFrames: -6,
        },
      ],
    },
  ],
};

test("Split cuts visible and covered placements at the playhead without a selection", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouses = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const split = page.getByRole("button", { name: "Split", exact: true });

  await seek(page, timeline, 1 / 8, 30);
  await expect(harbor).toHaveAttribute("aria-pressed", "false");
  await expect(lighthouses.first()).toHaveAttribute("aria-pressed", "false");
  expect(await emissions()).toStrictEqual(noEdits);
  await expect(split).toBeEnabled();
  await split.click();

  // At sequence frame 30 Lighthouse is at source 531 and Harbor is at source
  // 144. Lighthouse stays on top until frame 60, when Harbor resumes at 174.
  await expect.poll(emissions).toStrictEqual({
    sequences: [
      {
        tracks: [
          {
            id: "cutaways",
            label: "Cutaways",
            placements: [
              {
                id: "lighthouse-open",
                clipId: "lighthouse",
                sequenceStartFrame: 0,
                sourceOutOffsetFrames: -90,
              },
              {
                id: expect.stringMatching(/\S/),
                clipId: "lighthouse",
                sequenceStartFrame: 30,
                sourceInOffsetFrames: 30,
                sourceOutOffsetFrames: -60,
              },
            ],
          },
          {
            id: "main",
            label: "Main",
            placements: [
              {
                id: "harbor-bed",
                clipId: "harbor",
                sequenceStartFrame: 0,
                sourceOutOffsetFrames: -90,
              },
              {
                id: expect.stringMatching(/\S/),
                clipId: "harbor",
                sequenceStartFrame: 30,
                sourceInOffsetFrames: 30,
                sourceOutOffsetFrames: 120,
              },
            ],
          },
          {
            id: "alternate",
            label: "Alternate",
            placements: [
              {
                id: "lighthouse-alternate",
                clipId: "lighthouse",
                sequenceStartFrame: 120,
                sourceInOffsetFrames: 6,
                sourceOutOffsetFrames: -6,
              },
            ],
          },
        ],
      },
    ],
    cutListResults: [
      compiled({
        version: "1.0.0",
        inputMedia: [
          {
            s3Location: "s3://sequence-fixtures/lighthouse.mp4",
            sections: [
              { startFrame: 501, endFrame: 531 },
              { startFrame: 531, endFrame: 561 },
            ],
          },
          {
            s3Location: "s3://sequence-fixtures/harbor.mp4",
            sections: [{ startFrame: 174, endFrame: 354 }],
          },
        ],
        outputTrack: [
          { mediaIndex: 0, sectionIndex: 0 },
          { mediaIndex: 0, sectionIndex: 1 },
          { mediaIndex: 1, sectionIndex: 0 },
        ],
      }),
    ],
  });
  const { sequences } = await emissions();
  const ids = sequences[0].tracks.flatMap(({ placements }) => placements.map(({ id }) => id));
  expect(new Set(ids).size).toBe(5);
  await expect(harbor).toHaveCount(2);
  await expect(lighthouses).toHaveCount(3);
});

test("Split ignores an unrelated selection and Undo restores all split placements", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouses = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await lighthouses.last().click();
  await expect(lighthouses.last()).toHaveAttribute("aria-pressed", "true");
  await seek(page, timeline, 1 / 8, 30);
  await page.getByRole("button", { name: "Split", exact: true }).click();
  await expect
    .poll(async () =>
      (await emissions()).sequences[0]?.tracks.map(({ placements }) => placements.length),
    )
    .toEqual([2, 2, 1]);
  await expect(lighthouses.last()).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await emissions()).sequences[1]).toStrictEqual(layeredBeforeSplit);
  expect((await emissions()).cutListResults).toHaveLength(2);
  await expect(lighthouses).toHaveCount(2);
  await expect(lighthouses.last()).toHaveAttribute("aria-pressed", "true");
});

test("Split blocks an edge touch but still commits an interior split when the sequence cannot compile", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    "sequence.tracks[0].placements[1].transitionIn.id": "harbor-entry",
    "sequence.tracks[0].placements[1].transitionIn.kind": "fade",
    "sequence.tracks[0].placements[1].transitionIn.durationFrames": 40,
    "sequence.tracks[0].placements[1].transitionOut.id": "harbor-reveal",
    "sequence.tracks[0].placements[1].transitionOut.kind": "fade",
    "sequence.tracks[0].placements[1].transitionOut.durationFrames": 15,
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const split = page.getByRole("button", { name: "Split", exact: true });

  await harbor.last().click();
  await seek(page, timeline, 2 / 3, 240);
  await expect(split).toBeDisabled();
  const bounds = await split.boundingBox();
  if (!bounds) throw new Error("Expected the visible Split button");
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  expect(await emissions()).toStrictEqual(noEdits);

  await seek(page, timeline, 1 / 2, 180);
  await expect(split).toBeDisabled();
  expect(await emissions()).toStrictEqual(noEdits);

  await seek(page, timeline, 3 / 4, 270);
  await expect(split).toBeEnabled();
  expect(await emissions()).toStrictEqual(noEdits);
  await split.click();

  // Splitting at source frame 150 preserves the full 40-frame entry and the
  // 15-frame reveal at their original edges, without covering the existing gap.
  await expect.poll(emissions).toStrictEqual({
    sequences: [
      {
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              { id: "harbor-open", clipId: "harbor", sequenceStartFrame: 0 },
              {
                id: "harbor-close",
                clipId: "harbor",
                sequenceStartFrame: 240,
                sourceInOffsetFrames: 6,
                sourceOutOffsetFrames: -84,
                transitionIn: { id: "harbor-entry", kind: "fade", durationFrames: 40 },
              },
              {
                id: expect.stringMatching(/\S/),
                clipId: "harbor",
                sequenceStartFrame: 270,
                sourceInOffsetFrames: 36,
                sourceOutOffsetFrames: 6,
                transitionOut: { id: "harbor-reveal", kind: "fade", durationFrames: 15 },
              },
            ],
          },
        ],
      },
    ],
    cutListResults: [blockedOutput],
  });
  await expect(harbor).toHaveCount(3);
  await expect(split).toBeDisabled();
});
