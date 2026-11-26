import type { SequencePreviewGate } from "@/types";

// Private link between the default Preview and the session that owns its play intent.
export const previewSoundStops = new WeakMap<SequencePreviewGate, () => void>();
