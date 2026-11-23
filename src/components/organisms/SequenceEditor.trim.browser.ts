import { expect, test, type Locator, type Page } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";
import type { CutListResult, Sequence } from "@/types";
import {
  blockedOutput,
  compiled,
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
  straightCutArgs,
} from "./SequenceEditor.browserHarness";

async function openSameClipOnTwoTracks(page: Page) {
  await openWorkflow(page, layeredEditStoryId, {
    "sequence.durationFrames": 360,
    "sequence.tracks[0].placements[0].id": "harbor-cutaway",
    "sequence.tracks[0].placements[0].clipId": "harbor",
    "sequence.tracks[0].placements[0].sequenceStartFrame": 120,
    "sequence.tracks[0].placements[0].sourceInOffsetFrames": 6,
    "sequence.tracks[0].placements[0].sourceOutOffsetFrames": 6,
    "sequence.tracks[1].placements[0].id": "harbor-main",
    "sequence.tracks[1].placements[0].sourceOutOffsetFrames": 240,
    "sequence.tracks[2]": undefined,
  });
}

test("trimming one use of a clip leaves the other use aligned to sequence time", async ({
  page,
}) => {
  const expectedSequence: Sequence = {
    durationFrames: 360,
    tracks: [
      {
        id: "cutaways",
        label: "Cutaways",
        placements: [
          {
            id: "harbor-cutaway",
            clipId: "harbor",
            sequenceStartFrame: 120,
            sourceInOffsetFrames: 6,
            sourceOutOffsetFrames: -24,
          },
        ],
      },
      {
        id: "main",
        label: "Main",
        placements: [
          {
            id: "harbor-main",
            clipId: "harbor",
            sequenceStartFrame: 0,
            sourceOutOffsetFrames: 240,
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
        sections: [
          { startFrame: 114, endFrame: 234 },
          { startFrame: 120, endFrame: 210 },
          { startFrame: 324, endFrame: 474 },
        ],
      },
    ],
    outputTrack: [
      { mediaIndex: 0, sectionIndex: 0 },
      { mediaIndex: 0, sectionIndex: 1 },
      { mediaIndex: 0, sectionIndex: 2 },
    ],
  };

  const { sequences, cutListResults } = await recordEdits(page);
  await openSameClipOnTwoTracks(page);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  // There are two placements of the same clip, one on each track.
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  await expect(harbor).toHaveCount(2, { timeout: 10_000 });
  await harbor.first().click();
  const outFrame = page.getByLabel("Source out (exclusive frame)");
  const submit = page.getByRole("button", { name: "Trim placement" });
  await expect(outFrame).toHaveValue("240");

  await submit.click();
  expect(sequences).toEqual([]);
  expect(cutListResults).toEqual([]);

  // The placement must retain at least one source frame and stay inside its source.
  for (const invalidEnd of [120, 1001]) {
    await outFrame.fill(String(invalidEnd));
    await submit.click();
    expect(sequences).toEqual([]);
    expect(cutListResults).toEqual([]);
    await expect(outFrame).toHaveValue(String(invalidEnd));
  }

  await outFrame.fill("210");
  expect(sequences).toEqual([]);
  expect(cutListResults).toEqual([]);
  await submit.click();
  await expect.poll(() => sequences).toStrictEqual([expectedSequence]);
  await expect.poll(() => cutListResults).toStrictEqual([compiled(expectedCutList)]);

  await harbor.last().click();
  await expect(outFrame).toHaveValue("474");
});

test("extending a trailing trim past the endpoint commits the grown sequence and its CutList", async ({
  page,
}) => {
  const { sequences, cutListResults } = await recordEdits(page);
  await openSameClipOnTwoTracks(page);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  await expect(harbor).toHaveCount(2, { timeout: 10_000 });
  await harbor.last().click();
  const outFrame = page.getByLabel("Source out (exclusive frame)");
  await expect(outFrame).toHaveValue("474");

  await outFrame.fill("500");
  await page.getByRole("button", { name: "Trim placement" }).click();

  await expect.poll(() => sequences).toStrictEqual([extendedSequence]);
  await expect.poll(() => cutListResults).toStrictEqual([compiled(extendedCutList)]);
});

const extendedSequence: Sequence = {
  durationFrames: 386,
  tracks: [
    {
      id: "cutaways",
      label: "Cutaways",
      placements: [
        {
          id: "harbor-cutaway",
          clipId: "harbor",
          sequenceStartFrame: 120,
          sourceInOffsetFrames: 6,
          sourceOutOffsetFrames: 6,
        },
      ],
    },
    {
      id: "main",
      label: "Main",
      placements: [
        {
          id: "harbor-main",
          clipId: "harbor",
          sequenceStartFrame: 0,
          sourceOutOffsetFrames: 266,
        },
      ],
    },
  ],
};
const extendedCutList: CutList = {
  version: "1.0.0",
  inputMedia: [
    {
      s3Location: "s3://sequence-fixtures/harbor.mp4",
      sections: [
        { startFrame: 114, endFrame: 234 },
        { startFrame: 120, endFrame: 240 },
        { startFrame: 354, endFrame: 500 },
      ],
    },
  ],
  outputTrack: [
    { mediaIndex: 0, sectionIndex: 0 },
    { mediaIndex: 0, sectionIndex: 1 },
    { mediaIndex: 0, sectionIndex: 2 },
  ],
};

test("a trailing trim cannot overlap the next placement but can leave a gap", async ({ page }) => {
  const { sequences, cutListResults } = await recordEdits(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  await timeline.getByRole("button", { name: "Harbor", exact: true }).click();
  const outFrame = page.getByLabel("Source out (exclusive frame)");
  const submit = page.getByRole("button", { name: "Trim placement" });

  await outFrame.fill("235");
  await submit.click();
  await expect(outFrame).toHaveValue("235");

  await outFrame.fill("230");
  await submit.click();
  const trimmed: Sequence = {
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
            sourceOutOffsetFrames: -4,
          },
          { id: "lighthouse-next", clipId: "lighthouse", sequenceStartFrame: 120 },
        ],
      },
    ],
  };
  await expect.poll(() => sequences).toStrictEqual([trimmed]);
  await expect.poll(() => cutListResults).toStrictEqual([blockedOutput]);
});

