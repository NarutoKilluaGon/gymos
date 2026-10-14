import { groupIntoOccasions, OCCASION_GAP_MINUTES } from "@/services/nourish/timeline-occasions";
import { getOccasionTitles, setOccasionTitle } from "@/storage/repositories/occasion-titles";
import type { Meal } from "@/types/gymos";

function makeMeal(overrides: Partial<Meal> & { id: string; timestamp: string }): Meal {
  return {
    name: "Food",
    calories: 200,
    protein: 10,
    carbs: 20,
    fat: 5,
    ...overrides,
  };
}

describe("timeline-occasions grouping", () => {
  it("returns empty array when meals list is empty", () => {
    expect(groupIntoOccasions([])).toEqual([]);
  });

  it("groups meals within 45 minutes into the same occasion", () => {
    const meal1 = makeMeal({
      id: "1",
      name: "Eggs",
      timestamp: "2026-10-10T08:00:00.000Z",
      calories: 150,
      protein: 12,
    });
    const meal2 = makeMeal({
      id: "2",
      name: "Toast",
      timestamp: "2026-10-10T08:30:00.000Z", // 30 min gap <= 45
      calories: 100,
      protein: 3,
    });

    const occasions = groupIntoOccasions([meal1, meal2]);
    expect(occasions).toHaveLength(1);
    expect(occasions[0].meals).toHaveLength(2);
    expect(occasions[0].meals[0].name).toBe("Eggs");
    expect(occasions[0].meals[1].name).toBe("Toast");
    expect(occasions[0].totals.calories).toBe(250);
    expect(occasions[0].totals.protein).toBe(15);
  });

  it("splits meals separated by more than 45 minutes into separate occasions", () => {
    const meal1 = makeMeal({
      id: "1",
      name: "Eggs",
      timestamp: "2026-10-10T08:00:00.000Z",
      calories: 150,
      slot: "Breakfast",
    });
    const meal2 = makeMeal({
      id: "2",
      name: "Snack Apple",
      timestamp: "2026-10-10T08:46:00.000Z", // 46 min gap > 45
      calories: 80,
      slot: "Breakfast",
    });

    const occasions = groupIntoOccasions([meal1, meal2]);
    expect(occasions).toHaveLength(2);
    expect(occasions[0].meals).toHaveLength(1);
    expect(occasions[0].meals[0].name).toBe("Eggs");
    expect(occasions[1].meals).toHaveLength(1);
    expect(occasions[1].meals[0].name).toBe("Snack Apple");
  });

  it("sorts meals chronologically even if input is unordered", () => {
    const late = makeMeal({
      id: "2",
      name: "Dinner",
      timestamp: "2026-10-10T20:00:00.000Z",
      slot: "Dinner",
    });
    const early = makeMeal({
      id: "1",
      name: "Breakfast",
      timestamp: "2026-10-10T08:00:00.000Z",
      slot: "Breakfast",
    });

    const occasions = groupIntoOccasions([late, early]);
    expect(occasions).toHaveLength(2);
    expect(occasions[0].meals[0].name).toBe("Breakfast");
    expect(occasions[1].meals[0].name).toBe("Dinner");
  });

  it("handles chained meals where each is <= 45m from the preceding one", () => {
    const m1 = makeMeal({ id: "1", timestamp: "2026-10-10T12:00:00.000Z" });
    const m2 = makeMeal({ id: "2", timestamp: "2026-10-10T12:30:00.000Z" }); // 30 min from m1
    const m3 = makeMeal({ id: "3", timestamp: "2026-10-10T13:10:00.000Z" }); // 40 min from m2 (70 min from m1)

    const occasions = groupIntoOccasions([m1, m2, m3]);
    expect(occasions).toHaveLength(1);
    expect(occasions[0].meals).toHaveLength(3);
  });

  it("labels occasion with first meal's clock time and slot", () => {
    const meal = makeMeal({
      id: "1",
      name: "Lunch Bowl",
      timestamp: "2026-10-10T13:15:00.000Z",
      slot: "Lunch",
    });

    const occasions = groupIntoOccasions([meal]);
    expect(occasions).toHaveLength(1);
    expect(occasions[0].slot).toBe("Lunch");
    expect(occasions[0].title).toContain("Lunch");
  });

  it("respects customTitles override", () => {
    const meal = makeMeal({
      id: "1",
      name: "Protein Shake",
      timestamp: "2026-10-10T16:00:00.000Z",
      slot: "Snacks",
    });

    const occasions = groupIntoOccasions([meal], { "occasion-1": "Post-workout Shake" });
    expect(occasions).toHaveLength(1);
    expect(occasions[0].title).toBe("Post-workout Shake");
  });

  it("falls back gracefully for older entries without clock time", () => {
    const meal1 = makeMeal({
      id: "1",
      name: "Old Oats",
      timestamp: "invalid-date",
      slot: "Breakfast",
    });
    const meal2 = makeMeal({
      id: "2",
      name: "Old Eggs",
      timestamp: "invalid-date",
      slot: "Breakfast",
    });

    const occasions = groupIntoOccasions([meal1, meal2]);
    expect(occasions).toHaveLength(1);
    expect(occasions[0].slot).toBe("Breakfast");
    expect(occasions[0].title).toBe("08:30 · Breakfast");
    expect(occasions[0].meals).toHaveLength(2);
  });

  it("two same-slot occasions with different ratings do not share a rating", () => {
    const snack1 = makeMeal({
      id: "s1",
      name: "Apple",
      timestamp: "2026-10-10T15:00:00.000Z",
      slot: "Snacks",
    });
    const snack2 = makeMeal({
      id: "s2",
      name: "Protein Bar",
      timestamp: "2026-10-10T17:30:00.000Z",
      slot: "Snacks",
    });

    const dayFeel = {
      "occasion-s1": 2 as const,
      "occasion-s2": 3 as const,
    };

    const occasions = groupIntoOccasions([snack1, snack2], undefined, dayFeel);
    expect(occasions).toHaveLength(2);
    expect(occasions[0].slot).toBe("Snacks");
    expect(occasions[1].slot).toBe("Snacks");
    expect(occasions[0].feel).toBe(2);
    expect(occasions[1].feel).toBe(3);
  });

  it("preserves renamed title when adding an earlier item to the occasion", () => {
    const mealB = makeMeal({
      id: "b",
      name: "Rice & Dal",
      timestamp: "2026-10-10T13:00:00.000Z",
      slot: "Lunch",
    });

    // Occasion originally had mealB and was renamed to "Work Lunch"
    const initialOccasions = groupIntoOccasions([mealB]);
    expect(initialOccasions[0].id).toBe("occasion-b");

    const customTitles = { "occasion-b": "Work Lunch" };

    // Now user logs mealA eaten earlier (12:40, 20m before mealB)
    const mealA = makeMeal({
      id: "a",
      name: "Salad",
      timestamp: "2026-10-10T12:40:00.000Z",
      slot: "Lunch",
    });

    const updatedOccasions = groupIntoOccasions([mealA, mealB], customTitles);
    expect(updatedOccasions).toHaveLength(1);
    expect(updatedOccasions[0].title).toBe("Work Lunch");
    expect(updatedOccasions[0].id).toBe("occasion-b");
    expect(updatedOccasions[0].meals).toHaveLength(2);
  });

  it("editing an entry's time so it moves to another occasion", () => {
    const mealA = makeMeal({
      id: "a",
      name: "Oatmeal",
      timestamp: "2026-10-10T08:00:00.000Z",
      slot: "Breakfast",
    });
    const mealB = makeMeal({
      id: "b",
      name: "Chicken Bowl",
      timestamp: "2026-10-10T13:00:00.000Z",
      slot: "Lunch",
    });
    const mealC = makeMeal({
      id: "c",
      name: "Boiled Eggs",
      timestamp: "2026-10-10T08:20:00.000Z",
      slot: "Breakfast",
    });

    const customTitles = {
      "occasion-a": "Morning Fuel",
      "occasion-b": "Afternoon Lunch",
    };
    const dayFeel = {
      "occasion-a": 2 as const,
      "occasion-b": 1 as const,
    };

    // Before edit: mealA and mealC are in Occasion 1 (Breakfast), mealB is in Occasion 2 (Lunch)
    const before = groupIntoOccasions([mealA, mealB, mealC], customTitles, dayFeel);
    expect(before).toHaveLength(2);
    expect(before[0].title).toBe("Morning Fuel");
    expect(before[0].meals.map((m) => m.id)).toEqual(["a", "c"]);
    expect(before[0].feel).toBe(2);
    expect(before[1].title).toBe("Afternoon Lunch");
    expect(before[1].meals.map((m) => m.id)).toEqual(["b"]);
    expect(before[1].feel).toBe(1);

    // Edit mealC's time to 13:10 (moving it to Occasion 2)
    const editedMealC = { ...mealC, timestamp: "2026-10-10T13:10:00.000Z", slot: "Lunch" as const };
    const after = groupIntoOccasions([mealA, mealB, editedMealC], customTitles, dayFeel);
    expect(after).toHaveLength(2);
    expect(after[0].title).toBe("Morning Fuel");
    expect(after[0].meals.map((m) => m.id)).toEqual(["a"]);
    expect(after[0].feel).toBe(2);
    expect(after[1].title).toBe("Afternoon Lunch");
    expect(after[1].meals.map((m) => m.id)).toEqual(["b", "c"]);
    expect(after[1].feel).toBe(1);
  });
});

describe("occasion-titles storage repository", () => {
  it("persists and retrieves occasion titles", async () => {
    await setOccasionTitle("occasion-1", "Pre-workout Meal");
    let titles = await getOccasionTitles();
    expect(titles["occasion-1"]).toBe("Pre-workout Meal");

    // Updating title
    await setOccasionTitle("occasion-1", "Early Breakfast");
    titles = await getOccasionTitles();
    expect(titles["occasion-1"]).toBe("Early Breakfast");

    // Clearing title with empty string removes it
    await setOccasionTitle("occasion-1", "   ");
    titles = await getOccasionTitles();
    expect(titles["occasion-1"]).toBeUndefined();
  });
});
