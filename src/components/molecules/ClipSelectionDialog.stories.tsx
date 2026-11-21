import { action } from "storybook/actions";
import { sampleSource } from "@/fixtures/video";

import ClipSelectionDialog from "./ClipSelectionDialog";

// The sample cuts are 10 ms each, exactly one frame at 100 fps.
const clipSource = { ...sampleSource, sourceFrameRate: { numerator: 100, denominator: 1 } };

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
          ...clipSource,
          sourceInFrame: 0,
          sourceOutFrame: 1,
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
          ...clipSource,
          sourceInFrame: 0,
          sourceOutFrame: 1,
        },
        {
          id: "2",
          ...clipSource,
          sourceInFrame: 1,
          sourceOutFrame: 2,
        },
        {
          id: "3",
          ...clipSource,
          sourceInFrame: 2,
          sourceOutFrame: 3,
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
