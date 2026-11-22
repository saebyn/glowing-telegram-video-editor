import { expect, test, type Page } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";
import type { Sequence } from "@/types";

const straightCutStory =
  "/iframe.html?id=organisms-sequenceeditor--straight-cut-fixture&viewMode=story";

async function recordEditorEmissions(page: Page) {
  type Emissions = { sequences: Sequence[]; cutLists: (CutList | null)[] };
  type RecordingWindow = Window & { sequenceEditorEmissions?: Emissions };
  await page.addInitScript(() => {
    const emissions: Emissions = { sequences: [], cutLists: [] };
    (window as RecordingWindow).sequenceEditorEmissions = emissions;
    window.addEventListener("sequence-editor:sequence-change", (event) => {
      emissions.sequences.push((event as CustomEvent<Sequence>).detail);
    });
    window.addEventListener("sequence-editor:cut-list-change", (event) => {
      emissions.cutLists.push((event as CustomEvent<CutList | null>).detail);
    });
  });
  return () => page.evaluate(() => (window as RecordingWindow).sequenceEditorEmissions);
}

test("dropping a pool clip in the existing gap emits the exact CutList", async ({ page }) => {
  const expected: CutList = {
    version: "1.0.0",
    inputMedia: [
      {
        s3Location: "s3://sequence-fixtures/harbor.mp4",
        sections: [
          { startFrame: 114, endFrame: 234 },
          { startFrame: 120, endFrame: 240 },
        ],
      },
      {
        s3Location: "s3://sequence-fixtures/lighthouse.mp4",
        sections: [{ startFrame: 501, endFrame: 621 }],
      },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0 },
      { mediaIndex: 0, sectionIndex: 1 },
    ],
  };

  const emissions: (CutList | null)[] = [];
  await page.exposeFunction("recordCutList", (cutList: CutList | null) => emissions.push(cutList));
  await page.addInitScript(() => {
    window.addEventListener("sequence-editor:cut-list-change", (event) => {
      const hostWindow = window as Window & {
        recordCutList?: (cutList: CutList | null) => Promise<void>;
      };
      void hostWindow.recordCutList?.((event as CustomEvent<CutList | null>).detail);
    });
  });
  await page.goto("/iframe.html?id=organisms-sequenceeditor--gap-fixture&viewMode=story");

  const pool = page.getByRole("heading", { name: "Clip Pool" }).locator("..");
  const lighthouse = pool.locator('[draggable="true"]').filter({ hasText: "Lighthouse" });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByText("Harbor", { exact: true });
  await expect(harbor).toHaveCount(2);
  await expect(timeline).not.toContainText("Lighthouse");

  const [source, left, right] = await Promise.all([
    lighthouse.boundingBox(),
    harbor.first().boundingBox(),
    harbor.last().boundingBox(),
  ]);
  if (!source || !left || !right || left.x + left.width >= right.x) {
    throw new Error("Expected a visible Lighthouse card and a gap between Harbor placements");
  }

  const startX = source.x + source.width / 2;
  const startY = source.y + source.height / 2;
  async function drag(toX: number, toY: number) {
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(toX, toY, { steps: 24 });
    // A second move over the target gives the browser another dragover before mouseup.
    await page.mouse.move(toX + 1, toY);
    await page.mouse.up();
  }

  const rowY = left.y + left.height / 2;
  // An occupied position is not a gap and must not commit an edit.
  await drag(left.x + left.width / 2, rowY);
  await expect(timeline).not.toContainText("Lighthouse");
  await drag((left.x + left.width + right.x) / 2, rowY);

  await expect.poll(() => emissions).toStrictEqual([expected]);
  await expect(timeline.getByText("Lighthouse", { exact: true })).toBeVisible();
  await expect(timeline).toContainText("Duration: 00:06");
});

