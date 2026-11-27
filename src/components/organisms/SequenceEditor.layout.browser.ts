import { expect, test } from "@playwright/test";
import {
  compiled,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

test.use({
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    ignoreDefaultArgs: ["--hide-scrollbars"],
  },
});

test("move feedback does not cancel a drag when the editor just fits the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1_280, height: 720 });
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId);

  const editor = page.getByRole("region", { name: "Sequence editor", exact: true });
  const timeline = editor.getByRole("region", { name: "Sequence timeline" });
  const harbor = timeline.getByRole("button", { name: "Harbor", exact: true });
  await expect(harbor.last()).toBeVisible({ timeout: 15_000 });
  const editorBox = await editor.boundingBox();
  if (!editorBox) throw new Error("Expected the editor to be visible");
  await page.setViewportSize({
    width: 1_280,
    height: Math.ceil(editorBox.y + editorBox.height) + 2,
  });

  // The last Harbor ends at the sequence endpoint. Wait for it to reach
  // the fitted timeline's right edge (allowing for the button's inset).
  await expect
    .poll(
      async () => {
        const fitted = await timeline.boundingBox();
        const last = await harbor.last().boundingBox();
        if (!fitted || !last) return Infinity;
        return Math.abs(fitted.x + fitted.width - (last.x + last.width));
      },
      { message: "Last Harbor reaches the fitted timeline's right edge" },
    )
    .toBeLessThan(2);

  const [first, last] = await Promise.all([
    harbor.first().boundingBox(),
    harbor.last().boundingBox(),
  ]);
  if (!first || !last) throw new Error("Expected two visible placements");

  // Move the later Harbor from frame 240 to frame 120, immediately after the first.
  const x = last.x + last.width / 2;
  const y = last.y + last.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - (last.x - first.x) / 2, y, { steps: 12 });
  // Give the browser's layout and ResizeObserver a chance to react to the feedback.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(timeline.getByRole("status")).toHaveText("Harbor → Main · Sequence frame 120");
  expect((await editor.boundingBox())?.height).toBe(editorBox.height);
  expect(await emissions()).toStrictEqual(noEdits);

  await page.mouse.up();
  await expect.poll(emissions).toStrictEqual({
    sequences: [
      {
        tracks: [
          {
            id: "main",
            label: "Main",
            placements: [
              { id: "harbor-open", clipId: "harbor", sequenceStartFrame: 0 },
              {
                id: "harbor-close",
                clipId: "harbor",
                sequenceStartFrame: 120,
                sourceInOffsetFrames: 6,
                sourceOutOffsetFrames: 6,
              },
            ],
          },
        ],
      },
    ],
    cutListResults: [
      compiled({
        version: "1.0.0",
        inputMedia: [
          {
            s3Location: "s3://sequence-fixtures/harbor.mp4",
            sections: [
              { startFrame: 114, endFrame: 234 },
              { startFrame: 120, endFrame: 240 },
            ],
          },
        ],
        outputTrack: [
          { mediaIndex: 0, sectionIndex: 0 },
          { mediaIndex: 0, sectionIndex: 1 },
        ],
      }),
    ],
  });
});
