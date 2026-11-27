import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  openWorkflow,
  roughCutDepartureAt,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

type RecordingWindow = Window & { playheadEdits?: string[] };

async function openSequence(page: Page, departureStart?: number, omitPreview = false) {
  await page.addInitScript(() => {
    const emissions: string[] = [];
    (window as RecordingWindow).playheadEdits = emissions;
    for (const name of ["sequence-editor:sequence-change", "sequence-editor:cut-list-result"]) {
      window.addEventListener(name, () => emissions.push(name));
    }
  });
  await openWorkflow(page, roughCutStoryId, {
    ...(departureStart === undefined ? {} : roughCutDepartureAt(departureStart).args),
    ...(omitPreview ? { omitPreview: "true" } : {}),
  });
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const ruler = timeline.locator(".timeline-editor-time-area-interact");
  await expect(ruler).toBeVisible();
  return {
    timeline,
    ruler,
    frameReadout: page.getByLabel("Sequence playhead position"),
    edits: () => page.evaluate(() => (window as RecordingWindow).playheadEdits),
  };
}

async function readPlaybackFrame(readout: Locator, onTime: number, oneTickBehind: number) {
  // The clock can stop between animation ticks. At 60 fps the displayed frame
  // can be one sequence frame behind the exact elapsed-time position.
  await expect(readout).toHaveText(new RegExp(`^Sequence frame (${onTime}|${oneTickBehind})$`));
  return Number((await readout.innerText()).slice("Sequence frame ".length));
}

