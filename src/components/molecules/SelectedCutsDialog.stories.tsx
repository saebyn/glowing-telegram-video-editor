import { action } from "@storybook/addon-actions";

import SelectedCutsDialog from "./SelectedCutsDialog";

export default {
  title: "Molecules/SelectedCutsDialog",
  component: SelectedCutsDialog,
  tags: ["molecules"],
  decorators: [
    (story: () => React.ReactNode) => (
      <div className="h-[70vh] flex justify-center items-center">{story()}</div>
    ),
  ],
};

export const Default = () => {
  return (
    <SelectedCutsDialog
      cuts={[
        {
          id: "1",
          start: 0,
          end: 10,
        },
      ]}
      onClose={action("onClose")}
      onClear={action("onClear")}
      onRemove={action("onRemove")}
      onReorder={action("onReorder")}
    />
  );
};

export const MultipleCuts = () => {
  return (
    <SelectedCutsDialog
      cuts={[
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
      onClose={action("onClose")}
      onClear={action("onClear")}
      onRemove={action("onRemove")}
      onReorder={action("onReorder")}
    />
  );
};
