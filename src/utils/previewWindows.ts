const windowSeconds = 0.5;

export function previewWindowStart(time: number) {
  return Math.floor(time / windowSeconds) * windowSeconds;
}

export function previewWindowEnd(start: number) {
  return start + windowSeconds;
}

export function previewWindowStarts(time: number, duration = 0) {
  const starts = [previewWindowStart(time)];
  for (let boundary = previewWindowEnd(starts[0]); boundary < time + duration - 1e-9;) {
    starts.push(boundary);
    boundary = previewWindowEnd(boundary);
  }
  return starts;
}