test("transport shows timecode and frame count when stepping, jumping, and stopping", async ({
  page,
}) => {
  const { timeline, frameReadout, edits } = await openSequence(page);
  const transport = page.getByRole("group", { name: "Sequence transport" });
  await expect(transport.getByText("00:00:00:00 0 fr", { exact: true })).toBeVisible();
  const playhead = timeline.getByRole("slider", { name: "Sequence playhead", exact: true });
  await playhead.press("ArrowRight");
  await expect(transport.getByText("00:00:00:01 1 fr", { exact: true })).toBeVisible();
  await playhead.press("Home");

  const forward = page.getByRole("button", { name: "Forward", exact: true });
  await forward.click({ timeout: 3_000 });
  await expect(frameReadout).toHaveText("Sequence frame 60");
  await expect(transport.getByText("00:00:01:00 60 fr", { exact: true })).toBeVisible();
  await forward.click();
  await expect(frameReadout).toHaveText("Sequence frame 120");
  await page.getByRole("button", { name: "Rewind", exact: true }).click();
  await expect(frameReadout).toHaveText("Sequence frame 60");

  await page.clock.install({ time: new Date("2025-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2025-01-01T00:00:01Z"));
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.clock.runFor(800);
  await expect(frameReadout).toHaveText("Sequence frame 0");
  await expect(transport.getByText("00:00:00:00 0 fr", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  expect(await edits()).toEqual([]);
});

test("the sequence playhead readout shows hours and minutes on a long sequence", async ({
  page,
}) => {
  const { timeline, edits } = await openSequence(page, 223_324);
  const transport = page.getByRole("group", { name: "Sequence transport" });
  await timeline.getByRole("slider", { name: "Sequence playhead", exact: true }).press("End");
  await expect(transport.getByText("01:02:03:04 223384 fr", { exact: true })).toBeVisible();
  expect(await edits()).toEqual([]);
});

test("clicking the ruler seeks to a whole sequence frame without clearing selection or editing", async ({
  page,
}) => {
  const { timeline, ruler, frameReadout, edits } = await openSequence(page);
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true }).first();
  await harbor.click();
  await expect(harbor).toHaveAttribute("aria-pressed", "true");

  const box = await ruler.boundingBox();
  if (!box) throw new Error("Expected a visible sequence ruler");
  // 34% of the authored 360-frame sequence is 122.4 frames, in its uncovered gap.
  await ruler.click({ position: { x: box.width * 0.34, y: box.height / 2 } });

  await expect(frameReadout).toHaveText("Sequence frame 122");
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  expect(await edits()).toEqual([]);
});

test("dragging the playhead seeks before release and clamps to the authored endpoints", async ({
  page,
}) => {
  const { timeline, ruler, frameReadout, edits } = await openSequence(page);
  const playhead = timeline.getByRole("slider", { name: "Sequence playhead" });
  const rail = await ruler.boundingBox();
  if (!rail) throw new Error("Expected a visible sequence ruler");
  await page.mouse.click(rail.x + rail.width / 2, rail.y + rail.height / 3);
  await expect(frameReadout).toHaveText("Sequence frame 180");

  await expect(playhead).toBeVisible();
  const grip = await playhead.boundingBox();
  if (!grip) throw new Error("Expected a visible playhead");
  const gripCenter = grip.x + grip.width / 2;
  const gripY = grip.y + grip.height / 2;
  expect(Math.abs(gripCenter - (rail.x + rail.width / 2))).toBeLessThan(2);
  await page.mouse.move(gripCenter, gripY);
  await page.mouse.down();
  // Drag beyond the ruler vertically; the grip retains the pointer.
  await page.mouse.move(gripCenter - rail.width / 4, rail.y + rail.height + 15);
  await expect(frameReadout).toHaveText("Sequence frame 90");
  await page.mouse.move(rail.x - 20, gripY);
  await expect(frameReadout).toHaveText("Sequence frame 0");
  await page.mouse.move(rail.x + rail.width + 5, gripY);
  await page.mouse.up();
  await expect(frameReadout).toHaveText("Sequence frame 360");
  expect(await edits()).toEqual([]);
});

test("grabbing the playhead pauses immediately, even if the pointer never moves", async ({
  page,
}) => {
  const { timeline, frameReadout, edits } = await openSequence(page);
  await page.clock.install({ time: new Date("2025-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2025-01-01T00:00:01Z"));
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.clock.runFor(800);
  const grabbedFrame = await readPlaybackFrame(frameReadout, 48, 47);

  const grip = await timeline.getByRole("slider", { name: "Sequence playhead" }).boundingBox();
  if (!grip) throw new Error("Expected a visible playhead");
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.clock.runFor(800);
  await expect(frameReadout).toHaveText(`Sequence frame ${grabbedFrame}`, { timeout: 2_000 });
  await page.mouse.up();
  await expect(frameReadout).toHaveText(`Sequence frame ${grabbedFrame}`);
  expect(await edits()).toEqual([]);
});

test("forward playback crosses the gap without media; pause and ruler-seek hold the frame", async ({
  page,
}) => {
  const { ruler, frameReadout, edits } = await openSequence(page);
  const preview = page.getByRole("region", { name: "Preview", exact: true });
  await expect(preview.getByText("Preview is not connected.")).toBeVisible();
  const start = new Date("2025-01-01T00:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date("2025-01-01T00:00:01Z"));

  const box = await ruler.boundingBox();
  if (!box) throw new Error("Expected a visible sequence ruler");
  await page.mouse.click(box.x + box.width / 4, box.y + box.height / 2);
  await expect(frameReadout).toHaveText("Sequence frame 90");
  await expect(preview).toContainText("Paused · Sequence frame 90 of 360");
  await page.getByRole("button", { name: "Play", exact: true }).click({ timeout: 5_000 });
  await page.clock.runFor(800);
  // At 60 sequence frames per second, 800 ms advances 48 frames into the gap.
  const pausedFrame = await readPlaybackFrame(frameReadout, 138, 137);
  await expect(preview).toContainText(`Playing forward · Sequence frame ${pausedFrame} of 360`);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.runFor(800);
  await expect(frameReadout).toHaveText(`Sequence frame ${pausedFrame}`);
  await expect(preview).toContainText(`Paused · Sequence frame ${pausedFrame} of 360`);

  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.clock.runFor(800);
  await readPlaybackFrame(frameReadout, pausedFrame + 48, pausedFrame + 47);
  await ruler.click({ position: { x: box.width * 0.75, y: box.height / 2 } });
  await page.clock.runFor(800);
  await expect(frameReadout).toHaveText("Sequence frame 270", { timeout: 2_000 });
  expect(await edits()).toEqual([]);
});

test("Space pauses reverse playback while Play reverse has focus", async ({ page }) => {
  const { frameReadout, edits } = await openSequence(page);
  const transport = page.getByRole("group", { name: "Sequence transport" });
  const preview = page.getByRole("region", { name: "Preview", exact: true });
  const forward = transport.getByRole("button", { name: "Forward", exact: true });
  const reverse = transport.getByRole("button", { name: "Play reverse", exact: true });
  await forward.click();
  await forward.click();
  await expect(frameReadout).toHaveText("Sequence frame 120");
  await page.clock.install({ time: new Date("2025-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2025-01-01T00:00:01Z"));

  await reverse.focus();
  await page.keyboard.press("Space");
  await page.clock.runFor(800);
  const frame = await readPlaybackFrame(frameReadout, 72, 73);
  await expect(preview).toContainText(`Playing reverse · Sequence frame ${frame} of 360`);
  await expect(reverse).toBeFocused();
  await expect(reverse).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.down("Space");
  await page.keyboard.down("Space"); // A held key must not restart playback.
  await page.keyboard.up("Space");
  await expect(transport.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(reverse).toHaveAttribute("aria-pressed", "false");
  await page.clock.runFor(800);
  await expect(frameReadout).toHaveText(`Sequence frame ${frame}`);
  await expect(preview).toContainText(`Paused · Sequence frame ${frame} of 360`);
  expect(await edits()).toEqual([]);
});

test("forward and reverse transport stop at the authored sequence boundaries", async ({ page }) => {
  const { timeline, ruler, frameReadout, edits } = await openSequence(page);
  await timeline.getByRole("button", { name: "Harbor", exact: true }).last().click();
  await page.getByLabel("Source out (exclusive frame)").fill("186");
  await page.getByRole("button", { name: "Trim placement", exact: true }).click();
  // Trimming 54 frames from the last placement moves the end to frame 306.
  const trimEdits = ["sequence-editor:sequence-change", "sequence-editor:cut-list-result"];
  await expect.poll(edits).toEqual(trimEdits);

  await page.clock.install({ time: new Date("2025-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2025-01-01T00:00:01Z"));
  const transport = page.getByRole("group", { name: "Sequence transport" });
  const forward = transport.getByRole("button", { name: "Play", exact: true });
  const reverse = transport.getByRole("button", { name: "Play reverse", exact: true });
  await expect(reverse).toHaveAttribute("title", "Play reverse");
  await expect(reverse).toBeDisabled();

  const box = await ruler.boundingBox();
  if (!box) throw new Error("Expected a visible sequence ruler");
  // The fitted frame scale remains based on the original 360-frame edit.
  await ruler.click({ position: { x: (box.width * 230) / 360, y: box.height / 2 } });
  await expect(frameReadout).toHaveText("Sequence frame 230");
  await forward.click();
  await page.clock.runFor(2_000);
  await expect(frameReadout).toHaveText("Sequence frame 306");
  await expect(forward).toBeVisible();

  await reverse.click({ timeout: 5_000 });
  await page.clock.runFor(800);
  await readPlaybackFrame(frameReadout, 258, 259);
  await page.clock.runFor(6_000);
  await expect(frameReadout).toHaveText("Sequence frame 0");
  await expect(forward).toBeVisible();
  await expect(reverse).toBeDisabled();
  expect(await edits()).toEqual(trimEdits);
});

test("a shorter working sequence leaves the playhead parked, even after growth", async ({
  page,
}) => {
  await page.goto(`/?path=/story/${roughCutStoryId}`);
  const story = page.frameLocator("#storybook-preview-iframe");
  const timeline = story.getByRole("region", { name: "Sequence timeline" });
  const ruler = timeline.locator(".timeline-editor-time-area-interact");
  await expect(ruler).toBeVisible({ timeout: 20_000 });
  const rail = await ruler.boundingBox();
  if (!rail) throw new Error("Expected a visible sequence ruler");
  await ruler.click({ position: { x: rail.width * 0.75, y: rail.height / 2 } });
  const frameReadout = story.getByLabel("Sequence playhead position");
  await expect(frameReadout).toHaveText("Sequence frame 270");

  await timeline.getByRole("button", { name: "Harbor", exact: true }).last().click();
  await story.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(timeline).toContainText("Duration: 00:02");
  await expect(frameReadout).toHaveText("Sequence frame 270");

  await story.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(timeline).toContainText("Duration: 00:06");
  await expect(frameReadout).toHaveText("Sequence frame 270", { timeout: 2_000 });
});

test("deleting the tail parks a playing playhead without Preview and transport recovers from the end", async ({
  page,
}) => {
  const { timeline, frameReadout, edits } = await openSequence(page, undefined, true);
  const editor = page.getByRole("region", { name: "Sequence editor", exact: true });
  const playhead = timeline.getByRole("slider", { name: "Sequence playhead", exact: true });
  const play = editor.getByRole("button", { name: "Play", exact: true });
  const reverse = editor.getByRole("button", { name: "Play reverse", exact: true });
  const undo = editor.getByRole("button", { name: "Undo", exact: true });
  const redo = editor.getByRole("button", { name: "Redo", exact: true });
  await expect(editor.getByRole("region", { name: "Preview", exact: true })).toHaveCount(0);
  await timeline.getByRole("button", { name: "Harbor", exact: true }).last().click();
  await playhead.press("End");
  await editor.press("ArrowLeft");
  const start = new Date("2025-01-01T00:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1_000));
  await play.click();
  await expect(editor.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Delete", exact: true }).click();
  const expectFrame = (frame: number) => expect(frameReadout).toHaveText(`Sequence frame ${frame}`);
  await expect(play).toBeVisible();
  await page.clock.runFor(500);
  await expectFrame(359);

  await undo.click();
  await expect(timeline).toContainText("Duration: 00:06");
  await expectFrame(359);
  await redo.click();
  await expect(timeline).toContainText("Duration: 00:02");
  await expectFrame(359);
  await editor.press("ArrowLeft");
  await expectFrame(119); // Clamp to 120 first, then step.

  async function parkAgain() {
    await undo.click();
    await expect(timeline).toContainText("Duration: 00:06");
    await playhead.press("End");
    await expectFrame(360);
    await redo.click();
    await expect(timeline).toContainText("Duration: 00:02");
    await expectFrame(360);
  }
  await parkAgain();
  await editor.getByRole("button", { name: "Rewind", exact: true }).click();
  await expectFrame(60);
  await parkAgain();
  await play.click();
  await expectFrame(120);
  await expect(play).toBeVisible();
  await parkAgain();
  await reverse.click();
  await expectFrame(120);
  await page.clock.runFor(500);
  await readPlaybackFrame(frameReadout, 90, 91);
  // Only delete and the four Undo/Redo pairs emit host edits.
  expect(await edits()).toHaveLength(18);
});