test("dragging a leading trim previews the new edge and commits one gap-producing edit", async ({
  page,
}) => {
  const { sequences, cutListResults } = await recordEdits(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  await harbor.click();
  const handle = timeline.getByRole("button", { name: "Trim leading edge: Lighthouse" });
  await handle.scrollIntoViewIfNeeded();
  const before = await visibleBox(lighthouse);
  const grip = await visibleBox(handle);
  const fade = await visibleBox(
    timeline.getByRole("button", { name: "Adjust entry fade: Lighthouse" }),
  );
  expect(grip.y).toBeGreaterThanOrEqual(fade.y + fade.height);
  const x = grip.x + grip.width / 2;
  const y = grip.y + grip.height / 2;

  // The original 120-frame placement occupies one half of the timeline.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + before.width / 5, y);
  const preview = timeline.getByRole("figure", { name: "Proposed trim: Lighthouse" });
  const proposed = await visibleBox(preview);
  await expect(timeline).toContainText("Sequence frame 144");
  expect(Math.abs(proposed.x - (before.x + before.width / 5))).toBeLessThan(2);
  expect(Math.abs(proposed.x + proposed.width - (before.x + before.width))).toBeLessThan(2);
  expect(await lighthouse.boundingBox()).toEqual(before);
  expect(sequences).toEqual([]);
  expect(cutListResults).toEqual([]);

  await page.mouse.up();
  const trimmed: Sequence = {
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
            sequenceStartFrame: 144,
            sourceInOffsetFrames: 24,
          },
        ],
      },
    ],
  };
  await expect.poll(() => sequences).toStrictEqual([trimmed]);
  await expect.poll(() => cutListResults).toStrictEqual([blockedOutput]);
  await expect(preview).toHaveCount(0);
  await expect(harbor).toHaveAttribute("aria-pressed", "true");
  const after = await visibleBox(lighthouse);
  expect(Math.abs(after.x - proposed.x)).toBeLessThan(2);
  expect(Math.abs(after.x + after.width - (before.x + before.width))).toBeLessThan(2);
});

test("dragging the trailing edge can pan past the endpoint and grow the sequence on release", async ({
  page,
}) => {
  const { sequences, cutListResults } = await recordEdits(page);
  await openSameClipOnTwoTracks(page);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true }).last();
  const before = await visibleBox(harbor);
  const grip = await visibleBox(
    timeline.getByRole("button", { name: "Trim trailing edge: Harbor" }).last(),
  );
  const x = grip.x + grip.width / 2;
  const y = grip.y + grip.height / 2;
  const right = before.x + before.width;

  await page.mouse.move(x, y);
  await page.mouse.down();
  // A small initial pull already goes outside the viewport of the timeline.
  await page.mouse.move(right + 8, y);
  const readout = timeline.getByText(/Harbor · Sequence frame \d+/);
  await expect(readout).toHaveText(/Sequence frame [4-9]\d\d\b/);

  // Stop panning, then position the edge precisely using the unchanged 360-frame scale.
  await page.mouse.move(right - 100, y);
  const authored = await visibleBox(harbor);
  const scrollPixels = before.x - authored.x;
  await page.mouse.move(x + (26 * (before.width + 2)) / 360 - scrollPixels, y);
  await expect(readout).toHaveText("Harbor · Sequence frame 386");
  const preview = timeline.getByRole("figure", { name: "Proposed trim: Harbor" });
  const proposed = await visibleBox(preview);
  expect(Math.abs(proposed.x - authored.x)).toBeLessThan(2);
  expect(Math.abs(proposed.width - authored.width - (26 * before.width) / 360)).toBeLessThan(2);
  expect(sequences).toEqual([]);
  expect(cutListResults).toEqual([]);
  await expect(timeline).toContainText("Duration: 00:06");

  await page.mouse.up();
  await expect.poll(() => sequences).toStrictEqual([extendedSequence]);
  await expect.poll(() => cutListResults).toStrictEqual([compiled(extendedCutList)]);
  await expect(preview).toHaveCount(0);
});

