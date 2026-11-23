import { useEffect, useId, useState } from "react";
import ProjectClipPool from "./ProjectClipPool";
import SequenceInspector from "./SequenceInspector";
import SequencePreviewPlaceholder from "./SequencePreviewPlaceholder";
import SequenceTimeline from "./SequenceTimeline";
import SequenceToolbar from "./SequenceToolbar";
import SequenceWorkspace from "./SequenceWorkspace";
import { useSequenceEditor, type UseSequenceEditorOptions } from "./useSequenceEditor";
import WorkspacePaneToggles, { type WorkspacePane } from "./WorkspacePaneToggles";

export type SequenceEditorProps = UseSequenceEditorOptions;

export default function SequenceEditor(props: SequenceEditorProps) {
  const {
    sequence,
    clips,
    sources,
    thumbnails = {},
    keyframes = {},
    titles = {},
    onSequenceChange,
  } = props;
  const {
    previewProps,
    toolbarProps,
    inspectorProps,
    notices,
    transport,
    selectedIds,
    selectedTransition,
    sequenceDissolves,
    splitMode,
    splitAtPointer,
    commitEdit,
    selectPlacement,
    selectTransition,
    handleEditorKeyDown,
    dropClip,
    proposePlacementMove,
    proposePlacementFade,
    proposeTrim,
  } = useSequenceEditor(props);
  const [poolClipId, setPoolClipId] = useState<string>();
  const [hiddenPanes, setHiddenPanes] = useState<ReadonlySet<WorkspacePane>>(() => new Set());
  useEffect(() => {
    const endPoolDrag = () => setPoolClipId(undefined);
    window.addEventListener("dragend", endPoolDrag, true);
    return () => window.removeEventListener("dragend", endPoolDrag, true);
  }, []);
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
        clipPool={
          <ProjectClipPool
            clips={clips}
            sources={sources}
            thumbnails={thumbnails}
            keyframes={keyframes}
            titles={titles}
            clipWidth="136px"
            clipHeight="76px"
            onDragStart={
              onSequenceChange
                ? (ids) => setPoolClipId(ids.length === 1 ? ids[0] : undefined)
                : undefined
            }
          />
        }
        inspector={<SequenceInspector {...inspectorProps} />}
      />
      {!hiddenPanes.has("timeline") && (
        <SequenceTimeline
          playheadFrame={transport.playheadFrame}
          onSeek={transport.seek}
          sequence={sequence}
          sources={sources}
          clips={clips}
          titles={titles}
          poolClipId={poolClipId}
          onTrackEdit={onSequenceChange ? commitEdit : undefined}
          onClipDrop={onSequenceChange ? dropClip : undefined}
          evaluateMove={onSequenceChange ? proposePlacementMove : undefined}
          onPlacementMove={onSequenceChange ? commitEdit : undefined}
          evaluateFade={onSequenceChange ? proposePlacementFade : undefined}
          onPlacementFade={onSequenceChange ? commitEdit : undefined}
          evaluateTrim={onSequenceChange ? proposeTrim : undefined}
          onPlacementTrim={onSequenceChange ? commitEdit : undefined}
          selectedPlacementIds={selectedIds}
          onPlacementSelect={onSequenceChange ? selectPlacement : undefined}
          onPlacementSplit={onSequenceChange && splitMode ? splitAtPointer : undefined}
          selectedTransitionId={selectedTransition?.transition.id}
          dissolveDetails={sequenceDissolves}
          onTransitionSelect={selectTransition}
        />
      )}
    </section>
  );
}
