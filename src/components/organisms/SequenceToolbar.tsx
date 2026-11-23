import type { ReactNode } from "react";
import { SequenceEditButton } from "@/components/atoms/SequenceEditButton";
import { AddSequenceTrack } from "@/components/atoms/SequenceTrackActions";
import RenameSequenceTrack, {
  type RenameSequenceTrackProps,
} from "@/components/molecules/RenameSequenceTrack";
import {
  SequenceTransportControls,
  type SequenceTransportControlsProps,
} from "@/components/molecules/SequenceTransportControls";
import ShortenSequenceForm, {
  type ShortenSequenceFormProps,
} from "@/components/molecules/ShortenSequenceForm";

export interface SequenceToolbarProps {
  transport: SequenceTransportControlsProps;
  splitAtPlayhead?: () => void;
  splitMode: boolean;
  toggleSplitMode?: () => void;
  undo?: () => void;
  redo?: () => void;
  deleteSelection?: () => void;
  shorten?: ShortenSequenceFormProps;
  addTrack?: () => void;
  renameTrack?: RenameSequenceTrackProps;
  /** Layout action controls supplied by the default page or a host layout. */
  paneToggles?: ReactNode;
}

export default function SequenceToolbar({
  transport,
  splitAtPlayhead,
  splitMode,
  toggleSplitMode,
  undo,
  redo,
  deleteSelection,
  shorten,
  addTrack,
  renameTrack,
  paneToggles,
}: SequenceToolbarProps) {
  return (
    <header className="flex flex-wrap items-center gap-2">
      <h1 className="mr-3 text-xl font-semibold">Sequence editor</h1>
      <SequenceTransportControls {...transport} />
      <SequenceEditButton onClick={splitAtPlayhead}>Split</SequenceEditButton>
      {toggleSplitMode && (
        <button
          type="button"
          aria-pressed={splitMode}
          className="rounded border px-3 py-1 text-sm aria-pressed:bg-amber-200 aria-pressed:text-amber-950"
          onClick={toggleSplitMode}
        >
          Split mode
        </button>
      )}
      <SequenceEditButton onClick={undo}>Undo</SequenceEditButton>
      <SequenceEditButton onClick={redo}>Redo</SequenceEditButton>
      <SequenceEditButton onClick={deleteSelection}>Delete</SequenceEditButton>
      {shorten && <ShortenSequenceForm {...shorten} />}
      {addTrack && <AddSequenceTrack onAddTrack={addTrack} />}
      {renameTrack && <RenameSequenceTrack {...renameTrack} />}
      {paneToggles}
    </header>
  );
}
