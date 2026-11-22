import { expect, test } from "@playwright/test";
import type { CutList } from "@saebyn/glowing-telegram-types";

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
