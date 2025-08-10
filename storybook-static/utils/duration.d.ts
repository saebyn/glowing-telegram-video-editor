export declare function isoToSeconds(iso8601Duration: string): number;
export declare function isoToMs(iso8601Duration: string): number;
export declare function msToIso(ms: number): string;
/**
 * Formats an ISO 8601 Duration into a string representation of minutes and seconds.
 * @param iso8601 - The ISO 8601 Duration to format.
 * @returns The formatted timestamp string in the format "mm:ss".
 */
export declare function format(iso8601: string): string;
/**
 * Formats a duration in milliseconds into a string representation of minutes and seconds.
 * @param ms - The duration in milliseconds to format.
 * @returns The formatted timestamp string in the format "mm:ss".
 */
export declare function formatMs(ms: number): string;
