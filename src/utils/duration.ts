import { Temporal } from "temporal-polyfill";

export function isoToSeconds(iso8601Duration: string): number {
  const duration = Temporal.Duration.from(iso8601Duration);
  return duration.total({ unit: "seconds" });
}

export function isoToMs(iso8601Duration: string): number {
  const duration = Temporal.Duration.from(iso8601Duration);
  return duration.total({ unit: "milliseconds" });
}

export function msToIso(ms: number): string {
  const duration = Temporal.Duration.from({ milliseconds: ms });
  return duration.toString();
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
  const seconds = isoToSeconds(iso8601);

  return formatMs(seconds * 1000);
}

/**
 * Formats a duration in milliseconds into a string representation of minutes and seconds.
 * @param ms - The duration in milliseconds to format.
 * @returns The formatted timestamp string in the format "mm:ss".
 */
export function formatMs(ms: number): string {
  const seconds = ms / 1000;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  const [stringSeconds, stringFractionDigits] = remainingSeconds
    .toPrecision(2)
    .split(".");

  return `${String(minutes).padStart(2, "0")}:${stringSeconds.padStart(2, "0")}${stringFractionDigits ? `.${stringFractionDigits}` : ""}`;
}
