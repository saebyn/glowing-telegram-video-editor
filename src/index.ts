import "./custom-only.css";
import "./index.css";

import AudioChannelNameEditor from "@/components/atoms/AudioChannelNameEditor";
import WaveformDisplay from "@/components/atoms/WaveformDisplay";
import ProjectClipPreview from "@/components/molecules/ProjectClipPreview";
import ProjectClipPool from "@/components/organisms/ProjectClipPool";
import ProjectClipTimeline from "@/components/organisms/ProjectClipTimeline";
import VideoPreview from "@/components/organisms/VideoPreview";
import VideoSelectionPage from "@/components/pages/VideoSelectionPage";

export {
  VideoSelectionPage,
  VideoPreview,
  AudioChannelNameEditor,
  WaveformDisplay,
  ProjectClipPool,
  ProjectClipTimeline,
  ProjectClipPreview,
};

export type * from "./types";
export {
  default as SequenceEditorPage,
  type SequenceEditorPageProps,
  type SequenceEditorSlots,
} from "./components/pages/SequenceEditorPage";
export {
  useSequenceEditor,
  type UseSequenceEditorOptions,
} from "./components/organisms/useSequenceEditor";
export {
  default as SequenceToolbar,
  SequenceEditButton,
  SequenceTransportControls,
  type SequenceEditButtonProps,
  type SequenceToolbarProps,
  type SequenceTransportControlsProps,
} from "./components/organisms/SequenceToolbar";
export {
  default as SequenceClipPool,
  type SequenceClipPoolProps,
} from "./components/organisms/SequenceClipPool";
export {
  default as SequencePreviewPlaceholder,
  type SequencePreviewPlaceholderProps,
} from "./components/organisms/SequencePreviewPlaceholder";
export {
  default as SequenceInspector,
  SequenceFrameForm,
  type SequenceFrameFormProps,
  type SequenceInspectorProps,
} from "./components/organisms/SequenceInspector";
export {
  default as SequenceTimeline,
  type ClipPlacementPreview,
  type PlacementMoveIntent,
  type PlacementMovePreview,
  type PlacementMovePreviewIntent,
  type PlaceClipIntent,
  type SequenceTimelineProps,
  type TimelineFadeIntent,
  type TimelinePlacementActivation,
  type TimelineTrimIntent,
} from "./components/organisms/SequenceTimeline";
export {
  default as SequenceWorkspace,
  type SequenceWorkspaceProps,
} from "./components/organisms/SequenceWorkspace";
export {
  default as WorkspacePaneToggles,
  type WorkspacePane,
  type WorkspacePaneTogglesProps,
} from "./components/organisms/WorkspacePaneToggles";
export {
  default as RenameSequenceTrack,
  type RenameSequenceTrackProps,
} from "./components/organisms/RenameSequenceTrack";
export {
  default as ShortenSequenceForm,
  type ShortenSequenceFormProps,
} from "./components/organisms/ShortenSequenceForm";
export {
  AddSequenceTrack,
  RemoveSequenceTrack,
  ToggleSequenceTrackLock,
  type AddSequenceTrackProps,
  type RemoveSequenceTrackProps,
  type ToggleSequenceTrackLockProps,
} from "./components/organisms/SequenceTrackActions";
export {
  default as SequenceTrackHeaders,
  type SequenceTrackHeadersProps,
} from "./components/organisms/SequenceTrackHeaders";
export {
  default as SequenceFadeHandle,
  type SequenceFadeHandleProps,
} from "./components/organisms/SequenceFadeHandle";
export {
  default as SequencePlayheadGrip,
  type SequencePlayheadGripProps,
} from "./components/organisms/SequencePlayheadGrip";
export { ProjectProvider, type ProjectProviderProps } from "./context/ProjectContext";
export {
  framesToSeconds,
  getProjectFrameCount,
  layoutSequence,
  millisecondsToFrame,
  secondsToFrame,
} from "./utils/frames";
export { default as parseContent } from "./utils/parseData";
export { compileCutList } from "./utils/sequence";
