import { Temporal } from "temporal-polyfill";

export function isoToSeconds(iso8601Duration: string): number {
  const duration = Temporal.Duration.from(iso8601Duration);
  return duration.total({ unit: "seconds" });
}

export function secondsToDuration(seconds: number): Temporal.Duration {
  // Convert to milliseconds first to handle rounding and carry correctly,
  // then derive whole seconds and remaining milliseconds.
  const totalMilliseconds = Math.round(seconds * 1000);
  const sign = Math.sign(totalMilliseconds);
  const absTotalMilliseconds = Math.abs(totalMilliseconds);

  const wholeSeconds = Math.floor(absTotalMilliseconds / 1000);
  const remainingMilliseconds = absTotalMilliseconds % 1000;

  return Temporal.Duration.from({
    seconds: sign * wholeSeconds,
    milliseconds: sign * remainingMilliseconds,
  });
}

/**
 * Formats an ISO 8601 Duration into a string representation of minutes and seconds.
 * @param iso8601 - The ISO 8601 Duration to format.
 * @returns The formatted timestamp string in the format "mm:ss".
 */
export function format(iso8601: string): string {
  // Cannot use .toLocaleString() since it depends on
  // Intl.DurationFormat which is not yet supported in Node.js.
  // and not supplied by the Temporal polyfill.
  return formatSeconds(isoToSeconds(iso8601));
}

/** Elapsed-time label, not timecode. Keep enough precision to distinguish neighboring 60 fps frames. */
export function formatSeconds(seconds: number): string {
  const ms = Math.round(Math.abs(seconds) * 1000);
  const minutes = String(Math.floor(ms / 60_000)).padStart(2, "0");
  const wholeSeconds = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
  const fraction = String(ms % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return `${seconds < 0 ? "-" : ""}${minutes}:${wholeSeconds}${fraction ? `.${fraction}` : ""}`;
}
