import { expect, test, type Locator, type Page } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";
import type { Sequence } from "@/types";
import {
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
} from "./SequenceEditor.browserHarness";

async function openGroupStory(page: Page) {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouses = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await expect(lighthouses).toHaveCount(2, { timeout: 15_000 });
  return {
    timeline,
    harbor,
    stationary: lighthouses.first(),
    alternate: lighthouses.last(),
    emissions,
  };
}

async function groupGeometry(stationary: Locator, harbor: Locator, alternate: Locator) {
  const [top, middle, bottom] = await Promise.all([
    stationary.boundingBox(),
    harbor.boundingBox(),
    alternate.boundingBox(),
  ]);
  if (!top || !middle || !bottom) throw new Error("Expected one placement on each visible track");
  return {
    top,
    middle,
    bottom,
    pixelsPerFrame: (bottom.x - middle.x) / 120,
  };
}

test("click, Shift-click, and empty track space change only the placement selection and Inspector", async ({
  page,
}) => {
  const { harbor, stationary, alternate, emissions } = await openGroupStory(page);
  const inspector = page.getByRole("region", { name: "Selection inspector" });
  const sourceOut = inspector.getByRole("spinbutton", { name: "Source out (exclusive frame)" });

  await harbor.click();
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  await expect(sourceOut).toHaveValue("354");

  await alternate.click({ modifiers: ["Shift"] });
  await expect(alternate).toHaveAttribute("aria-pressed", "true");
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  await expect(inspector).toContainText("2 placements selected");
  await expect(inspector).toContainText("Main, Alternate");
  await expect(inspector.getByRole("spinbutton")).toHaveCount(0);

  await alternate.click({ modifiers: ["Shift"] });
  await expect(alternate).toHaveAttribute("aria-pressed", "false");
  await expect(sourceOut).toHaveValue("354");

  await alternate.click({ modifiers: ["Shift"] });
  await stationary.click();
  await expect(harbor).toHaveAttribute("aria-pressed", "false");
  await expect(alternate).toHaveAttribute("aria-pressed", "false");
  await expect(stationary).toHaveAttribute("aria-pressed", "true");
  await expect(sourceOut).toHaveValue("561");

  const [top, middle] = await Promise.all([stationary.boundingBox(), harbor.boundingBox()]);
  if (!top || !middle) throw new Error("Expected placements on Cutaways and Main");
  await page.mouse.click(middle.x + middle.width * 0.75, top.y + top.height / 2);
  await expect(stationary).toHaveAttribute("aria-pressed", "false");
  await expect(inspector).toContainText("Select a placement to edit it.");
  expect(await emissions()).toStrictEqual(noEdits);
});

test("a collision away from the grabbed placement blocks both extending previews and emits no edit", async ({
  page,
}) => {
  const { timeline, harbor, stationary, alternate, emissions } = await openGroupStory(page);
  await harbor.click();
  await alternate.click({ modifiers: ["Shift"] });

  const { top, middle, bottom, pixelsPerFrame } = await groupGeometry(
    stationary,
    harbor,
    alternate,
  );
  const topY = top.y + top.height / 2;
  const middleY = middle.y + middle.height / 2;
  const grabX = bottom.x + 12;
  await page.mouse.move(grabX, bottom.y + bottom.height / 2);
  await page.mouse.down();
  // At frame 150 the grabbed Lighthouse fits on Main [150, 258).
  // Harbor would span [30, 270) on Cutaways, colliding with Lighthouse [0, 60).
  await page.mouse.move(grabX + 30 * pixelsPerFrame, middleY, { steps: 12 });
  await expect(timeline.getByRole("status")).toHaveText(
    "Lighthouse → Main · Sequence frame 150 · Blocked: Overlaps another placement on Cutaways",
  );

  const harborPreview = timeline.getByRole("figure", { name: "Proposed placement: Harbor" });
  const lighthousePreview = timeline.getByRole("figure", {
    name: "Proposed placement: Lighthouse",
  });
  await expect(harborPreview).toBeVisible();
  await expect(lighthousePreview).toBeVisible();
  const [harborDraft, lighthouseDraft] = await Promise.all([
    harborPreview.boundingBox(),
    lighthousePreview.boundingBox(),
  ]);
  if (!harborDraft || !lighthouseDraft) throw new Error("Expected both proposed placements");
  expect(harborDraft.x).toBeCloseTo(middle.x + 30 * pixelsPerFrame, 0);
  expect(harborDraft.y + harborDraft.height / 2).toBeCloseTo(topY, 0);
  expect(harborDraft.width).toBeCloseTo(middle.width, 0);
  expect(lighthouseDraft.x).toBeCloseTo(middle.x + 150 * pixelsPerFrame, 0);
  expect(lighthouseDraft.y + lighthouseDraft.height / 2).toBeCloseTo(middleY, 0);
  expect(lighthouseDraft.width).toBeCloseTo(bottom.width, 0);
  await expect(timeline).toContainText("Duration: 00:04");
  expect(await emissions()).toStrictEqual(noEdits);

  await page.mouse.up();
  await expect(timeline.getByRole("figure")).toHaveCount(0);
  await expect(timeline).toContainText("Duration: 00:04");
  expect(await emissions()).toStrictEqual(noEdits);
  expect(await groupGeometry(stationary, harbor, alternate)).toStrictEqual({
    top,
    middle,
    bottom,
    pixelsPerFrame,
  });
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  await expect(alternate).toHaveAttribute("aria-pressed", "true");
});

