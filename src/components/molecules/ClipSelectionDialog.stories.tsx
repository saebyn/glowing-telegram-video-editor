import { action } from "@storybook/addon-actions";

import ClipSelectionDialog from "./ClipSelectionDialog";

export default {
  title: "Molecules/SelectedCutsDialog",
  component: ClipSelectionDialog,
  tags: ["molecules"],
  decorators: [
    (story: () => React.ReactNode) => (
      <div className="h-[70vh] flex justify-center items-center">{story()}</div>
    ),
  ],
};

export const Default = () => {
  return (
    <ClipSelectionDialog
      clips={[
        {
          id: "1",
          start: 0,
          end: 10,
        },
      ]}
      onCopyStartTime={action("onCopyStartTime")}
      onCopyEndTime={action("onCopyEndTime")}
      onExport={action("onExport")}
      show={true}
      onClear={action("onClear")}
      onRemove={action("onRemove")}
      onReorder={action("onReorder")}
    />
  );
};

export const MultipleCuts = () => {
  return (
    <ClipSelectionDialog
      show={true}
      clips={[
        {
          id: "1",
          start: 0,
          end: 10,
        },
        {
          id: "2",
          start: 10,
          end: 20,
        },
        {
          id: "3",
          start: 20,
          end: 30,
        },
      ]}
      onCopyStartTime={action("onCopyStartTime")}
      onCopyEndTime={action("onCopyEndTime")}
      onExport={action("onExport")}
      onClear={action("onClear")}
      onRemove={action("onRemove")}
      onReorder={action("onReorder")}
    />
  );
};
