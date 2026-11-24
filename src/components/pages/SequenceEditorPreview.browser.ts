import { expect, test, type Locator } from "@playwright/test";

const story = "/iframe.html?id=pages-sequenceeditorpreview--local-dissolve&viewMode=story";

async function marker(picture: Locator) {
  return picture.evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    return canvas.getContext("2d")?.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data[0];
  });
}

test("the default Preview seeks to the rendition picture covering the authored source time", async ({
  page,
}) => {
  await page.goto(story);
  const picture = page.getByRole("img", { name: "Sequence picture" });
  await expect(picture).toBeVisible();
  await expect.poll(() => marker(picture)).toBeCloseTo(17, -1);
  const ruler = page.getByRole("slider", { name: "Sequence playhead" });
  await ruler.press("ArrowRight");
  // A 5 fps rendition still shows the .2s picture at .3s.
  await expect.poll(() => marker(picture)).toBeCloseTo(17, -1);
  await ruler.press("ArrowRight");
  await expect.poll(() => marker(picture)).toBeCloseTo(26, -1);
});

test("play waits for media at the current frame and resumes after it arrives", async ({ page }) => {
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/markers.m3u8", async (route) => {
    await delayed;
    await route.continue();
  });
  try {
    await page.goto(story);
    await page.clock.install({ time: new Date("2025-01-01T00:00:00Z") });
    await page.clock.pauseAt(new Date("2025-01-01T00:00:01Z"));
    await page.getByRole("button", { name: "Play", exact: true }).click();
    const preview = page.getByRole("region", { name: "Preview", exact: true });
    await expect(preview).toContainText("Loading preview");
    await page.clock.runFor(500);
    await expect(preview).toContainText("Playing forward · Sequence frame 0 of 35");
    release();
    await expect(preview.getByText("Loading preview…")).not.toBeVisible();
    await page.clock.runFor(500);
    await expect(preview.getByText(/Playing forward · Sequence frame [1-9]/)).toBeVisible();
  } finally {
    release();
  }
});

test("forward playback stops when the rendition is missing declared sound", async ({ page }) => {
  await page.goto(story.replace("--local-dissolve", "--missing-expected-sound"));
  const picture = page.getByRole("img", { name: "Sequence picture" });
  await expect.poll(() => marker(picture)).toBeCloseTo(17, -1);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const preview = page.getByRole("region", { name: "Preview", exact: true });
  await expect(preview).toContainText("No media · The rendition is missing the expected sound.");
  await expect(preview).toContainText("Paused · Sequence frame 0 of 35");
});

test("seeking into a gap supersedes buffered playback, including the final frame", async ({
  page,
}) => {
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/markers.m3u8", async (route) => {
    await delayed;
    await route.continue();
  });
  try {
    await page.goto(story);
    const preview = page.getByRole("region", { name: "Preview", exact: true });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(preview).toContainText("Loading preview");
    await page.getByRole("slider", { name: "Sequence playhead" }).press("End");
    await expect(preview).toContainText("Paused · Sequence frame 35 of 35");
    release();
    await expect(preview.getByText("Loading preview…")).not.toBeVisible();
    await expect.poll(() => marker(preview.getByRole("img", { name: "Sequence picture" }))).toBe(0);
    await expect(preview).toContainText("Paused · Sequence frame 35 of 35");
  } finally {
    release();
  }
});

test("hiding a buffering Preview releases the clock", async ({ page }) => {
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/markers.m3u8", async (route) => {
    await delayed;
    await route.continue().catch(() => {});
  });
  try {
    await page.goto(story);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    const preview = page.getByRole("region", { name: "Preview", exact: true });
    await expect(preview).toContainText("Loading preview");
    await page.getByRole("button", { name: "Preview", exact: true, pressed: true }).click();
    await expect(preview).not.toBeVisible();
    await expect(page.getByLabel("Sequence playhead position")).not.toHaveText("Sequence frame 0");
  } finally {
    release();
  }
});

test("replacing a buffered rendition uses the latest URL without losing play intent", async ({
  page,
}) => {
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/picture-only.m3u8", async (route) => {
    await delayed;
    await route.continue().catch(() => {});
  });
  try {
    await page.goto(story.replace("--local-dissolve", "--missing-expected-sound"));
    const preview = page.getByRole("region", { name: "Preview", exact: true });
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(preview).toContainText("Playing forward · Sequence frame 0 of 35");
    await page.getByRole("button", { name: "Use audio-video rendition" }).click();
    await expect(preview.getByText(/Playing forward · Sequence frame [1-9]/)).toBeVisible();
    release();
    await expect(preview).not.toContainText("No media");
  } finally {
    release();
  }
});

