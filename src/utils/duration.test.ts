import { describe, expect, it } from "vitest";
import { format, isoToSeconds } from "./duration";

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
});
