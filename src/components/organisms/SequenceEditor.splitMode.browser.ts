import { expect, test } from "@playwright/test";
import {
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

test("Split mode cuts only the clicked placement at the pointer and leaves selection and playhead alone", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, layeredEditStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await harbor.click();
  const toggle = page.getByRole("button", { name: "Split mode", exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await emissions()).toEqual(noEdits);
  await lighthouse.first().scrollIntoViewIfNeeded();
  const box = (await lighthouse.first().boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await expect(timeline.getByText("Split at sequence frame 30", { exact: true })).toBeVisible();
  await page.mouse.click(x, y);
  await expect
    .poll(async () =>
      (await emissions()).sequences[0]?.tracks.map(({ placements }) => placements.length),
    )
    .toEqual([2, 1, 1]);
  const { sequences, cutLists } = await emissions();
  expect(sequences[0].tracks[0].placements[1]).toMatchObject({
    id: expect.stringMatching(/\S/),
    sequenceStartFrame: 30,
    sourceInOffsetFrames: 30,
  });
  expect(cutLists).toHaveLength(1);
  await expect(timeline.getByText("Split at sequence frame 30", { exact: true })).toHaveCount(0);
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  await expect(lighthouse.nth(1)).toHaveAttribute("aria-pressed", "false");
  const remainingIds = sequences[0].tracks.flatMap(({ placements }) =>
    placements.map(({ id }) => id),
  );
  expect(new Set(remainingIds).size).toBe(4);
  await expect(page.getByLabel("Sequence playhead position")).toHaveText("Sequence frame 0");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(lighthouse).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await lighthouse.first().click();
  await expect(lighthouse.first()).toHaveAttribute("aria-pressed", "true");
});

test("Split mode ignores drags, empty space and edge clicks but uses the panned scale", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbors = timeline.getByRole("button", { name: "Harbor", exact: true });
  const playhead = page.getByLabel("Sequence playhead position");
  await harbors.first().click();
  await page.getByRole("button", { name: "Split mode", exact: true }).click();
  await harbors.first().scrollIntoViewIfNeeded();
  const first = (await harbors.first().boundingBox())!;
  const last = (await harbors.last().boundingBox())!;
  const ruler = (await timeline.locator(".timeline-editor-time-area-interact").boundingBox())!;
  const y = first.y + first.height / 2;
  await page.mouse.click(ruler.x + 0.25, y);
  await page.mouse.click((first.x + first.width + last.x) / 2, y);
  await page.mouse.move(first.x + first.width / 3, y);
  await page.mouse.down();
  await page.mouse.move(first.x + (first.width * 2) / 3, y, { steps: 6 });
  await page.mouse.up();
  expect(await emissions()).toEqual(noEdits);
  await expect(harbors.first()).toHaveAttribute("aria-pressed", "true");
  await expect(timeline.getByRole("button", { name: "Trim leading edge: Harbor" })).toHaveCount(0);

  await timeline.getByRole("button", { name: "Zoom in" }).click();
  const pan = timeline.getByRole("slider", { name: "Pan timeline" });
  await pan.focus();
  await page.keyboard.press("End");
  expect(Number(await pan.inputValue())).toBeGreaterThan(0);
  await harbors.last().scrollIntoViewIfNeeded();
  const closing = (await harbors.last().boundingBox())!;
  const cutX = closing.x + closing.width / 2;
  const cutY = closing.y + closing.height / 2;
  await page.mouse.move(cutX, cutY);
  await expect(timeline.getByText("Split at sequence frame 300", { exact: true })).toBeVisible();
  expect(await emissions()).toEqual(noEdits);
  await page.mouse.click(cutX, cutY);
  await expect
    .poll(async () => (await emissions()).sequences[0]?.tracks[0].placements[2].sequenceStartFrame)
    .toBe(300);
  await expect(playhead).toHaveText("Sequence frame 0");
});
