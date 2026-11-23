export interface SequenceFrameFormProps {
  id: string;
  label: string;
  button: string;
  frame?: number;
  min: number;
  max?: number;
  onApply: (frame: number) => void;
}

export function SequenceFrameForm({
  label,
  button,
  frame,
  min,
  max,
  onApply,
}: SequenceFrameFormProps) {
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        const input = event.currentTarget.elements.namedItem("frame") as HTMLInputElement;
        onApply(input.valueAsNumber);
      }}
    >
      <label className="block space-y-1 text-sm">
        <span>{label}</span>
        <input
          name="frame"
          type="number"
          required
          min={min}
          max={max}
          step={1}
          defaultValue={frame}
          className="block w-full rounded border border-slate-400 bg-white px-2 py-1 dark:bg-slate-900"
        />
      </label>
      <button
        type="submit"
        className="rounded bg-slate-800 px-3 py-1 text-sm text-white dark:bg-slate-600"
      >
        {button}
      </button>
    </form>
  );
}
