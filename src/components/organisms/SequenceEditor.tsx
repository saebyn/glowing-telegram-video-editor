import { useId, useState } from "react";
import SequenceClipPool from "./SequenceClipPool";
import SequenceInspector from "./SequenceInspector";
import SequencePreviewPlaceholder from "./SequencePreviewPlaceholder";
import SequenceTimeline from "./SequenceTimeline";
import SequenceToolbar from "./SequenceToolbar";
import SequenceWorkspace from "./SequenceWorkspace";
import { useSequenceEditor, type UseSequenceEditorOptions } from "./useSequenceEditor";
import WorkspacePaneToggles, { type WorkspacePane } from "./WorkspacePaneToggles";

export type SequenceEditorProps = UseSequenceEditorOptions;

export default function SequenceEditor(props: SequenceEditorProps) {
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

  function togglePane(pane: WorkspacePane) {
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
      aria-describedby={shortcutsHintId}
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      onKeyDown={handleEditorKeyDown}
    >
      <SequenceToolbar {...toolbarProps}>
        <WorkspacePaneToggles hiddenPanes={hiddenPanes} onToggle={togglePane} />
        <p id={shortcutsHintId} className="basis-full text-sm text-slate-600 dark:text-slate-300">
          Left/Right Arrow: step the playhead.
          {onSequenceChange && " [ and ]: nudge selection earlier or later."}
        </p>
      </SequenceToolbar>
      {notices.map((notice) => (
        <output key={notice} className="block text-sm text-amber-900 dark:text-amber-200">
          {notice}
        </output>
      ))}
      <SequenceWorkspace
        hiddenPanes={hiddenPanes}
        preview={<SequencePreviewPlaceholder {...previewProps} />}
        clipPool={<SequenceClipPool {...clipPoolProps} />}
        inspector={<SequenceInspector {...inspectorProps} />}
      />
      {!hiddenPanes.has("timeline") && <SequenceTimeline {...timelineProps} />}
    </section>
  );
}
