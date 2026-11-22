const panes = [
  { id: "clipPool", label: "Clip pool" },
  { id: "preview", label: "Preview" },
  { id: "inspector", label: "Inspector" },
  { id: "timeline", label: "Sequence timeline" },
] as const;

export type WorkspacePane = (typeof panes)[number]["id"];

export default function WorkspacePaneToggles({
  hiddenPanes,
  onToggle,
}: {
  hiddenPanes: ReadonlySet<WorkspacePane>;
  onToggle: (pane: WorkspacePane) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-wrap items-center gap-2">
      <legend className="sr-only">Workspace panes</legend>
      {panes.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-pressed={!hiddenPanes.has(id)}
          className="rounded border border-slate-500 px-3 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 aria-pressed:border-sky-700 aria-pressed:bg-sky-100 dark:aria-pressed:border-sky-400 dark:aria-pressed:bg-sky-900"
          onClick={() => onToggle(id)}
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}