test("an edge-touching group previews at the old scale and commits one extending edit", async ({
  page,
}) => {
  const expectedSequence: Sequence = {
    durationFrames: 300,
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
          {
            id: "harbor-bed",
            clipId: "harbor",
            sequenceStartFrame: 60,
            sourceOutOffsetFrames: 120,
          },
        ],
      },
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "lighthouse-alternate",
            clipId: "lighthouse",
            sequenceStartFrame: 180,
            sourceInOffsetFrames: 6,
            sourceOutOffsetFrames: -6,
          },
        ],
      },
      { id: "alternate", label: "Alternate", placements: [] },
    ],
  };
  const expectedCutList: CutList = {
    version: "1.0.0",
    inputMedia: [
      {
        s3Location: "s3://sequence-fixtures/lighthouse.mp4",
        sections: [{ startFrame: 501, endFrame: 561 }],
      },
      {
        s3Location: "s3://sequence-fixtures/harbor.mp4",
        sections: [{ startFrame: 114, endFrame: 354 }],
      },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0 },
    ],
  };

  const { timeline, harbor, stationary, alternate, emissions } = await openGroupStory(page);
  await harbor.click();
  await alternate.click({ modifiers: ["Shift"] });
  const { top, middle, bottom, pixelsPerFrame } = await groupGeometry(
    stationary,
    harbor,
    alternate,
  );
  const grabX = bottom.x + 12;
  const middleY = middle.y + middle.height / 2;
  const topY = top.y + top.height / 2;
  await page.mouse.move(grabX, bottom.y + bottom.height / 2);
  await page.mouse.down();
  // The stationary Lighthouse ends at 60. Harbor moves to [60, 300),
  // covering the other Lighthouse at [180, 288) on Main.
  await page.mouse.move(grabX + 60 * pixelsPerFrame, middleY, { steps: 12 });
  await expect(timeline.getByRole("status")).toHaveText("Lighthouse → Main · Sequence frame 180");

  const harborPreview = timeline.getByRole("figure", { name: "Proposed placement: Harbor" });
  const lighthousePreview = timeline.getByRole("figure", {
    name: "Proposed placement: Lighthouse",
  });
  await expect(harborPreview).toBeVisible();
  await expect(lighthousePreview).toBeVisible();
  const [harborDraft, lighthouseDraft] = await Promise.all([
    harborPreview.boundingBox(),
    lighthousePreview.boundingBox(),
  ]);
  if (!harborDraft || !lighthouseDraft) throw new Error("Expected both proposed placements");
  expect(harborDraft.x).toBeCloseTo(middle.x + 60 * pixelsPerFrame, 0);
  expect(harborDraft.y + harborDraft.height / 2).toBeCloseTo(topY, 0);
  expect(harborDraft.width).toBeCloseTo(middle.width, 0);
  expect(lighthouseDraft.x).toBeCloseTo(middle.x + 180 * pixelsPerFrame, 0);
  expect(lighthouseDraft.y + lighthouseDraft.height / 2).toBeCloseTo(middleY, 0);
  expect(lighthouseDraft.width).toBeCloseTo(bottom.width, 0);
  await expect(timeline).toContainText("Duration: 00:04");
  expect(await emissions()).toStrictEqual(noEdits);

  await page.mouse.up();
  await expect.poll(emissions).toStrictEqual({
    sequences: [expectedSequence],
    cutLists: [expectedCutList],
  });
  await expect(timeline.getByRole("figure")).toHaveCount(0);
  await expect(timeline).toContainText("Duration: 00:05");
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  await expect(alternate).toHaveAttribute("aria-pressed", "true");
  await expect(stationary).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("region", { name: "Selection inspector" })).toContainText(
    "Cutaways, Main",
  );
});

