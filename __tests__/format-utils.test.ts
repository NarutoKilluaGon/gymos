import {
  displayName,
  formatDuration,
  formatNumber,
  formatPlanTarget,
  formatSetGroup,
  formatWeight,
  plural,
} from "@/utils/format";
import type { WorkoutSet } from "@/types/gymos";

describe("Format Utils (src/utils/format.ts)", () => {
  describe("plural", () => {
    it("handles singular and plural counts", () => {
      expect(plural(1, "set")).toBe("1 set");
      expect(plural(3, "set")).toBe("3 sets");
      expect(plural(0, "exercise")).toBe("0 exercises");
      expect(plural(1, "entry", "entries")).toBe("1 entry");
      expect(plural(4, "entry", "entries")).toBe("4 entries");
    });
  });

  describe("formatNumber", () => {
    it("formats integers with thousands separators", () => {
      expect(formatNumber(8000)).toBe("8,000");
      expect(formatNumber(0)).toBe("0");
      expect(formatNumber(1250000)).toBe("1,250,000");
    });

    it("formats floats without trailing zeros when integer", () => {
      expect(formatNumber(2.0)).toBe("2");
      expect(formatNumber(2.5)).toBe("2.5");
      expect(formatNumber(2.123, { max: 2 })).toBe("2.12");
    });
  });

  describe("formatDuration", () => {
    it("formats milliseconds into readable minutes and hours", () => {
      expect(formatDuration(120_000)).toBe("2 min");
      expect(formatDuration(2_820_000)).toBe("47 min");
      expect(formatDuration(3_900_000)).toBe("1 h 05 min");
      expect(formatDuration(7_200_000)).toBe("2 h 00 min");
      expect(formatDuration(0)).toBe("0 min");
    });
  });

  describe("formatWeight", () => {
    it("formats numbers with weight unit", () => {
      expect(formatWeight(35, "kg")).toBe("35 kg");
      expect(formatWeight(27.5, "kg")).toBe("27.5 kg");
      expect(formatWeight(100, "lb")).toBe("100 lb");
    });
  });

  describe("formatSetGroup", () => {
    it("compresses identical sets into N × reps @ weight", () => {
      const sets: WorkoutSet[] = [
        { id: "1", reps: 20, weight: 35, unit: "kg", completed: true },
        { id: "2", reps: 20, weight: 35, unit: "kg", completed: true },
        { id: "3", reps: 20, weight: 35, unit: "kg", completed: true },
      ];
      expect(formatSetGroup(sets, "kg")).toBe("3 × 20 @ 35 kg");
    });

    it("formats mixed sets individually", () => {
      const sets: WorkoutSet[] = [
        { id: "1", reps: 20, weight: 35, unit: "kg", completed: true },
        { id: "2", reps: 12, weight: 30, unit: "kg", completed: true },
      ];
      expect(formatSetGroup(sets, "kg")).toBe("35 kg × 20, 30 kg × 12");
    });

    it("handles bodyweight exercises", () => {
      const bwSets: WorkoutSet[] = [
        { id: "1", reps: 10, weight: 0, completed: true },
        { id: "2", reps: 10, weight: 0, completed: true },
      ];
      expect(formatSetGroup(bwSets, "kg", true)).toBe("2 × 10 @ BW");

      const bwExtraSets: WorkoutSet[] = [
        { id: "1", reps: 10, weight: 10, unit: "kg", completed: true },
        { id: "2", reps: 10, weight: 10, unit: "kg", completed: true },
      ];
      expect(formatSetGroup(bwExtraSets, "kg", true)).toBe("2 × 10 @ BW +10 kg");
    });
  });

  describe("displayName", () => {
    it("capitalizes words while preserving uppercase acronyms", () => {
      expect(displayName("back extension")).toBe("Back Extension");
      expect(displayName("lat pulldown")).toBe("Lat Pulldown");
      expect(displayName("EZ bar curl")).toBe("EZ Bar Curl");
      expect(displayName("DB press")).toBe("DB Press");
      expect(displayName("")).toBe("");
    });
  });

  describe("formatPlanTarget", () => {
    it("formats plan exercise targets consistently", () => {
      expect(formatPlanTarget({ sets: 3, reps: "8-10", weight: 60 }, "kg")).toBe("3 × 8-10 @ 60 kg");
      expect(formatPlanTarget({ sets: 4, reps: "12" }, "kg")).toBe("4 × 12");
      expect(formatPlanTarget({ sets: 3, reps: "5", weight: 0 }, "kg")).toBe("3 × 5");
    });
  });
});
