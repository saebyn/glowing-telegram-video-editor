import { type ComponentType, useId, useState } from "react";
import SequencePreview, { type SequencePreviewProps } from "@/components/molecules/SequencePreview";
import WorkspacePaneToggles, {
  type WorkspacePane,
} from "@/components/molecules/WorkspacePaneToggles";
import SequenceClipPool, {
  type SequenceClipPoolProps,
} from "@/components/organisms/SequenceClipPool";
import SequenceInspector, {
  type SequenceInspectorProps,
} from "@/components/organisms/SequenceInspector";
import SequenceTimeline, {
  type SequenceTimelineProps,
} from "@/components/organisms/SequenceTimeline";
import SequenceToolbar, { type SequenceToolbarProps } from "@/components/organisms/SequenceToolbar";
import SequenceWorkspace from "@/components/organisms/SequenceWorkspace";
import {
  useSequenceEditor,
  type UseSequenceEditorOptions,
} from "@/components/organisms/useSequenceEditor";

export interface SequenceEditorSlots {
  toolbar?: ComponentType<SequenceToolbarProps> | null;
  clipPool?: ComponentType<SequenceClipPoolProps> | null;
  preview?: ComponentType<SequencePreviewProps> | null;
  inspector?: ComponentType<SequenceInspectorProps> | null;
  timeline?: ComponentType<SequenceTimelineProps> | null;
}

export interface SequenceEditorPageProps extends UseSequenceEditorOptions {
  slots?: SequenceEditorSlots;
}

export default function SequenceEditorPage({ slots, ...props }: SequenceEditorPageProps) {
  const { onSequenceChange } = props;
  const {
    previewProps,
    toolbarProps,
    inspectorProps,
    notices,
    clipPoolProps,
    timelineProps,
    handleEditorKeyDown,
  } = useSequenceEditor(props);
  const [hiddenPanes, setHiddenPanes] = useState<ReadonlySet<WorkspacePane>>(() => new Set());
  const shortcutsHintId = useId();
  const {
    toolbar: Toolbar = SequenceToolbar,
    clipPool: ClipPool = SequenceClipPool,
    preview: Preview = SequencePreview,
    inspector: Inspector = SequenceInspector,
    timeline: Timeline = SequenceTimeline,
  } = slots ?? {};
  const configuredPanes = [
    ...(ClipPool ? ["clipPool" as const] : []),
    ...(Preview ? ["preview" as const] : []),
    ...(Inspector ? ["inspector" as const] : []),
    ...(Timeline ? ["timeline" as const] : []),
  ];

  function togglePane(pane: WorkspacePane) {
    if (pane === "clipPool" || pane === "timeline") clipPoolProps.endClipDrag();
    setHiddenPanes((hidden) => {
      const next = new Set(hidden);
      if (!next.delete(pane)) next.add(pane);
      return next;
    });
  }

  return (
    // The region owns editor shortcuts and is focusable without selecting a placement.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <section
      className="space-y-4 bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      aria-label="Sequence editor"
      data-sequence-editor-shortcuts
      aria-describedby={shortcutsHintId}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      onKeyDown={handleEditorKeyDown}
    >
      {Toolbar && (
        <Toolbar
          {...toolbarProps}
          paneToggles={
            <WorkspacePaneToggles
              panes={configuredPanes}
              hiddenPanes={hiddenPanes}
              onToggle={togglePane}
            />
          }
        />
      )}
      <p id={shortcutsHintId} className="text-sm text-slate-600 dark:text-slate-300">
        Left/Right Arrow: step the playhead.
        {onSequenceChange && " [ and ]: nudge selection earlier or later."}
      </p>
      {notices.map((notice) => (
        <output key={notice} className="block text-sm text-amber-900 dark:text-amber-200">
          {notice}
        </output>
      ))}
      <SequenceWorkspace
        preview={Preview && !hiddenPanes.has("preview") ? <Preview {...previewProps} /> : null}
        clipPool={ClipPool && !hiddenPanes.has("clipPool") ? <ClipPool {...clipPoolProps} /> : null}
        inspector={
          Inspector && !hiddenPanes.has("inspector") ? <Inspector {...inspectorProps} /> : null
        }
      />
      {Timeline && !hiddenPanes.has("timeline") && <Timeline {...timelineProps} />}
    </section>
  );
}
