import { expect, test } from "@playwright/test";
import {
  layeredEditStoryId,
  noEdits,
  openWorkflow,
  recordEditorEmissions,
  roughCutStoryId,
} from "./SequenceEditor.browserHarness";

test("a loaded edit lists its gaps and can seek to the first without proposing an edit", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, { "sequence.durationFrames": 420 });
  const gaps = page.getByRole("region", { name: "CutList issues" });
  await expect(gaps).toContainText("Gaps are valid in a sequence");
  await expect(gaps).toContainText("120 inclusive – 240 exclusive");
  await expect(gaps).toContainText("360 inclusive – 420 exclusive");

  await gaps.getByRole("button", { name: "Jump to first gap" }).press("Enter");
  await expect(page.getByLabel("Sequence playhead position")).toHaveText("Sequence frame 120");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  expect(await emissions()).toEqual(noEdits);
});

test("a missing source can point to its placement even on a locked track", async ({ page }) => {
  const emissions = await recordEditorEmissions(page);
  const query = new URLSearchParams({
    id: layeredEditStoryId,
    viewMode: "story",
    args: "sources.harbor-recording:!undefined;sequence.tracks[1].locked:true",
  });
  await page.goto(`/iframe.html?${query}`);
  const issues = page.getByRole("region", { name: "CutList issues" });
  await expect(issues).toContainText("Missing source metadata for harbor-recording", {
    timeout: 20_000,
  });
  await issues.getByRole("button", { name: "Inspect Harbor on Main" }).press("Space");
  await expect(
    page.getByText("This track is locked. Its placements can be inspected"),
  ).toBeVisible();
  await expect(page.getByText("Source in/out (source frames): 114 inclusive")).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  expect(await emissions()).toEqual(noEdits);
});

test("an unresolved clip is explained without inferring a gap or offering inspection", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await openWorkflow(page, roughCutStoryId, {
    "sequence.tracks[0].placements[0].clipId": "unmapped",
  });
  const issues = page.getByRole("region", { name: "CutList issues" });
  await expect(issues).toContainText("Missing clip metadata for unmapped");
  await expect(issues.getByRole("button")).toHaveCount(0);
  expect(await emissions()).toEqual(noEdits);
});

test("a source rate mismatch is identified separately and opens the hidden Inspector", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  const query = new URLSearchParams({
    id: layeredEditStoryId,
    viewMode: "story",
    args: "clips[0].sourceFrameRate.numerator:30;sequence.durationFrames:480;readOnly:true",
  });
  await page.goto(`/iframe.html?${query}`);
  const editor = page.getByRole("region", { name: "Sequence editor", exact: true });
  const inspectorToggle = editor.getByRole("button", { name: "Inspector", exact: true });
  await inspectorToggle.click({ timeout: 20_000 });
  const issues = editor.getByRole("region", { name: "CutList issues" });
  await expect(issues).toContainText(
    "Source frame rate 30/1 does not match project frame rate 60/1",
  );
  await issues.getByRole("button", { name: "Inspect Harbor on Main" }).press("Enter");
  await expect(inspectorToggle).toHaveAttribute("aria-pressed", "true");
  await expect(editor.getByText("Source in/out (source frames): 114 inclusive")).toBeVisible();
  expect(await emissions()).toEqual(noEdits);
});

test("correcting source metadata in the host clears its issue without an edit", async ({
  page,
}) => {
  const emissions = await recordEditorEmissions(page);
  await page.goto(`/?path=/story/${layeredEditStoryId}&args=sources.harbor-recording:!undefined`);
  const story = page.frameLocator("#storybook-preview-iframe");
  const issues = story.getByRole("region", { name: "CutList issues" });
  await expect(issues).toContainText("Missing source metadata for harbor-recording", {
    timeout: 20_000,
  });

  await page.getByRole("tab", { name: /Controls/ }).click();
  await page.getByRole("switch", { name: "Edit sources as JSON" }).click();
  const sources = page.getByRole("textbox", { name: "Edit sources as JSON" });
  await sources.fill(
    JSON.stringify({
      "harbor-recording": {
        s3Location: "s3://sequence-fixtures/harbor.mp4",
        previewHlsUrl: "/fixtures/harbor.m3u8",
      },
      "lighthouse-recording": {
        s3Location: "s3://sequence-fixtures/lighthouse.mp4",
        previewHlsUrl: "/fixtures/lighthouse.m3u8",
      },
    }),
  );
  await sources.blur();

  await expect(issues).toHaveCount(0);
  await expect(story.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  expect(await emissions()).toEqual(noEdits);
});
