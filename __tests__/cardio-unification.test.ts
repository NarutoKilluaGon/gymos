import {
  CARDIO_ACTIVITIES,
  findCardioActivity,
  matchCardioActivity,
} from "@/data/cardio";
import { estimateCardio, looksLikeCardio } from "@/services/nourish/cardio";

describe("Cardio Unification (Part 10)", () => {
  describe("Shared activity table", () => {
    it("contains all required activities with MET values and aliases", () => {
      const requiredIds = [
        "walking",
        "treadmill",
        "jogging",
        "running",
        "cycling",
        "spinning",
        "elliptical",
        "stairmaster",
        "rowing",
        "swimming",
        "hiking",
        "hiit",
        "jump_rope",
        "aerobics",
        "yoga",
        "pilates",
        "boxing",
        "football",
        "cricket",
        "badminton",
        "tennis",
        "table_tennis",
        "basketball",
        "skating",
        "climbing",
        "other",
      ];

      for (const id of requiredIds) {
        const found = findCardioActivity(id as never);
        expect(found).toBeDefined();
        expect(found!.met).toBeGreaterThan(0);
        expect(found!.label).toBeTruthy();
        expect(found!.aliases.length).toBeGreaterThan(0);
      }
    });

    it("matches activities by longest alias", () => {
      const match1 = matchCardioActivity("elliptical cross for 10 min");
      expect(match1?.id).toBe("elliptical");
      expect(match1?.label).toBe("Elliptical");

      const match2 = matchCardioActivity("stationary bike 30 min");
      expect(match2?.id).toBe("spinning");

      const match3 = matchCardioActivity("rowing machine 2000m");
      expect(match3?.id).toBe("rowing");
    });
  });

  describe("Parser rewrite", () => {
    it("estimates elliptical cross for 10 min without manual number", () => {
      const est = estimateCardio("elliptical cross for 10 min", 70);
      expect(est).not.toBeNull();
      expect(est?.activity).toBe("elliptical");
      expect(est?.name).toBe("Elliptical");
      expect(est?.detail).toBe("10 min");
      expect(est?.minutes).toBe(10);
      expect(est?.kcal).toBe(58);
      expect(est?.needsActivity).toBe(false);
    });

    it("does not eagerly parse incomplete '10 mi' as 10 miles while typing", () => {
      const est = estimateCardio("Elliptical cross for 10 mi", 70);
      // '10 mi' at the end of input without trailing word boundary is treated as incomplete typing
      expect(est).toBeNull();
    });

    it("parses distance in miles when complete word 'miles' or followed by text", () => {
      const est = estimateCardio("run 3 miles", 70);
      expect(est).not.toBeNull();
      expect(est?.activity).toBe("running");
      expect(est?.name).toBe("Run");
      expect(est?.distanceKm).toBeCloseTo(4.83, 1);
      expect(est?.kcal).toBeGreaterThan(300);
    });

    it("parses incline and speed using ACSM equations", () => {
      const flat = estimateCardio("20 mins walk at 5km/h speed", 70);
      const inclined = estimateCardio(
        "20 mins walk on 20 incline at 5km/h speed",
        70,
      );

      expect(flat).not.toBeNull();
      expect(inclined).not.toBeNull();
      expect(inclined?.detail).toContain("20 min");
      expect(inclined?.detail).toContain("20% incline");
      expect(inclined?.detail).toContain("5 km/h");
      // Inclined walk burns significantly more calories than flat walk
      expect(inclined!.kcal).toBeGreaterThan(flat!.kcal * 2);
    });

    it("does not treat bare 'm' alone as minutes", () => {
      const est = estimateCardio("walk 10 m", 70);
      // '10 m' is not 10 minutes
      expect(est).toBeNull();
    });

    it("does not default unknown activity text to Walk", () => {
      const est = estimateCardio("jumped around for 30 mins", 70);
      expect(est).not.toBeNull();
      expect(est?.name).toBe("Cardio");
      expect(est?.activity).toBe("other");
      expect(est?.needsActivity).toBe(true);
      expect(est?.minutes).toBe(30);
      expect(est?.name).not.toBe("Walk");
    });

    it("supports various time unit formats", () => {
      expect(estimateCardio("1 hr cycle", 70)?.minutes).toBe(60);
      expect(estimateCardio("1.5 hours run", 70)?.minutes).toBe(90);
      expect(estimateCardio("45 mins swim", 70)?.minutes).toBe(45);
      expect(estimateCardio("25 minutes hiit", 70)?.minutes).toBe(25);
    });
  });

  describe("looksLikeCardio routing", () => {
    it("recognizes all new unified activity names in log bar", () => {
      expect(looksLikeCardio("elliptical 10 min")).toBe(true);
      expect(looksLikeCardio("stairmaster 20 mins")).toBe(true);
      expect(looksLikeCardio("treadmill 30 min")).toBe(true);
      expect(looksLikeCardio("spinning for 45 min")).toBe(true);
      expect(looksLikeCardio("yoga session 1 hour")).toBe(true);
      expect(looksLikeCardio("boxing 30 min")).toBe(true);
      expect(looksLikeCardio("5 km run")).toBe(true);
      expect(looksLikeCardio("climbed 20 floors")).toBe(true);
    });

    it("does not falsely identify food as cardio", () => {
      expect(looksLikeCardio("chicken and rice")).toBe(false);
      expect(looksLikeCardio("apple pie")).toBe(false);
      expect(looksLikeCardio("2 rotis with paneer")).toBe(false);
    });
  });
});
