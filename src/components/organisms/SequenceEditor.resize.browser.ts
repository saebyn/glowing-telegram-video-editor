import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

async function box(pane: Locator) {
  const bounds = await pane.boundingBox();
  if (!bounds) throw new Error(`Expected ${pane} to be visible`);
  return bounds;
}

async function workspace(page: Page) {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await openWorkflow(page, roughCutStoryId);
  return {
    clipPool: page.getByRole("region", { name: "Clip pool", exact: true }),
    preview: page.getByRole("region", { name: "Preview", exact: true }),
    inspector: page.getByRole("region", { name: "Inspector", exact: true }),
    poolSeparator: page.getByRole("separator", { name: "Resize Clip pool and Preview" }),
    inspectorSeparator: page.getByRole("separator", { name: "Resize Preview and Inspector" }),
  };
}

async function moveSeparator(page: Page, separator: Locator, delta: number) {
  await expect(separator).toBeVisible();
  await separator.scrollIntoViewIfNeeded();
  const handle = await box(separator);
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + delta, y, { steps: 4 });
}

test("dragging the Clip pool separator takes space from Preview without editing the sequence", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const { clipPool, preview, inspector, poolSeparator } = await workspace(page);
  const beforePool = (await box(clipPool)).width;
  const beforePreview = (await box(preview)).width;
  const beforeInspector = await box(inspector);

  await moveSeparator(page, poolSeparator, 72);
  expect((await box(clipPool)).width).toBeCloseTo(beforePool + 72, 0);
  expect((await box(preview)).width).toBeCloseTo(beforePreview - 72, 0);
  expect(await emissions()).toStrictEqual(noEdits);
  await page.mouse.up();

  expect((await box(clipPool)).width).toBeCloseTo(beforePool + 72, 0);
  expect((await box(inspector)).width).toBeCloseTo(beforeInspector.width, 0);
  expect((await box(inspector)).x).toBeCloseTo(beforeInspector.x, 0);
  expect(await emissions()).toStrictEqual(noEdits);
  expect(pageErrors).toStrictEqual([]);
});

test("dragging beyond the usable pane widths stops at the limits", async ({ page }) => {
  const { clipPool, preview, inspector, poolSeparator, inspectorSeparator } = await workspace(page);
  const initialInspector = await box(inspector);

  await moveSeparator(page, poolSeparator, -340);
  await page.mouse.up();
  const smallestPool = await box(clipPool);
  expect(smallestPool.width).toBeCloseTo(192, 0); // One 136px clip card plus breathing room.
  expect((await box(inspector)).x).toBeCloseTo(initialInspector.x, 0);

  await moveSeparator(page, inspectorSeparator, 240);
  await page.mouse.up();
  const smallestInspector = await box(inspector);
  expect(smallestInspector.width).toBeCloseTo(224, 0);
  expect((await box(clipPool)).width).toBeCloseTo(smallestPool.width, 0);

  // Cross the whole Preview, not just its minimum, without losing pointer capture.
  await moveSeparator(page, poolSeparator, 900);
  await page.mouse.up();
  expect((await box(preview)).width).toBeCloseTo(224, 0);
  expect((await box(inspector)).x).toBeCloseTo(smallestInspector.x, 0);

  await page
    .getByRole("region", { name: "Sequence timeline" })
    .getByRole("button", { name: "Harbor", exact: true })
    .first()
    .click();
  const field = inspector.getByRole("spinbutton", { name: "Source out (exclusive frame)" });
  await expect(field).toBeEditable();
  const fieldBounds = await box(field);
  expect(fieldBounds.x + fieldBounds.width).toBeLessThan(
    smallestInspector.x + smallestInspector.width,
  );
});

test("a narrow viewport stacks panes and preserves the widths set with the keyboard", async ({
  page,
}) => {
  const { clipPool, preview, inspector, inspectorSeparator } = await workspace(page);
  const beforePreview = (await box(preview)).width;
  await inspectorSeparator.press("ArrowLeft");
  const resizedPreview = (await box(preview)).width;
  expect(resizedPreview).toBeLessThan(beforePreview);

  await page.setViewportSize({ width: 480, height: 1000 });
  await expect(page.getByRole("separator")).toHaveCount(0);
  const [pool, player, fields] = await Promise.all([box(clipPool), box(preview), box(inspector)]);
  expect(player.y).toBeGreaterThanOrEqual(pool.y + pool.height);
  expect(fields.y).toBeGreaterThanOrEqual(player.y + player.height);
  expect(player.width).toBeCloseTo(pool.width, 0);
  expect(fields.width).toBeCloseTo(pool.width, 0);

  await page.setViewportSize({ width: 1280, height: 1000 });
  await expect(inspectorSeparator).toBeVisible();
  expect((await box(preview)).width).toBeCloseTo(resizedPreview, 0);

  await inspectorSeparator.press("a");
  expect((await box(preview)).width).toBeCloseTo(resizedPreview, 0);
  await inspectorSeparator.press("ArrowRight");
  expect((await box(preview)).width).toBeCloseTo(beforePreview, 0);
});
