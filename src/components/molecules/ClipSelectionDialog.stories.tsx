import { action } from "storybook/actions";
import { sampleSource } from "@/fixtures/video";

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
          ...sampleSource,
          sourceInFrame: 0,
          sourceOutFrame: 600,
        },
      ]}
      onCopyInPoint={action("onCopyInPoint")}
      onCopyOutPoint={action("onCopyOutPoint")}
      onExport={action("onExport")}
      show={true}
      onClear={action("onClear")}
      onRemove={action("onRemove")}
      onReorder={action("onReorder")}
      onSeekToFrame={action("onSeekToFrame")}
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
          ...sampleSource,
          sourceInFrame: 0,
          sourceOutFrame: 600,
        },
        {
          id: "2",
          ...sampleSource,
          sourceInFrame: 600,
          sourceOutFrame: 1200,
        },
        {
          id: "3",
          ...sampleSource,
          sourceInFrame: 1200,
          sourceOutFrame: 1800,
        },
      ]}
      onCopyInPoint={action("onCopyInPoint")}
      onCopyOutPoint={action("onCopyOutPoint")}
      onExport={action("onExport")}
      onClear={action("onClear")}
      onRemove={action("onRemove")}
      onReorder={action("onReorder")}
      onSeekToFrame={action("onSeekToFrame")}
    />
  );
};