test("applying an entry fade emits the edited placement and its exact CutList edge", async ({
  page,
}) => {
  const expectedSequence: Sequence = {
    durationFrames: 240,
    tracks: [
      {
        id: "main",
        label: "Main",
        placements: [
          { id: "harbor-open", clipId: "harbor", sequenceStartFrame: 0 },
          {
            id: "lighthouse-next",
            clipId: "lighthouse",
            sequenceStartFrame: 120,
            entryTransitionFrames: 30,
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
        sections: [{ startFrame: 114, endFrame: 234 }],
      },
      {
        s3Location: "s3://sequence-fixtures/lighthouse.mp4",
        sections: [{ startFrame: 501, endFrame: 621 }],
      },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 1, sectionIndex: 0, transitionIn: { type: "fade", duration: 30 } },
    ],
  };

  const emissions = await recordEditorEmissions(page);
  const noEdits = { sequences: [], cutLists: [] };

  await page.goto(straightCutStory);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await expect(timeline).toBeVisible();
  expect(await emissions()).toStrictEqual(noEdits);

  await lighthouse.click({ timeout: 3_000 });
  const duration = page.getByLabel("Entry fade duration (sequence frames)");
  await expect(duration).toBeVisible();
  expect(await emissions()).toStrictEqual(noEdits);

  await duration.fill("30");
  expect(await emissions()).toStrictEqual(noEdits);
  const indicator = timeline.getByText("Fade in", { exact: true });
  await expect(indicator).toHaveCount(0);
  await page.getByRole("button", { name: "Apply entry fade", exact: true }).click();

  await expect(indicator).toBeVisible();
  await expect(timeline.getByText("Transitions", { exact: true })).toHaveCount(0);
  const [placementBox, fadeBox] = await Promise.all([
    lighthouse.boundingBox(),
    indicator.boundingBox(),
  ]);
  if (!placementBox || !fadeBox) throw new Error("Expected a visible placement and fade marker");
  expect(fadeBox.y).toBeGreaterThanOrEqual(placementBox.y);
  expect(fadeBox.y + fadeBox.height).toBeLessThanOrEqual(placementBox.y + placementBox.height);
  expect(Math.abs(fadeBox.x - placementBox.x)).toBeLessThan(2);
  // The 30-frame fade spans one quarter of the 120-frame placement.
  expect(Math.abs(fadeBox.width - placementBox.width / 4)).toBeLessThan(2);
  expect(await emissions()).toStrictEqual({
    sequences: [expectedSequence],
    cutLists: [expectedCutList],
  });
});

test("applying a reveal fade marks Harbor's trailing edge without moving the cut", async ({
  page,
}) => {
  const expectedSequence: Sequence = {
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
            revealTransitionFrames: 48,
          },
          { id: "lighthouse-next", clipId: "lighthouse", sequenceStartFrame: 120 },
        ],
      },
    ],
  };
  const expectedCutList: CutList = {
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
      { mediaIndex: 0, sectionIndex: 0, transitionOut: { type: "fade", duration: 48 } },
      { mediaIndex: 1, sectionIndex: 0 },
    ],
  };

  const emissions = await recordEditorEmissions(page);
  await page.goto(straightCutStory);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  await harbor.click();

  const duration = page.getByLabel("Reveal fade duration (sequence frames)");
  await duration.fill("48", { timeout: 3_000 });
  expect(await emissions()).toStrictEqual({ sequences: [], cutLists: [] });
  const indicator = timeline.getByText("Fade out", { exact: true });
  await expect(indicator).toHaveCount(0);
  await page.getByRole("button", { name: "Apply reveal fade", exact: true }).click();

  await expect.poll(emissions).toStrictEqual({
    sequences: [expectedSequence],
    cutLists: [expectedCutList],
  });
  await expect(indicator).toBeVisible();
  await expect(timeline.getByText("Transitions", { exact: true })).toHaveCount(0);
  const [placementBox, fadeBox] = await Promise.all([
    harbor.boundingBox(),
    indicator.boundingBox(),
  ]);
  if (!placementBox || !fadeBox) throw new Error("Expected a visible placement and fade marker");
  expect(fadeBox.y).toBeGreaterThanOrEqual(placementBox.y);
  expect(fadeBox.y + fadeBox.height).toBeLessThanOrEqual(placementBox.y + placementBox.height);
  expect(Math.abs(fadeBox.x + fadeBox.width - (placementBox.x + placementBox.width))).toBeLessThan(
    2,
  );
  // The 48-frame fade occupies 40% of Harbor's 120-frame placement.
  expect(Math.abs(fadeBox.width - placementBox.width * 0.4)).toBeLessThan(2);
});
