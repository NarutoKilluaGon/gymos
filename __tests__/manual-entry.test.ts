import {
  applyFoodRowPatch,
  establishRowBase,
  foodRowToMealFood,
  type FoodRow,
} from "@/services/meal-estimator";

/** A blank unresolved row, as seeded for manual entry. */
function blankRow(): FoodRow {
  return {
    key: "row-1",
    name: "Mystery stew",
    amount: "1",
    unit: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    micros: {},
    unresolved: true,
  };
}

describe("manual nutrition entry keeps fields independent", () => {
  it("(P) calories only", () => {
    const row = applyFoodRowPatch(blankRow(), { calories: "500" });

    expect(row).toMatchObject({
      calories: "500",
      protein: "",
      carbs: "",
      fat: "",
    });
    expect(foodRowToMealFood(row)).toMatchObject({
      calories: 500,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("(P) protein only", () => {
    const row = applyFoodRowPatch(blankRow(), { protein: "30" });

    expect(row).toMatchObject({
      calories: "",
      protein: "30",
      carbs: "",
      fat: "",
    });
    expect(foodRowToMealFood(row)).toMatchObject({
      calories: 0,
      protein: 30,
    });
  });

  it("(P) calories + protein", () => {
    let row = applyFoodRowPatch(blankRow(), { calories: "500" });
    row = applyFoodRowPatch(row, { protein: "30" });

    expect(row).toMatchObject({
      calories: "500",
      protein: "30",
      carbs: "",
      fat: "",
    });
  });

  it("(P) calories + protein + carbs + fat", () => {
    let row = blankRow();
    row = applyFoodRowPatch(row, { calories: "500" });
    row = applyFoodRowPatch(row, { protein: "30" });
    row = applyFoodRowPatch(row, { carbs: "45" });
    row = applyFoodRowPatch(row, { fat: "20" });

    expect(row).toMatchObject({
      calories: "500",
      protein: "30",
      carbs: "45",
      fat: "20",
    });
    expect(foodRowToMealFood(row)).toMatchObject({
      calories: 500,
      protein: 30,
      carbs: 45,
      fat: 20,
    });
  });

  it("(P) editing an existing manual food preserves untouched fields", () => {
    const existing: FoodRow = {
      ...blankRow(),
      calories: "500",
      protein: "30",
      carbs: "45",
      fat: "20",
    };

    // Changing one field leaves the other three exactly as typed, and
    // refreshes the scaling base from the full current row.
    const edited = applyFoodRowPatch(existing, { protein: "35" });

    expect(edited).toMatchObject({
      calories: "500",
      protein: "35",
      carbs: "45",
      fat: "20",
    });
    expect(edited.baseNutrition).toMatchObject({
      calories: 500,
      protein: 35,
      carbs: 45,
      fat: 20,
    });
  });

  it("(P) clearing a field preserves editing state without zeroing siblings", () => {
    let row = applyFoodRowPatch(blankRow(), { calories: "500" });
    row = applyFoodRowPatch(row, { protein: "30" });

    // Clearing protein keeps "" as typed (not "0"); calories untouched.
    row = applyFoodRowPatch(row, { protein: "" });

    expect(row).toMatchObject({ calories: "500", protein: "" });
    // Persistence still reads blank as zero — at save time, not while
    // typing.
    expect(foodRowToMealFood(row)).toMatchObject({
      calories: 500,
      protein: 0,
    });
  });

  it("catalog rows never take a manual scaling base", () => {
    const row: FoodRow = {
      ...blankRow(),
      name: "Ghee",
      amount: "1",
      unit: "tbsp",
      calories: "135",
      fat: "15",
      entryId: "ghee",
      unresolved: undefined,
    };

    expect(establishRowBase(row)).toBe(row);
    expect(applyFoodRowPatch(row, { protein: "1" }).baseAmount).toBeUndefined();
  });
});
