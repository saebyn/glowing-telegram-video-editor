import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, within } from "storybook/test";
import SequenceInspector from "./SequenceInspector";

const meta = {
  title: "Organisms/SequenceInspector",
  component: SequenceInspector,
  decorators: [
    (Story) => (
      <div className="max-w-sm rounded-lg bg-gray-50 p-4 text-slate-900 dark:bg-gray-800 dark:text-slate-100">
        <Story />
      </div>
    ),
  ],
  args: {
    inspection: { kind: "empty", canEdit: true },
  },
} satisfies Meta<typeof SequenceInspector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoSelection: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Select a placement to edit it.")).toBeVisible();
  },
};

const harborPlacement = {
  kind: "placement",
  selection: [{ id: "opening", label: "Harbor" }],
  selectedTracks: ["Picture"],
  inspectPlacement: fn(),
  properties: {
    placementId: "opening",
    clipTitle: "Harbor",
    sourceRange: { startFrame: 114, endFrame: 234 },
    sequenceRange: { startFrame: 0, endFrame: 120 },
    locked: false,
    edges: { start: { inspectTransition: fn() }, end: {} },
    conflict: false,
  },
} as const;

export const EditablePlacement: Story = {
  args: {
    inspection: {
      ...harborPlacement,
      properties: {
        ...harborPlacement.properties,
        trim: { min: 115, max: 474, trimPlacement: fn() },
        edges: {
          start: { inspectTransition: fn() },
          end: { addTransition: fn() },
        },
      },
    },
  },
  play: async ({ args, canvas, userEvent }) => {
    const sourceOut = canvas.getByRole("spinbutton", { name: "Source out (exclusive frame)" });
    await expect(sourceOut).toHaveValue(234);
    await userEvent.clear(sourceOut);
    await userEvent.type(sourceOut, "210");
    await userEvent.click(canvas.getByRole("button", { name: "Trim placement" }));
    if (args.inspection.kind !== "placement") throw new Error("Expected a placement");
    await expect(args.inspection.properties.trim?.trimPlacement).toHaveBeenCalledWith(210);
    const { start, end } = args.inspection.properties.edges;
    if (!("inspectTransition" in start) || !("addTransition" in end)) {
      throw new Error("Expected an occupied start and editable end");
    }
    await userEvent.click(
      within(canvas.getByRole("group", { name: "Start edge" })).getByRole("button", {
        name: "Inspect transition",
      }),
    );
    await expect(start.inspectTransition).toHaveBeenCalledTimes(1);
    await userEvent.click(
      within(canvas.getByRole("group", { name: "End edge" })).getByRole("button", {
        name: "Add transition",
      }),
    );
    await expect(end.addTransition).toHaveBeenCalledTimes(1);
  },
};

export const LockedPlacement: Story = {
  args: {
    inspection: {
      ...harborPlacement,
      properties: { ...harborPlacement.properties, locked: true },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/This track is locked/)).toBeVisible();
    await expect(canvas.getByText(/114 inclusive – 234 exclusive/)).toBeVisible();
    await expect(canvas.queryByRole("spinbutton")).not.toBeInTheDocument();
  },
};

export const SelectedTransition: Story = {
  args: {
    inspection: {
      kind: "transition",
      properties: {
        owner: "Harbor",
        edge: "end",
        locked: false,
        transition: { id: "opening-fade", kind: "fade", durationFrames: 24 },
        duration: { min: 1, max: 120, editDuration: fn() },
        sourceExtension: { startFrame: 90, endFrame: 114 },
        conflict: false,
      },
    },
  },
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByText("Owner: Harbor")).toBeVisible();
    await expect(
      canvas.getByText(/Transition source extension: 90 inclusive – 114 exclusive/),
    ).toBeVisible();
    const duration = canvas.getByRole("spinbutton", {
      name: "Reveal fade duration (sequence frames)",
    });
    await expect(duration).toHaveValue(24);
    await userEvent.clear(duration);
    await userEvent.type(duration, "18");
    await userEvent.click(canvas.getByRole("button", { name: "Apply reveal fade" }));
    if (args.inspection.kind !== "transition") throw new Error("Expected a transition");
    await expect(args.inspection.properties.duration?.editDuration).toHaveBeenCalledWith(18);
  },
};
