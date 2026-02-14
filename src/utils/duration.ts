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
  // truncate to integer, since Temporal.Duration.from() does not accept floats
  const duration = Temporal.Duration.from({ milliseconds: ms | 0 });
  return duration.toString();
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

  let [stringSeconds, stringFractionDigits] = remainingSeconds
    .toPrecision(2)
    .split(".");

  if (stringFractionDigits === "0") {
    stringFractionDigits = "";
  }

  return `${String(minutes).padStart(2, "0")}:${stringSeconds.padStart(2, "0")}${stringFractionDigits ? `.${stringFractionDigits}` : ""}`;
}
