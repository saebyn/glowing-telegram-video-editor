import { createContext, type ReactNode, useContext } from "react";
import type { FrameRate } from "@/types";

const ProjectContext = createContext<FrameRate | null>(null);

export interface ProjectProviderProps {
  frameRate: FrameRate;
  children: ReactNode;
}

/** Supplies the sequence frame rate without owning layout or edit state. */
export function ProjectProvider({ frameRate, children }: ProjectProviderProps) {
  return <ProjectContext.Provider value={frameRate}>{children}</ProjectContext.Provider>;
}

export function useProjectFrameRate(sourceFrameRate?: FrameRate): FrameRate {
  const projectFrameRate = useContext(ProjectContext);
  const frameRate = sourceFrameRate ?? projectFrameRate;
  if (!frameRate) throw new Error("Sequence components must be used within a ProjectProvider");
  return frameRate;
}
