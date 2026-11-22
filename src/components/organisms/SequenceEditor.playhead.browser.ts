import { expect, test, type Locator, type Page } from "@playwright/test";
import { openWorkflow, roughCutStoryId } from "./SequenceEditor.browserHarness";

type RecordingWindow = Window & { playheadEdits?: string[] };

async function openSequence(page: Page, durationFrames?: number) {
  await page.addInitScript(() => {
    const emissions: string[] = [];
    (window as RecordingWindow).playheadEdits = emissions;
    for (const name of ["sequence-editor:sequence-change", "sequence-editor:cut-list-change"]) {
      window.addEventListener(name, () => emissions.push(name));
    }
  });
  await openWorkflow(
    page,
    roughCutStoryId,
    durationFrames === undefined ? {} : { "sequence.durationFrames": durationFrames },
  );
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
  const { timeline, edits } = await openSequence(page, 223_384);
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
  await expect(page.getByText("Preview is not connected.")).toBeVisible();
  const start = new Date("2025-01-01T00:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date("2025-01-01T00:00:01Z"));

  const box = await ruler.boundingBox();
  if (!box) throw new Error("Expected a visible sequence ruler");
  await page.mouse.click(box.x + box.width / 4, box.y + box.height / 2);
  await expect(frameReadout).toHaveText("Sequence frame 90");
  await page.getByRole("button", { name: "Play", exact: true }).click({ timeout: 5_000 });
  await page.clock.runFor(800);
  // At 60 sequence frames per second, 800 ms advances 48 frames into the gap.
  const pausedFrame = await readPlaybackFrame(frameReadout, 138, 137);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.runFor(800);
  await expect(frameReadout).toHaveText(`Sequence frame ${pausedFrame}`);

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
  await expect(reverse).toBeFocused();
  await expect(reverse).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.down("Space");
  await page.keyboard.down("Space"); // A held key must not restart playback.
  await page.keyboard.up("Space");
  await expect(transport.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  await expect(reverse).toHaveAttribute("aria-pressed", "false");
  await page.clock.runFor(800);
  await expect(frameReadout).toHaveText(`Sequence frame ${frame}`);
  expect(await edits()).toEqual([]);
});

test("forward and reverse transport stop at the authored sequence boundaries", async ({ page }) => {
  const { timeline, ruler, frameReadout, edits } = await openSequence(page);
  await timeline.getByRole("button", { name: "Harbor", exact: true }).last().click();
  await page.getByLabel("Source out (exclusive frame)").fill("186");
  await page.getByRole("button", { name: "Trim placement", exact: true }).click();
  // Trimming 60 frames from the last placement leaves [300, 360) uncovered.
  const trimEdits = ["sequence-editor:sequence-change", "sequence-editor:cut-list-change"];
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
  await ruler.click({ position: { x: box.width * 0.75, y: box.height / 2 } });
  await expect(frameReadout).toHaveText("Sequence frame 270");
  await forward.click();
  await page.clock.runFor(2_000);
  await expect(frameReadout).toHaveText("Sequence frame 360");
  await expect(forward).toBeVisible();

  await reverse.click({ timeout: 5_000 });
  await page.clock.runFor(800);
  await readPlaybackFrame(frameReadout, 312, 313);
  await page.clock.runFor(6_000);
  await expect(frameReadout).toHaveText("Sequence frame 0");
  await expect(forward).toBeVisible();
  await expect(reverse).toBeDisabled();
  expect(await edits()).toEqual(trimEdits);
});

test("a shorter host sequence clamps the paused frame permanently, even after growth", async ({
  page,
}) => {
  await page.goto(`/?path=/story/${roughCutStoryId}`);
  const story = page.frameLocator("#storybook-preview-iframe");
  const timeline = story.getByRole("region", { name: "Sequence timeline" });
  const ruler = timeline.locator(".timeline-editor-time-area-interact");
  await expect(ruler).toBeVisible();
  const rail = await ruler.boundingBox();
  if (!rail) throw new Error("Expected a visible sequence ruler");
  await ruler.click({ position: { x: rail.width * 0.75, y: rail.height / 2 } });
  const frameReadout = story.getByLabel("Sequence playhead position");
  await expect(frameReadout).toHaveText("Sequence frame 270");

  await page.getByRole("tab", { name: /Controls/ }).click();
  await page.getByRole("switch", { name: "Edit sequence as JSON" }).click();
  const sequenceControl = page.getByRole("textbox", { name: "Edit sequence as JSON" });
  const original = await sequenceControl.inputValue();
  await sequenceControl.fill(
    JSON.stringify({
      durationFrames: 180,
      tracks: [
        {
          id: "main",
          label: "Main",
          placements: [{ id: "harbor-open", clipId: "harbor", sequenceStartFrame: 0 }],
        },
      ],
    }),
  );
  await sequenceControl.blur();
  await expect(frameReadout).toHaveText("Sequence frame 180");

  await sequenceControl.fill(original);
  await sequenceControl.blur();
  await expect(timeline).toContainText("Duration: 00:06");
  await expect(frameReadout).toHaveText("Sequence frame 180", { timeout: 2_000 });
});