test("the group readout shows an offscreen companion even when it shifts outside the tracks", async ({
  page,
}) => {
  const { timeline, harbor, stationary, alternate, emissions } = await openGroupStory(page);
  await harbor.click();
  await alternate.click({ modifiers: ["Shift"] });
  const { middle, bottom, pixelsPerFrame } = await groupGeometry(stationary, harbor, alternate);
  const grabX = middle.x + 12;
  const middleY = middle.y + middle.height / 2;
  const bottomY = bottom.y + bottom.height / 2;
  await page.mouse.move(grabX, middleY);
  await page.mouse.down();

  // With Harbor at 130, the companion starts at 250, beyond the 240-frame viewport.
  const x = grabX + 130 * pixelsPerFrame;
  await page.mouse.move(x, middleY, { steps: 12 });
  await expect(timeline.getByRole("status")).toHaveText("Harbor → Main · Sequence frame 130");
  const companionPreview = timeline.getByRole("figure", {
    name: "Proposed placement: Lighthouse",
  });
  await expect(companionPreview).toHaveCount(1);
  await expect(companionPreview).not.toBeInViewport();
  const companions = timeline.getByRole("list", { name: "Other proposed placements" });
  await expect(companions.getByRole("listitem")).toHaveText(
    "Lighthouse → Alternate · Sequence frame 250",
  );

  await page.mouse.move(x, bottomY, { steps: 4 });
  await expect(timeline.getByRole("status")).toHaveText(
    "Harbor → Alternate · Sequence frame 130 · Blocked: Drop onto an existing track",
  );
  await expect(companionPreview).toHaveCount(0);
  await expect(companions.getByRole("listitem")).toHaveText(
    "Lighthouse → Outside existing tracks · Sequence frame 250",
  );

  // Move the grabbed placement one row above the top track. Its companion
  // still has an exact destination: one row lower, on Cutaways.
  await page.mouse.move(x, middleY - 2 * (bottomY - middleY), { steps: 8 });
  await expect(timeline.getByRole("status")).toHaveText(
    "Harbor · Sequence frame 130 · Blocked: Drop onto an existing track",
  );
  await expect(companions.getByRole("listitem")).toHaveText(
    "Lighthouse → Cutaways · Sequence frame 250",
  );

  await page.mouse.up();
  await expect(companions).toHaveCount(0);
  expect(await emissions()).toStrictEqual(noEdits);
});

test("dragging an unselected placement leaves the existing selection in place", async ({
  page,
}) => {
  const { timeline, harbor, stationary, alternate, emissions } = await openGroupStory(page);
  await harbor.click();
  await alternate.click({ modifiers: ["Shift"] });
  const { top, pixelsPerFrame } = await groupGeometry(stationary, harbor, alternate);
  const grabX = top.x + top.width / 2;
  const y = top.y + top.height / 2;
  await page.mouse.move(grabX, y);
  await page.mouse.down();
  await page.mouse.move(grabX + 30 * pixelsPerFrame, y, { steps: 12 });
  await expect(timeline.getByRole("status")).toHaveText(
    "Lighthouse → Cutaways · Sequence frame 30",
  );
  await expect(timeline.getByRole("figure")).toHaveCount(1);
  await expect(
    timeline.getByRole("figure", { name: "Proposed placement: Lighthouse" }),
  ).toBeVisible();
  expect(await emissions()).toStrictEqual(noEdits);

  await page.mouse.up();
  await expect.poll(emissions).toStrictEqual({
    sequences: [
      {
        durationFrames: 240,
        tracks: [
          {
            id: "cutaways",
            label: "Cutaways",
            placements: [
              {
                id: "lighthouse-open",
                clipId: "lighthouse",
                sequenceStartFrame: 30,
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
    cutLists: [
      {
        version: "1.0.0",
        inputMedia: [
          {
            s3Location: "s3://sequence-fixtures/harbor.mp4",
            sections: [
              { startFrame: 114, endFrame: 144 },
              { startFrame: 204, endFrame: 354 },
            ],
          },
          {
            s3Location: "s3://sequence-fixtures/lighthouse.mp4",
            sections: [{ startFrame: 501, endFrame: 561 }],
          },
        ],
        outputTrack: [
          { mediaIndex: 0, sectionIndex: 0 },
          { mediaIndex: 1, sectionIndex: 0 },
          { mediaIndex: 0, sectionIndex: 1 },
        ],
      },
    ],
  });
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  await expect(alternate).toHaveAttribute("aria-pressed", "true");
  await expect(stationary).toHaveAttribute("aria-pressed", "false");
});