test("a visible cut interrupts a dissolve, but the user can seek past it", async ({ page }) => {
  await page.goto(story.replace("--local-dissolve", "--undefined-dissolve"));
  const preview = page.getByRole("region", { name: "Preview", exact: true });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(preview).toContainText("Paused · Sequence frame 12 of 35");
  await expect(preview).toContainText("Undefined transition");
  const ruler = page.getByRole("slider", { name: "Sequence playhead" });
  await ruler.press("End");
  await expect(preview).toContainText("Paused · Sequence frame 35 of 35");
  await expect(preview).not.toContainText("Undefined transition");
});

test("the standalone HLS story uses the media supplied through Storybook args", async ({
  page,
}) => {
  await page.goto(
    "/iframe.html?id=molecules-sequencepreview--public-hls-smoke&viewMode=story&args=media.sequence.durationFrames:0",
  );
  await expect(page.getByText("Paused · Sequence frame 0 of 0", { exact: true })).toBeVisible();
});

test("the public HLS story shows and scrubs a three-placement edit with transitions", async ({
  page,
}) => {
  // This checks the story's timeline and transport. Media playback is checked
  // separately with local HLS fixtures, so Mux availability is not required.
  await page.route("https://test-streams.mux.dev/**", (route) => route.abort());
  await page.goto("/iframe.html?id=molecules-sequencepreview--public-hls-smoke&viewMode=story");
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await expect(timeline.getByRole("button", { name: /^Opening\b/ })).toBeVisible();
  await expect(timeline.getByRole("button", { name: /^Middle\b/ })).toBeVisible();
  await expect(timeline.getByRole("button", { name: /^Closing\b/ })).toBeVisible();
  await expect(timeline.getByRole("button", { name: "Select entry fade: Opening" })).toBeVisible();
  await expect(
    timeline.getByRole("button", { name: "Select centered dissolve: Middle" }),
  ).toBeVisible();
  await expect(timeline.getByRole("button", { name: "Select reveal fade: Closing" })).toBeVisible();
  const ruler = timeline.locator(".timeline-editor-time-area-interact");
  const bounds = (await ruler.boundingBox())!;
  // The dissolve is centered at four seconds in the twelve-second story.
  await ruler.click({ position: { x: bounds.width / 3, y: bounds.height / 2 } });
  await expect(page.getByText("Paused · Sequence frame 240 of 720")).toBeVisible();
});

test("the Preview plays the smaller variant of a multivariant rendition", async ({ page }) => {
  await page.route("**/markers.m3u8", async (route) => {
    const url = new URL("./variants.m3u8", route.request().url()).href;
    await route.fulfill({ response: await route.fetch({ url }) });
  });
  await page.route("**/small.m3u8", async (route) => {
    const url = new URL("./markers.m3u8", route.request().url()).href;
    await route.fulfill({ response: await route.fetch({ url }) });
  });
  await page.goto(story);
  const preview = page.getByRole("region", { name: "Preview", exact: true });
  // The large variant is white. The smaller variant carries the grayscale markers.
  await expect
    .poll(() => marker(preview.getByRole("img", { name: "Sequence picture" })))
    .toBeCloseTo(17, -1);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(preview).toContainText("Paused · Sequence frame 35 of 35");
});

