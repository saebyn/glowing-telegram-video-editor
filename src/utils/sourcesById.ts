import type { SourcesById } from "@/types";

export function getSource<T>(sources: SourcesById<T> | undefined, sourceId: string): T | undefined {
  return sources && Object.hasOwn(sources, sourceId) ? sources[sourceId] : undefined;
}
