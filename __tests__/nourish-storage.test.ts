import {
  logSavedMeal,
  recipePerServing,
  repeatDay,
  saveDraft,
  saveRecipe,
  saveSlotAsMeal,
  scaleEntryPatch,
} from "@/services/nourish/diary";
import { resolveLogText } from "@/services/nourish/resolve-log";
import {
  addCardioLog,
  getCardioMap,
  removeCardioLog,
} from "@/storage/repositories/nourish-cardio";
import { getFeelMap, toggleFeel } from "@/storage/repositories/nourish-feel";
import {
  getNourishSettings,
  saveNourishSettings,
  updateNourishSettings,
} from "@/storage/repositories/nourish-settings";
import {
  addMeal,
  addMeals,
  deleteMeal,
  getAllMeals,
  getMealsForDate,
  updateMealById,
} from "@/storage/repositories/meals";
import {
  addSavedFood,
  deleteSavedFood,
  getSavedFoods,
  rememberFoods,
} from "@/storage/repositories/saved-foods";
import { getStorage, setStorage } from "@/storage/storage";
import { slotOfMeal } from "@/services/nourish/slots";
import {
  createRenderDescriptionAiProvider,
  type DescriptionAiProvider,
} from "@/services/meal-description-ai-provider";
import type { DraftItem } from "@/types/nourish";
import { addDaysToKey, getTodayKey } from "@/utils/date";

const TODAY = getTodayKey();

const draft = (over: Partial<DraftItem> = {}): DraftItem => ({
  name: "Dal",
  qty: "1 katori",
  calories: 150,
  protein: 8,
  carbs: 20,
  fat: 4,
  confidence: 0.8,
  multiplier: 1,
  source: "ai",
  ...over,
});

describe("meals repository (diary extensions)", () => {
  it("batch-adds in one write and keeps the new fields", async () => {
    const saved = await addMeals([
      { name: "Roti", macros: { calories: 100 }, slot: "Lunch", qty: "1 roti", confidence: 0.9 },
      { name: "Dal", macros: { calories: 150 } },
    ]);

    expect(saved).toHaveLength(2);

    const all = await getAllMeals();

    expect(all).toHaveLength(2);
    expect(all.find((m) => m.name === "Roti")).toMatchObject({ slot: "Lunch", qty: "1 roti", confidence: 0.9 });
    expect(all.find((m) => m.name === "Dal")?.slot).toBeUndefined();
  });

  it("still loads records saved before slot/qty/confidence existed", async () => {
    await setStorage("@gymos/meals", [
      { id: "old", name: "Old meal", timestamp: new Date(2026, 0, 2, 9, 0).toISOString(), calories: 300 },
    ]);

    const [meal] = await getAllMeals();

    expect(meal?.name).toBe("Old meal");
    expect(slotOfMeal(meal!)).toBe("Breakfast");
  });

  it("edits any day in place without duplicating", async () => {
    const past = addDaysToKey(TODAY, -5);
    const [m] = await addMeals([
      { name: "Old", macros: { calories: 100 }, timestamp: new Date(`${past}T12:00:00`).toISOString() },
    ]);
    const updated = await updateMealById(m!.id, { macros: { calories: 250 }, slot: "Dinner" });

    expect(updated).toMatchObject({ calories: 250, slot: "Dinner", name: "Old" });
    expect(await getAllMeals()).toHaveLength(1);
    expect(await updateMealById("missing", { name: "x" })).toBeNull();
  });

  it("deletes from any day and ignores unknown ids", async () => {
    const past = addDaysToKey(TODAY, -3);
    const [m] = await addMeals([
      { name: "Old", timestamp: new Date(`${past}T12:00:00`).toISOString() },
    ]);
    const keep = await addMeal("Keep");

    await deleteMeal("nope");
    expect(await getAllMeals()).toHaveLength(2);
    await deleteMeal(m!.id);
    expect((await getAllMeals()).map((x) => x.id)).toEqual([keep.id]);
  });

  it("concurrent batch adds never lose entries", async () => {
    await Promise.all(
      Array.from({ length: 8 }, (_, i) => addMeals([{ name: `m${i}` }, { name: `n${i}` }])),
    );

    expect(await getAllMeals()).toHaveLength(16);
  });
});

