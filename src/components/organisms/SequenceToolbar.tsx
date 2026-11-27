import type { ReactNode } from "react";
import type { SequenceTimelineNavigation } from "@/types";
import { SequenceEditButton } from "@/components/atoms/SequenceEditButton";
import { AddSequenceTrack } from "@/components/atoms/SequenceTrackActions";
import RenameSequenceTrack, {
  type RenameSequenceTrackProps,
} from "@/components/molecules/RenameSequenceTrack";
import {
  SequenceTransportControls,
  type SequenceTransportControlsProps,
} from "@/components/molecules/SequenceTransportControls";

export interface SequenceToolbarProps {
  transport: SequenceTransportControlsProps;
  splitAtPlayhead?: () => void;
  splitMode: boolean;
  toggleSplitMode?: () => void;
  snapEnabled?: boolean;
  toggleSnap?: () => void;
  undo?: () => void;
  redo?: () => void;
  deleteSelection?: () => void;
  addTrack?: () => void;
  renameTrack?: RenameSequenceTrackProps;
  navigation?: SequenceTimelineNavigation;
  /** Layout action controls supplied by the default page or a host layout. */
  paneToggles?: ReactNode;
}

export default function SequenceToolbar({
  transport,
  splitAtPlayhead,
  splitMode,
  toggleSplitMode,
  snapEnabled = false,
  toggleSnap,
  undo,
  redo,
  deleteSelection,
  addTrack,
  renameTrack,
  navigation,
  paneToggles,
}: SequenceToolbarProps) {
  return (
    <header className="flex flex-wrap items-center gap-2">
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
      {toggleSnap && (
        <button
          type="button"
          aria-pressed={snapEnabled}
          className="rounded border px-3 py-1 text-sm aria-pressed:bg-amber-200 aria-pressed:text-amber-950"
          onClick={toggleSnap}
        >
          Snap
        </button>
      )}
      <SequenceEditButton onClick={undo}>Undo</SequenceEditButton>
      <SequenceEditButton onClick={redo}>Redo</SequenceEditButton>
      <SequenceEditButton onClick={deleteSelection}>Delete</SequenceEditButton>
      {addTrack && <AddSequenceTrack onAddTrack={addTrack} />}
      {renameTrack && <RenameSequenceTrack {...renameTrack} />}
      {navigation && (
        <>
          <NavigationButton
            label="Pan left"
            action={navigation.panLeft}
            path="M14 5l-7 7 7 7M7 12h13"
          />
          <NavigationButton
            label="Pan right"
            action={navigation.panRight}
            path="M10 5l7 7-7 7M17 12H4"
          />
          <NavigationButton
            label="Zoom out"
            action={navigation.zoomOut?.run}
            disabled={navigation.zoomOut?.disabled}
            path="M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8 11h6"
          />
          <NavigationButton
            label="Zoom in"
            action={navigation.zoomIn?.run}
            disabled={navigation.zoomIn?.disabled}
            path="M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8 11h6m-3-3v6"
          />
          <NavigationButton
            label="Fit to view"
            action={navigation.fitToView}
            path="M4 8V4h4m8 0h4v4m0 8v4h-4m-8 0H4v-4M7 12h10"
          />
        </>
      )}
      {paneToggles}
    </header>
  );
}

function NavigationButton({
  label,
  action,
  disabled,
  path,
}: {
  label: string;
  action: (() => void) | undefined;
  disabled?: boolean;
  path: string;
}) {
  if (!action) return null;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={action}
      disabled={disabled}
      className="rounded border p-2 disabled:opacity-50"
    >
      <svg
        aria-hidden="true"
        className="size-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={path} />
      </svg>
    </button>
  );
}