test("dragging the trailing edge of a one-frame placement previews and commits a trim", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    ...straightCutArgs,
    "sequence.durationFrames": 760,
    "sequence.tracks[0].placements[1].sequenceStartFrame": 380,
    "sequence.tracks[0].placements[1].sourceOutOffsetFrames": -119,
  });

  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const harbor = await visibleBox(timeline.getByRole("button", { name: "Harbor", exact: true }));
  const grip = timeline.getByRole("button", { name: "Trim trailing edge: Lighthouse" });
  // Read the grip's coordinates even when collapsed, so the real pointer still tries the drag.
  const { x, y } = await grip.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    return { x: Math.round(rect.x + rect.width / 2), y: rect.y + rect.height / 2 };
  });
  const twelveFrames = Math.round(harbor.width / 10);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + twelveFrames, y);

  await expect(timeline.getByRole("status")).toHaveText("Lighthouse · Sequence frame 393");
  const preview = timeline.getByRole("figure", { name: "Proposed trim: Lighthouse" });
  await expect(preview).toBeVisible();
  expect(await emissions()).toStrictEqual(noEdits);

  await page.mouse.up();
  await expect(preview).toHaveCount(0);
  expect(await emissions()).toStrictEqual({
    sequences: [
      {
        durationFrames: 760,
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              { id: "harbor-open", clipId: "harbor", sequenceStartFrame: 0 },
              {
                id: "lighthouse-next",
                clipId: "lighthouse",
                sequenceStartFrame: 380,
                sourceOutOffsetFrames: -107,
              },
            ],
          },
        ],
      },
    ],
    cutListResults: [blockedOutput],
  });
});

test("blocked, cancelled, and unchanged edge drags leave the authored placement untouched", async ({
  page,
}) => {
  const { sequences, cutListResults } = await recordEdits(page);
  await openWorkflow(page, roughCutStoryId, straightCutArgs);
  const timeline = page.getByRole("region", { name: "Sequence timeline" });
  const lighthouse = timeline.getByRole("button", { name: "Lighthouse", exact: true });
  const before = await visibleBox(lighthouse);
  const grip = await visibleBox(
    timeline.getByRole("button", { name: "Trim leading edge: Lighthouse" }),
  );
  const x = grip.x + grip.width / 2;
  const y = grip.y + grip.height / 2;
  const preview = timeline.getByRole("figure", { name: "Proposed trim: Lighthouse" });

  for (const release of ["blocked", "cancelled", "unchanged"] as const) {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + before.width / 5, y);
    await expect(preview).toBeVisible();
    await expect(timeline).toContainText("Sequence frame 144");

    if (release === "blocked") {
      // Releasing one frame to the left would overlap Harbor, even though source frame 500 exists.
      await page.mouse.move(x - before.width / 120, y);
      await expect(timeline).toContainText("Sequence frame 119 · Blocked");
    } else if (release === "cancelled") {
      await page.keyboard.press("Escape");
      await expect(preview).toHaveCount(0);
    } else {
      await page.mouse.move(x, y);
      await expect(preview).toHaveCount(0);
    }
    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    expect(sequences).toEqual([]);
    expect(cutListResults).toEqual([]);
    expect(await lighthouse.boundingBox()).toEqual(before);
    await expect(lighthouse).toHaveAttribute("aria-pressed", "false");
  }
});

async function visibleBox(locator: Locator) {
  await expect(locator).toBeVisible({ timeout: 5_000 });
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected a visible timeline element");
  return box;
}

async function recordEdits(page: Page) {
  const sequences: Sequence[] = [];
  const cutListResults: CutListResult[] = [];
  await page.exposeFunction("recordSequence", (next: Sequence) => sequences.push(next));
  await page.exposeFunction("recordCutListResult", (next: CutListResult) =>
    cutListResults.push(next),
  );
  await page.addInitScript(() => {
    const host = window as Window & {
      recordSequence?(next: Sequence): Promise<void>;
      recordCutListResult?(next: CutListResult): Promise<void>;
    };
    host.addEventListener("sequence-editor:sequence-change", (event) => {
      void host.recordSequence?.((event as CustomEvent<Sequence>).detail);
    });
    host.addEventListener("sequence-editor:cut-list-result", (event) => {
      void host.recordCutListResult?.((event as CustomEvent<CutListResult>).detail);
    });
  });
  return { sequences, cutListResults };
}
