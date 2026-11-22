import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

async function bounds(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Expected ${locator} to be visible`);
  return box;
}

async function resize(page: Page, name: string, pixels: number) {
  const { x, y, width, height } = await bounds(page.getByRole("separator", { name, exact: true }));
  const startX = x + width / 2;
  const startY = y + height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + pixels, startY, { steps: 4 });
  await page.mouse.up();
}

test("hiding and restoring the Inspector gives Preview space without losing the selected edit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);

  const timeline = page.getByRole("region", { name: "Sequence timeline", exact: true });
  await timeline.getByRole("button", { name: "Harbor", exact: true }).last().click();
  const inspector = page.getByRole("region", { name: "Inspector", exact: true });
  await inspector.getByRole("spinbutton", { name: "Source out (exclusive frame)" }).fill("220");
  await inspector.getByRole("button", { name: "Trim placement" }).click();
  const trimmedRange = inspector.getByText(
    "Source in/out (source frames): 120 inclusive – 220 exclusive",
    { exact: true },
  );
  await expect(trimmedRange).toBeVisible();
  const editsBeforeToggle = await emissions();
  expect(editsBeforeToggle.sequences).toHaveLength(1);
  expect(editsBeforeToggle.cutLists).toHaveLength(1);

  const controls = page.getByRole("group", { name: "Workspace panes" });
  const toggle = controls.getByRole("button", { name: "Inspector", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  const preview = page.getByRole("region", { name: "Preview", exact: true });
  const initialPreviewWidth = (await bounds(preview)).width;
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(inspector).toBeHidden();
  expect((await bounds(preview)).width).toBeGreaterThan(initialPreviewWidth);
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeEnabled();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(trimmedRange).toBeVisible();
  expect(await emissions()).toStrictEqual(editsBeforeToggle);
});

test("the toolbar can restore the hidden timeline without losing the playhead or selection", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);
  const editor = page.getByRole("region", { name: "Sequence editor", exact: true });
  const timeline = editor.getByRole("region", { name: "Sequence timeline", exact: true });
  const placement = timeline.getByRole("button", { name: "Harbor", exact: true }).last();
  await placement.click();
  await timeline.getByRole("slider", { name: "Sequence playhead", exact: true }).press("End");
  const caret = editor.getByLabel("Sequence playhead position");
  await expect(caret).toHaveText("Sequence frame 360");
  const before = await bounds(editor);

  const toggle = editor
    .getByRole("group", { name: "Workspace panes" })
    .getByRole("button", { name: "Sequence timeline", exact: true });
  await toggle.click();
  await expect(timeline).toBeHidden();
  await expect(toggle).toBeVisible();
  expect((await bounds(editor)).height).toBeLessThan(before.height);
  await expect(editor.getByRole("button", { name: "Delete", exact: true })).toBeEnabled();
  await expect(caret).toHaveText("Sequence frame 360");

  await toggle.click();
  await expect(placement).toHaveAttribute("aria-pressed", "true");
  await expect(
    timeline.getByRole("slider", { name: "Sequence playhead", exact: true }),
  ).toHaveAttribute("aria-valuenow", "360");
  expect(await emissions()).toStrictEqual(noEdits);
});

test("a hidden Inspector keeps its resized width while other panes are resized", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);
  const inspector = page.getByRole("region", { name: "Inspector", exact: true });
  const pool = page.getByRole("region", { name: "Clip pool", exact: true });
  const toggle = page
    .getByRole("group", { name: "Workspace panes" })
    .getByRole("button", { name: "Inspector", exact: true });

  const initialWidth = (await bounds(inspector)).width;
  await resize(page, "Resize Preview and Inspector", -64);
  const resizedWidth = (await bounds(inspector)).width;
  expect(resizedWidth).toBeCloseTo(initialWidth + 64, 0);

  await toggle.click();
  await expect(inspector).toBeHidden();
  const poolWidth = (await bounds(pool)).width;
  await resize(page, "Resize Clip pool and Preview", 80);
  expect((await bounds(pool)).width).toBeCloseTo(poolWidth + 80, 0);
  await toggle.click();
  await expect(inspector).toBeVisible();
  expect((await bounds(inspector)).width).toBeCloseTo(resizedWidth, 0);
  expect(await emissions()).toStrictEqual(noEdits);
});

test("one visible pane fills the workspace and the toolbar remains when every pane is hidden", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);
  const controls = page.getByRole("group", { name: "Workspace panes" });
  const toggle = (name: string) => controls.getByRole("button", { name, exact: true });
  const pane = (name: string) => page.getByRole("region", { name, exact: true });
  const fullWidth = (await bounds(pane("Sequence timeline"))).width;

  await toggle("Clip pool").click();
  await expect(pane("Clip pool")).toBeHidden();
  await expect(pane("Preview")).toBeVisible();
  await expect(page.getByRole("separator", { name: "Resize Preview and Inspector" })).toBeVisible();

  await toggle("Preview").click();
  await expect(pane("Preview")).toBeHidden();
  await expect(page.getByRole("separator")).toHaveCount(0);
  expect((await bounds(pane("Inspector"))).width).toBeCloseTo(fullWidth, 0);

  for (const name of ["Inspector", "Sequence timeline"]) {
    await toggle(name).click();
    await expect(pane(name)).toBeHidden();
  }
  await expect(controls).toBeVisible();
  await toggle("Preview").click();
  await expect(pane("Preview")).toBeVisible();
  await expect(pane("Clip pool")).toBeHidden();
  expect(await emissions()).toStrictEqual(noEdits);
});