describe("saved foods memory", () => {
  const base = { name: "Dal", qty: "1 katori", calories: 150, protein: 8, carbs: 20, fat: 4 };

  it("remembers a confirmed food and refreshes it by normalized name", async () => {
    await rememberFoods([base]);
    await rememberFoods([{ ...base, name: "dal ", qty: "2 katori", calories: 300 }]);

    const foods = await getSavedFoods();

    expect(foods).toHaveLength(1);
    expect(foods[0]).toMatchObject({ name: "Dal", qty: "2 katori", calories: 300, uses: 2 });
  });

  it("never merges into a saved meal or recipe of the same name", async () => {
    await addSavedFood("Dal", { calories: 1 }, [{ name: "x", calories: 1, protein: 0, carbs: 0, fat: 0 }]);
    await rememberFoods([base]);

    expect(await getSavedFoods()).toHaveLength(2);
  });

  it("deletes by id", async () => {
    const f = await addSavedFood("A", { calories: 1 });

    await deleteSavedFood(f.id);
    expect(await getSavedFoods()).toHaveLength(0);
  });
});

describe("settings, feel and cardio stores", () => {
  it("seeds settings from legacy targets once and persists", async () => {
    await setStorage("@gymos/nutrition-targets", { calories: 2222, protein: 133 });

    const first = await getNourishSettings();

    expect(first).toMatchObject({ kcal: 2222, protein: 133 });
    await setStorage("@gymos/nutrition-targets", { calories: 1 });
    expect((await getNourishSettings()).kcal).toBe(2222);
    expect(await getStorage("@gymos/nutrition-targets")).toEqual({ calories: 1 });
  });

  it("updates settings atomically and normalizes", async () => {
    await saveNourishSettings({ ...(await getNourishSettings()), kcal: 2400 });

    const next = await updateNourishSettings((s) => ({ ...s, protein: 150 }));

    expect(next).toMatchObject({ kcal: 2400, protein: 150 });
  });

  it("toggles feel on and off and replaces a different value", async () => {
    await toggleFeel("2026-03-01", "Lunch", 3);
    expect((await getFeelMap())["2026-03-01"]).toEqual({ Lunch: 3 });
    await toggleFeel("2026-03-01", "Lunch", 1);
    expect((await getFeelMap())["2026-03-01"]).toEqual({ Lunch: 1 });
    await toggleFeel("2026-03-01", "Lunch", 1);
    expect(await getFeelMap()).toEqual({});
  });

  it("adds and removes cardio per day", async () => {
    const log = await addCardioLog("2026-03-01", { name: "Walk", detail: "30 min", minutes: 30, kcal: 120 });

    expect((await getCardioMap())["2026-03-01"]).toHaveLength(1);
    await removeCardioLog("2026-03-01", log.id);
    expect(await getCardioMap()).toEqual({});
  });
});

