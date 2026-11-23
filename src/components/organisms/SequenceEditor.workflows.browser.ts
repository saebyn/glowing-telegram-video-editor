import { expect, test } from "@playwright/test";
import { layeredEditStoryId, roughCutStoryId } from "./SequenceEditor.browserHarness";

test("Storybook lists only the two sequence editing workflows", async ({ request }) => {
  const response = await request.get("/index.json");
  expect(response.ok()).toBe(true);
  const { entries } = (await response.json()) as {
    entries: Record<string, { id: string; name: string; title: string; type: string }>;
  };

  const workflows = Object.values(entries)
    .filter(({ title, type }) => title === "Pages/SequenceEditorPage" && type === "story")
    .map(({ id, name }) => ({ id, name }));
  expect(workflows).toHaveLength(2);
  expect(workflows).toEqual(
    expect.arrayContaining([
      { id: roughCutStoryId, name: "Assemble a rough cut" },
      {
        id: layeredEditStoryId,
        name: "Rearrange a layered edit",
      },
    ]),
  );
});

for (const { name, storyId, outPoint, duration } of [
  { name: "Assemble a rough cut", storyId: roughCutStoryId, outPoint: "270", duration: "00:06.5" },
  {
    name: "Rearrange a layered edit",
    storyId: layeredEditStoryId,
    outPoint: "384",
    duration: "00:04.5",
  },
]) {
  test(`${name} feeds back an edit and logs both host callbacks in Actions`, async ({ page }) => {
    await page.goto(`/?path=/story/${storyId}`);
    await page.getByRole("tab", { name: "Actions", exact: true }).click();
    const story = page.frameLocator("#storybook-preview-iframe");
    const timeline = story.getByRole("region", { name: "Sequence timeline" });
    await timeline.getByRole("button", { name: "Harbor", exact: true }).last().click();
    await story.getByLabel("Source out (exclusive frame)").fill(outPoint);
    await story.getByRole("button", { name: "Trim placement", exact: true }).click();

    await expect(timeline).toContainText(`Duration: ${duration}`);
    const actions = page.getByRole("tabpanel", { name: "Actions" });
    await expect(actions.getByText("onSequenceChange", { exact: true })).toBeVisible();
    await expect(actions.getByText("onCutListResult", { exact: true })).toBeVisible();
  });
}
