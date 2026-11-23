import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn } from "storybook/test";
import WorkspacePaneToggles, {
  type WorkspacePane,
  type WorkspacePaneTogglesProps,
} from "./WorkspacePaneToggles";

type PaneToggleArgs = WorkspacePaneTogglesProps & {
  hidden?: WorkspacePane[];
};

const meta = {
  title: "Molecules/WorkspacePaneToggles",
  component: WorkspacePaneToggles,
  decorators: [
    (Story) => (
      <div className="rounded bg-slate-50 p-3 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <Story />
      </div>
    ),
  ],
  argTypes: { hiddenPanes: { control: false }, hidden: { control: "object" } },
  args: { hiddenPanes: new Set<WorkspacePane>(), hidden: [], onToggle: fn() },
  render: (args: PaneToggleArgs) => <PaneToggleExample key={args.hidden?.join(":")} {...args} />,
} satisfies Meta<PaneToggleArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

function PaneToggleExample({ hidden = [], onToggle, panes }: PaneToggleArgs) {
  const [hiddenPanes, setHiddenPanes] = useState(() => new Set(hidden));
  return (
    <WorkspacePaneToggles
      panes={panes}
      hiddenPanes={hiddenPanes}
      onToggle={(pane) => {
        onToggle(pane);
        setHiddenPanes((current) => {
          const next = new Set(current);
          if (!next.delete(pane)) next.add(pane);
          return next;
        });
      }}
    />
  );
}

export const AllPanes: Story = {};

export const ConfiguredPanesOnly: Story = {
  args: { panes: ["preview", "timeline"], hidden: ["preview"] },
  play: async ({ args, canvas, userEvent }) => {
    const preview = canvas.getByRole("button", { name: "Preview" });
    await expect(canvas.queryByRole("button", { name: "Clip pool" })).not.toBeInTheDocument();
    await expect(preview).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(preview);
    await expect(args.onToggle).toHaveBeenCalledWith("preview");
    await expect(preview).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(preview);
    await expect(preview).toHaveAttribute("aria-pressed", "false");
  },
};