test("forward playback requests the incoming rendition before reaching the dissolve", async ({
  page,
}) => {
  // The second placement enters the blend at frame 12. Give it a separate URL
  // so initial decoding of the outgoing source cannot warm the incoming one.
  await page.goto(`${story}&args=separateRenditions:true`);
  const preview = page.getByRole("region", { name: "Preview", exact: true });
  await expect
    .poll(() => marker(preview.getByRole("img", { name: "Sequence picture" })))
    .toBeCloseTo(17, -1);
  await page.clock.install({ time: new Date("2025-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2025-01-01T00:00:01Z"));
  let requested = false;
  page.on("request", (request) => {
    if (request.url().endsWith("/markers.m3u8?incoming")) requested = true;
  });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  for (let n = 0; n < 30; n++) {
    await page.clock.runFor(80);
    const frame = Number(
      (await page.getByLabel("Sequence playhead position").innerText()).split(" ").at(-1),
    );
    if (frame >= 8) break;
  }
  await expect(preview.getByText(/Playing forward · Sequence frame [89] of 35/)).toBeVisible();
  await expect.poll(() => requested).toBe(true);
});

test("two ranges of one rendition remain ready while their next decode windows warm up", async ({
  page,
}) => {
  await page.goto("/index.json");
  const samples = await page.evaluate(async () => {
    const module = "/src/utils/previewRendition.ts";
    const { createPreviewRendition } = (await import(
      module
    )) as typeof import("@/utils/previewRendition");
    const rendition = createPreviewRendition("/preview-fixtures/markers.m3u8");
    const configure = VideoDecoder.prototype.configure;
    try {
      const reader = await rendition.ready;
      // A dissolve reads two distant positions while preparing both of their
      // next decode windows. Once warm, it must not need another cold decoder.
      await Promise.all([0.2, 2.2, 0.8, 2.8].map((time) => reader.pictureAt(time)));
      VideoDecoder.prototype.configure = () => {
        throw new Error("Cold video decode after both dissolve ranges are ready");
      };
      const pictures = await Promise.all([reader.pictureAt(0.3), reader.pictureAt(2.3)]);
      return pictures.map(
        (picture) => picture?.canvas.getContext("2d")?.getImageData(240, 135, 1, 1).data[0],
      );
    } finally {
      VideoDecoder.prototype.configure = configure;
      rendition.dispose();
    }
  });
  // Those times are within the .2s and 2.2s pictures of the 5fps marker rendition.
  expect(samples[0]).toBeCloseTo(17, -1);
  expect(samples[1]).toBeCloseTo(99, -1);
});

test("preview keeps 60 fps playback time on a slower display clock", async ({ page }) => {
  await page.addInitScript(() => {
    // Exercise media in Chromium, but make the display clock slower than the
    // project so a tick regularly crosses more than one sequence frame.
    window.requestAnimationFrame = (callback) =>
      window.setTimeout(() => callback(performance.now()), 34);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  });
  await page.goto("/iframe.html?id=molecules-sequencepreview--local-tone&viewMode=story");
  const readout = page.getByLabel("Sequence playhead position");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(readout).not.toHaveText("Sequence frame 0");
  // On a steady clock, the remaining three-second sequence finishes even
  // though the display only redraws about thirty times a second.
  await expect(readout).toHaveText("Sequence frame 180", { timeout: 4500 });
});

test("preview audio plays the reference tone continuously at 60 sequence frames per second", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const originalConnect = AudioNode.prototype.connect;
    const taps = new WeakMap<BaseAudioContext, ScriptProcessorNode>();
    const recording = { samples: [] as number[], sampleRate: 0 };
    Object.assign(window, { previewRecording: recording });
    AudioNode.prototype.connect = function (
      destination: AudioNode | AudioParam,
      ...args: number[]
    ) {
      if (destination instanceof AudioDestinationNode) {
        let tap = taps.get(this.context);
        if (!tap && this.context instanceof AudioContext) {
          const context = this.context;
          tap = context.createScriptProcessor(2048, 1, 1);
          tap.onaudioprocess = ({ inputBuffer }) => {
            // Observe the real mixed signal while leaving speaker output unchanged.
            if (recording.samples.length < context.sampleRate * 2) {
              recording.samples.push(...inputBuffer.getChannelData(0));
            }
          };
          recording.sampleRate = context.sampleRate;
          Reflect.apply(originalConnect, tap, [destination]);
          taps.set(context, tap);
        }
        if (tap) Reflect.apply(originalConnect, this, [tap, ...args]);
      }
      return Reflect.apply(originalConnect, this, [destination, ...args]);
    };
  });
  const pathname = "/iframe.html?id=molecules-sequencepreview--local-tone&viewMode=story";
  await page.goto(pathname);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByText("Paused · Sequence frame 180 of 180")).toBeVisible({
    timeout: 12_000,
  });
  const { lowBlocks, crossings } = await page.evaluate(() => {
    const { samples, sampleRate } = Reflect.get(window, "previewRecording") as {
      samples: number[];
      sampleRate: number;
    };
    const onset = samples.findIndex((sample) => Math.abs(sample) > 0.08);
    const begin = onset + Math.round(sampleRate * 0.1);
    const end = begin + Math.round(sampleRate * 0.65);
    if (onset < 0 || samples.length < end) return { lowBlocks: Infinity, crossings: 0 };
    const blockSize = Math.round(sampleRate * 0.004);
    let lowBlocks = 0;
    let crossings = 0;
    for (let i = begin; i < end; i++) {
      if (samples[i - 1] < 0 && samples[i] >= 0) crossings++;
      if ((i - begin) % blockSize !== 0 || i + blockSize > end) continue;
      const squareSum = samples.slice(i, i + blockSize).reduce((sum, x) => sum + x * x, 0);
      if (Math.sqrt(squareSum / blockSize) < 0.075) lowBlocks++;
    }
    return { lowBlocks, crossings };
  });
  // 440 Hz × .65 seconds = 286 periods. Ignore a few AAC/resampling edge samples.
  expect(lowBlocks).toBeLessThanOrEqual(2);
  expect(crossings).toBeGreaterThan(279);
  expect(crossings).toBeLessThan(293);
});
