import { describe, expect, it } from "vitest";
import { format, isoToSeconds, secondsToDuration } from "./duration";

describe("duration", () => {
  describe("format", () => {
    it("should format a valid ISO 8601 duration to mm:ss", () => {
      expect(format("PT1M30S")).toBe("01:30");
      expect(format("PT10M")).toBe("10:00");
      expect(format("PT1H")).toBe("60:00");
      expect(format("PT1H30M")).toBe("90:00");
      expect(format("PT1H30M30S")).toBe("90:30");
    });

    it("should handle zero duration", () => {
      expect(format("PT0S")).toBe("00:00");
    });

    it("should handle invalid ISO 8601 duration strings gracefully", () => {
      expect(() => format("INVALID")).toThrow();
    });
  });

  describe("isoToSeconds", () => {
    it("should convert ISO 8601 duration to seconds", () => {
      expect(isoToSeconds("PT1H30M45S")).toBe(5445);
      expect(isoToSeconds("PT2H")).toBe(7200);
      expect(isoToSeconds("PT45M")).toBe(2700);
      expect(isoToSeconds("PT30S")).toBe(30);
    });

    it("should throw an error for invalid ISO 8601 duration", () => {
      expect(() => isoToSeconds("")).toThrowError();
      expect(() => isoToSeconds("PT")).toThrowError();
      expect(() => isoToSeconds("PT1H30M45")).toThrowError();
      expect(() => isoToSeconds("PTM")).toThrowError();
    });
  });

  describe("secondsToDuration", () => {
    it("should convert whole seconds to Duration", () => {
      const duration = secondsToDuration(30);
      expect(duration.seconds).toBe(30);
      expect(duration.milliseconds).toBe(0);
    });

    it("should convert fractional seconds to Duration with milliseconds", () => {
      const duration = secondsToDuration(1.5);
      expect(duration.seconds).toBe(1);
      expect(duration.milliseconds).toBe(500);
    });

    it("should handle zero seconds", () => {
      const duration = secondsToDuration(0);
      expect(duration.seconds).toBe(0);
      expect(duration.milliseconds).toBe(0);
    });

    it("should handle negative values", () => {
      const duration = secondsToDuration(-5.25);
      expect(duration.seconds).toBe(-5);
      expect(duration.milliseconds).toBe(-250);
    });

    it("should handle large values", () => {
      const duration = secondsToDuration(3661.123); // 1 hour, 1 minute, 1.123 seconds
      expect(duration.total({ unit: "seconds" })).toBeCloseTo(3661.123, 2);
    });

    it("should round milliseconds correctly", () => {
      // Test that 0.1234 seconds becomes 123ms (rounded from 123.4)
      const duration1 = secondsToDuration(0.1234);
      expect(duration1.milliseconds).toBe(123);

      // Test that 0.1235 seconds becomes 124ms (rounded from 123.5)
      const duration2 = secondsToDuration(0.1235);
      expect(duration2.milliseconds).toBe(124);
    });

    it("should handle very small fractional values", () => {
      const duration = secondsToDuration(0.001); // 1 millisecond
      expect(duration.seconds).toBe(0);
      expect(duration.milliseconds).toBe(1);
    });

    it("should handle negative fractional values", () => {
      const duration = secondsToDuration(-1.999);
      expect(duration.seconds).toBe(-1);
      expect(duration.milliseconds).toBe(-999);
    });

    it("should maintain precision with round-trip conversion", () => {
      const originalSeconds = 123.456;
      const duration = secondsToDuration(originalSeconds);
      const convertedBack = duration.total({ unit: "seconds" });
      expect(convertedBack).toBeCloseTo(originalSeconds, 2);
    });
  });
});
