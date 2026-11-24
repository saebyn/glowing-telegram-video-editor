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
  type SequenceToolbarProps,
} from "./components/organisms/SequenceToolbar";
export {
  SequenceEditButton,
  type SequenceEditButtonProps,
} from "./components/atoms/SequenceEditButton";
export {
  SequenceTransportControls,
  type SequenceTransportControlsProps,
} from "./components/molecules/SequenceTransportControls";
export {
  default as SequenceClipPool,
  type SequenceClipPoolProps,
} from "./components/organisms/SequenceClipPool";
export {
  default as SequencePreview,
  type SequencePreviewProps,
} from "./components/molecules/SequencePreview";
export {
  PlacementProperties,
  default as SequenceInspector,
  TransitionProperties,
  type PlacementPropertiesProps,
  type SequenceInspectorProps,
  type TransitionPropertiesProps,
} from "./components/organisms/SequenceInspector";
export {
  SequenceFrameForm,
  type SequenceFrameFormProps,
} from "./components/molecules/SequenceFrameForm";
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
} from "./components/molecules/WorkspacePaneToggles";
export {
  default as RenameSequenceTrack,
  type RenameSequenceTrackProps,
} from "./components/molecules/RenameSequenceTrack";
export {
  default as ShortenSequenceForm,
  type ShortenSequenceFormProps,
} from "./components/molecules/ShortenSequenceForm";
export {
  AddSequenceTrack,
  RemoveSequenceTrack,
  ToggleSequenceTrackLock,
  type AddSequenceTrackProps,
  type RemoveSequenceTrackProps,
  type ToggleSequenceTrackLockProps,
} from "./components/atoms/SequenceTrackActions";
export {
  default as SequenceTrackHeaders,
  type SequenceTrackHeadersProps,
} from "./components/molecules/SequenceTrackHeaders";
export {
  default as SequenceFadeHandle,
  type SequenceFadeHandleProps,
} from "./components/atoms/SequenceFadeHandle";
export {
  default as SequencePlayheadGrip,
  type SequencePlayheadGripProps,
} from "./components/atoms/SequencePlayheadGrip";
export { ProjectProvider, type ProjectProviderProps } from "./context/ProjectContext";
export {
  framesToSeconds,
  getProjectFrameCount,
  layoutSequence,
  millisecondsToFrame,
  secondsToFrame,
} from "./utils/frames";
export { default as parseContent } from "./utils/parseData";
export { default as compileCutList } from "./utils/compileCutList";
