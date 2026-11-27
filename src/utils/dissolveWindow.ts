export function getDissolveWindow(cut: number, duration: number, sequenceDuration: number) {
  const start = cut - Math.floor(duration / 2);
  return {
    startFrame: Math.max(0, start),
    endFrame: Math.min(sequenceDuration, start + duration),
    phaseOffsetFrames: Math.max(0, -start),
  };
}