describe("diary actions", () => {
  it("saves a reviewed draft with scaling, slot and time, and remembers it", async () => {
    const saved = await saveDraft({
      items: [draft({ multiplier: 2 })],
      slot: "Dinner",
      at: "21:15",
      dayKey: TODAY,
    });

    expect(saved[0]).toMatchObject({ name: "Dal", calories: 300, slot: "Dinner", qty: "2× 1 katori" });

    const meals = await getMealsForDate(TODAY);

    expect(meals).toHaveLength(1);
    expect(new Date(meals[0]!.timestamp).getHours()).toBe(21);
    expect((await getSavedFoods())[0]).toMatchObject({ name: "Dal", calories: 300, uses: 1 });
  });

  it("scales an entry in place", async () => {
    const [m] = await saveDraft({ items: [draft()], slot: "Lunch", at: null, dayKey: TODAY });
    const patch = scaleEntryPatch(m!, { factor: 0.5, slot: "Snacks", dayKey: TODAY });
    const updated = await updateMealById(m!.id, patch);

    expect(updated).toMatchObject({ calories: 75, protein: 4, slot: "Snacks", qty: "0.5× 1 katori" });
  });

  it("repeats a day onto another, keeping slot and time of day", async () => {
    const yesterday = addDaysToKey(TODAY, -1);

    await saveDraft({ items: [draft()], slot: "Lunch", at: "13:30", dayKey: yesterday });

    const copied = await repeatDay(await getMealsForDate(yesterday), TODAY);

    expect(copied).toHaveLength(1);
    expect(slotOfMeal(copied[0]!)).toBe("Lunch");
    expect(await getMealsForDate(TODAY)).toHaveLength(1);
    expect(await getMealsForDate(yesterday)).toHaveLength(1);
  });

  it("saves a section as a meal and logs it back as separate entries", async () => {
    await saveDraft({
      items: [draft({ name: "Roti" }), draft({ name: "Dal" })],
      slot: "Dinner",
      at: null,
      dayKey: TODAY,
    });

    const saved = await saveSlotAsMeal(await getMealsForDate(TODAY), "Dinner");

    expect(saved?.name).toBe("Usual dinner");
    expect(saved?.calories).toBe(300);
    expect(await saveSlotAsMeal([], "Dinner")).toBeNull();

    const other = addDaysToKey(TODAY, -2);
    const logged = await logSavedMeal(saved!, other);

    expect(logged).toHaveLength(2);
    expect(logged.every((m) => slotOfMeal(m) === "Dinner")).toBe(true);
    expect(await getMealsForDate(other)).toHaveLength(2);
  });

  it("builds a per-serving recipe and replaces one with the same name", async () => {
    const items = [draft({ name: "Rajma", calories: 400, protein: 24 }), draft({ name: "Oil", calories: 120, protein: 0, carbs: 0, fat: 14, confidence: 0.6 })];
    const per = recipePerServing(items, 4);

    expect(per.calories).toBe(130);
    expect(per.protein).toBe(6);
    expect(per.confidence).toBe(0.6);

    await saveRecipe("Rajma", items, 4);
    await saveRecipe("rajma", items, 2);

    const recipes = (await getSavedFoods()).filter((f) => f.recipe);

    expect(recipes).toHaveLength(1);
    expect(recipes[0]?.calories).toBe(260);
  });
});

