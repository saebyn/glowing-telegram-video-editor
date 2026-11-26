import { expect, test, type Page } from "@playwright/test";

type ScheduledSound = { start: number; stopped: boolean };
type PreviewAudio = { currentTime: number; frozenTime?: number; blocks: ScheduledSound[] };

async function openLocalTone(page: Page, story = "molecules-sequencepreview--local-tone") {
  await page.addInitScript(() => {
    const audio: PreviewAudio = {
      get currentTime() {
        return this.frozenTime ?? performance.now() / 1000;
      },
      blocks: [],
    };
    Object.assign(window, { previewAudio: audio });
    Object.defineProperty(AudioContext.prototype, "currentTime", {
      get: () => audio.currentTime,
    });
    // Keep real media decoding and audio graph construction, but record
    // speaker scheduling instead of letting the hardware clock end the nodes.
    const scheduled = new WeakMap<AudioBufferSourceNode, ScheduledSound>();
    AudioBufferSourceNode.prototype.start = function (start = 0) {
      const block = { start, stopped: false };
      scheduled.set(this, block);
      audio.blocks.push(block);
    };
    AudioBufferSourceNode.prototype.stop = function () {
      const block = scheduled.get(this);
      if (block) block.stopped = true;
    };
  });
  await page.goto(`/iframe.html?id=${story}&viewMode=story`);
  const start = new Date("2025-01-01T00:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1000));
}

async function readSound(page: Page) {
  return page.evaluate(() => {
    const { currentTime, blocks } = Reflect.get(window, "previewAudio") as PreviewAudio;
    return { currentTime, blocks };
  });
}

async function queuedSound(page: Page) {
  let queued: number[] = [];
  await expect
    .poll(
      async () => {
        await page.clock.runFor(16);
        const { currentTime, blocks } = await readSound(page);
        queued = blocks.flatMap(({ start, stopped }, index) =>
          start > currentTime && !stopped ? [index] : [],
        );
        return queued.length;
      },
      { intervals: [25] },
    )
    .toBeGreaterThan(1);
  return queued;
}

test("End on the sequence playhead cancels all queued sound from the old position", async ({
  page,
}) => {
  await openLocalTone(page);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const queued = await queuedSound(page);
  await page.getByRole("slider", { name: "Sequence playhead" }).press("End");
  await expect(page.getByText("Paused · Sequence frame 180 of 180")).toBeVisible();
  const { blocks } = await readSound(page);
  expect(queued.filter((index) => !blocks[index].stopped)).toEqual([]);
});

test("shortening a playing edit cancels queued sound at the parked playhead", async ({ page }) => {
  await openLocalTone(page, "pages-sequenceeditorpreview--local-dissolve");
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const grid = timeline.locator(".timeline-editor-time-area-interact");
  const clip = timeline.getByRole("button", { name: "Clip second Audio and video", exact: true });
  await clip.click({ timeout: 20_000 });
  const rail = await grid.boundingBox();
  if (!rail) throw new Error("Expected the sequence ruler");
  await grid.click({ position: { x: rail.width * (22 / 28), y: rail.height / 2 } });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const queued = await queuedSound(page);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(/Paused · Sequence frame 2\d of 15/)).toBeVisible();
  const after = await readSound(page);
  expect(queued.filter((index) => !after.blocks[index].stopped)).toEqual([]);
});

test("natural completion lets the final queued sound drain, but an explicit pause cancels it", async ({
  page,
}) => {
  await openLocalTone(page);
  const playhead = page.getByRole("slider", { name: "Sequence playhead" });
  await playhead.press("End");
  for (let i = 0; i < 4; i++) await playhead.press("ArrowLeft");
  await expect(page.getByText("Paused · Sequence frame 176 of 180")).toBeVisible();
  // Let the display clock finish the sequence while the audio clock is
  // still waiting to play the final blocks. Every start belongs to the tail.
  await page.evaluate(() => {
    const audio = Reflect.get(window, "previewAudio") as PreviewAudio;
    audio.frozenTime = audio.currentTime;
  });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const atEnd = page.getByText("Paused · Sequence frame 180 of 180");
  await expect
    .poll(
      async () => {
        await page.clock.runFor(16);
        return atEnd.isVisible();
      },
      { intervals: [25] },
    )
    .toBe(true);
  const { currentTime, blocks } = await readSound(page);
  const queued = blocks.flatMap(({ start }, index) => (start > currentTime ? [index] : []));
  expect(queued.length).toBeGreaterThan(1);
  expect(queued.filter((index) => blocks[index].stopped)).toEqual([]);

  // Pause newly started reverse playback before another display tick. The
  // resulting snapshot is identical to the one from natural completion.
  await page.getByRole("button", { name: "Play reverse", exact: true }).click();
  await expect(page.getByText("Playing reverse · Sequence frame 180 of 180")).toBeVisible();
  const beforePause = await readSound(page);
  expect(queued.filter((index) => beforePause.blocks[index].stopped)).toEqual([]);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(atEnd).toBeVisible();
  const afterPause = await readSound(page);
  expect(queued.filter((index) => !afterPause.blocks[index].stopped)).toEqual([]);
});