describe("resolveLogText", () => {
  const NUTRIENTS = {
    calories: 321, protein: 22, carbs: 31, fat: 12, fiber: 4, sodium: 180,
    potassium: 240, calcium: 55, iron: 1.2, magnesium: 18, zinc: 0.8,
    vitaminA: 35, vitaminC: 6, vitaminD: 0.4, vitaminB12: 0.3, folate: 18,
  };
  /** A provider talking to a fake proxy through the real transport. */
  const proxy = (respond: () => Promise<unknown> | unknown) =>
    createRenderDescriptionAiProvider({
      baseUrl: "https://proxy.test",
      fetcher: (async () => {
        const body = await respond();

        return { ok: true, status: 200, json: async () => body } as Response;
      }) as unknown as typeof fetch,
    });

  it("is empty for blank text", async () => {
    expect((await resolveLogText("  ", { saved: [], provider: null })).status).toBe("empty");
  });

  it("uses the user's own numbers for a bare saved name", async () => {
    await rememberFoods([{ name: "Dal", qty: "1 bowl", calories: 210, protein: 11, carbs: 25, fat: 6 }]);

    const out = await resolveLogText("dal", { saved: await getSavedFoods(), provider: null });

    expect(out.status).toBe("ready");
    if (out.status === "ready") {
      expect(out.items[0]).toMatchObject({ calories: 210, qty: "1 bowl", source: "saved" });
    }
  });

  it("does not apply a saved portion to a typed quantity", async () => {
    await rememberFoods([{ name: "Egg", qty: "1 egg", calories: 999, protein: 99, carbs: 0, fat: 0 }]);

    const out = await resolveLogText("3 eggs", { saved: await getSavedFoods(), provider: null });

    expect(out.status).toBe("ready");
    if (out.status === "ready") expect(out.items[0]?.calories).not.toBe(999);
  });

  it("falls back to typical values offline and says so", async () => {
    const out = await resolveLogText("quarter plate pasta", { saved: [], provider: null });

    expect(out.status).toBe("manual");

    const staples = await resolveLogText("2 rotis and dal", { saved: [], provider: null });

    expect(staples.status).toBe("ready");
    if (staples.status === "ready") {
      expect(staples.items.length).toBeGreaterThan(0);
    }
  });

  it("goes manual when nothing can resolve a piece", async () => {
    const out = await resolveLogText("2 rotis, unobtainium stew", { saved: [], provider: null });

    expect(out).toEqual({ status: "manual", name: "2 rotis, unobtainium stew", reason: "unavailable" });
  });

  it("caps confidence while eating out", async () => {
    const out = await resolveLogText("2 rotis", { saved: [], provider: null, eatingOut: true });

    expect(out.status).toBe("ready");
    if (out.status === "ready") {
      expect(out.items.every((i) => i.confidence <= 0.5)).toBe(true);
    }
  });

  it("recovers to offline when the provider throws", async () => {
    const broken = { estimate: async () => { throw new Error("down"); } } as unknown as DescriptionAiProvider;
    const out = await resolveLogText("2 rotis, dal", { saved: [], provider: broken });

    expect(out.status).toBe("ready");
  });


  it("resolves through the AI provider and merges with the user's usual foods", async () => {
    await rememberFoods([{ name: "Dal", qty: "1 bowl", calories: 210, protein: 11, carbs: 25, fat: 6 }]);

    const provider = proxy(() => ({
      foods: [{ name: "Dragon fruit protein bar XYZ", estimatedAmount: 1, unit: "serving", ...NUTRIENTS }],
    }));
    const out = await resolveLogText("dal, dragon fruit protein bar", {
      saved: await getSavedFoods(),
      provider,
    });

    expect(out.status).toBe("ready");
    if (out.status === "ready") {
      expect(out.items.map((i) => i.source)).toEqual(["saved", "ai"]);
      expect(out.items[1]).toMatchObject({ name: "Dragon fruit protein bar XYZ", calories: 321, protein: 22, qty: "1 serving" });
      expect(out.items[1]?.fiber).toBe(4);
      expect(out.notice).toBeUndefined();
    }
  });

  it("falls back offline when the proxy sends garbage", async () => {
    const out = await resolveLogText("2 rotis", { saved: [], provider: proxy(() => ({ nope: true })) });

    expect(out.status).toBe("ready");
    if (out.status === "ready") expect(out.items[0]?.source).toBe("catalog");
  });

  it("goes manual, not blank, when the proxy fails and nothing is known", async () => {
    const out = await resolveLogText("zorblax stew", {
      saved: [],
      provider: proxy(() => { throw new Error("network down"); }),
    });

    expect(out).toEqual({ status: "manual", name: "zorblax stew", reason: "unreadable" });
  });

  it("corrects an implausible AI count and caps eating-out confidence", async () => {
    const provider = proxy(() => ({
      foods: [{ name: "Boiled egg", estimatedAmount: 2, unit: "large", ...NUTRIENTS, calories: 600, protein: 60, carbs: 2, fat: 40 }],
    }));
    const out = await resolveLogText("2 boiled eggs", { saved: [], provider, eatingOut: true });

    expect(out.status).toBe("ready");
    if (out.status === "ready") {
      expect(out.items[0]?.protein).toBeLessThan(20);
      expect(out.items[0]?.confidence).toBeLessThanOrEqual(0.5);
    }
  });
});
