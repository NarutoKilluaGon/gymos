import { createElement } from "react";

import { TodayView } from "@/components/nutrition/today-view";
import { buildDayModel } from "@/services/nourish/day-model";
import { buildRecords } from "@/services/nourish/insights";
import { DEFAULT_SETTINGS } from "@/services/nourish/targets";
import type { Meal } from "@/types/gymos";
import type { SavedFood } from "@/storage/repositories/saved-foods";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("@/utils/toast", () => ({
  showToast: jest.fn(),
  showUndoToast: jest.fn(),
}));

jest.mock("@/hooks/use-today-key", () => ({
  useTodayKey: () => "2026-10-14",
}));

jest.mock("lucide-react-native", () => ({
  Calendar: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
  Pencil: () => null,
  Plus: () => null,
  Send: () => null,
  ArrowUp: () => null,
  RotateCcw: () => null,
  Bookmark: () => null,
  BookmarkPlus: () => null,
  Utensils: () => null,
  Sparkles: () => null,
}));

jest.mock("@/storage/repositories/occasion-titles", () => ({
  getOccasionTitles: jest.fn().mockResolvedValue({}),
  setOccasionTitle: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/components/nutrition/nourish-ui", () => ({
  ...jest.requireActual("@/components/nutrition/nourish-ui"),
  Ring: ({ children }: { children: unknown }) => children,
  Bar: () => null,
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => void = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Instance = {
  props: Record<string, unknown>;
  parent: Instance | null;
  children: unknown[];
};

const SAMPLE_MEALS: Meal[] = [
  {
    id: "m1",
    name: "Roti",
    qty: "2 pieces",
    calories: 160,
    protein: 6,
    carbs: 30,
    fat: 2,
    timestamp: "2026-10-14T08:30:00.000Z",
    slot: "Breakfast",
  },
  {
    id: "m2",
    name: "Dal tadka",
    qty: "1 bowl",
    calories: 170,
    protein: 9,
    carbs: 22,
    fat: 5,
    timestamp: "2026-10-14T08:35:00.000Z",
    slot: "Breakfast",
  },
];

const SAVED_ROTI: SavedFood = {
  id: "s1",
  name: "Roti",
  qty: "2 pieces",
  calories: 160,
  protein: 6,
  carbs: 30,
  fat: 2,
  createdAt: "2026-10-14T08:00:00.000Z",
};

function renderTodayView({
  meals = SAMPLE_MEALS,
  saved = [SAVED_ROTI],
  feel = {},
}: {
  meals?: Meal[];
  saved?: SavedFood[];
  feel?: Record<string, 1 | 2 | 3>;
} = {}) {
  const dayKey = "2026-10-14";
  const mealsByDay = { [dayKey]: meals };
  const feelByDay = { [dayKey]: feel };
  const model = buildDayModel({
    key: dayKey,
    meals,
    feel: feelByDay,
    cardio: {},
    workoutCardio: {},
    settings: DEFAULT_SETTINGS,
  });

  const setFeelMock = jest.fn().mockResolvedValue(true);
  const createSavedFoodMock = jest.fn().mockResolvedValue(true);
  const saveMealWithItemsMock = jest.fn().mockResolvedValue(true);
  const saveSectionMock = jest.fn().mockResolvedValue(true);
  const removeSavedMock = jest.fn().mockResolvedValue(true);
  const updateSavedFoodMock = jest.fn().mockResolvedValue(true);

  const nourish = {
    data: {
      meals: mealsByDay,
      feel: feelByDay,
      cardio: {},
      settings: DEFAULT_SETTINGS,
      saved,
      weights: [],
      timeline: [],
    },
    model: (_k: string) => model,
    actions: {
      setFeel: setFeelMock,
      createSavedFood: createSavedFoodMock,
      saveMealWithItems: saveMealWithItemsMock,
      saveSection: saveSectionMock,
      removeSaved: removeSavedMock,
      updateSavedFood: updateSavedFoodMock,
      restoreSaved: jest.fn().mockResolvedValue(true),
      saveMeal: jest.fn().mockResolvedValue(true),
      editMeal: jest.fn().mockResolvedValue(true),
      removeEntry: jest.fn().mockResolvedValue(true),
      restoreEntry: jest.fn().mockResolvedValue(true),
      repeatInto: jest.fn().mockResolvedValue(true),
      logSaved: jest.fn().mockResolvedValue(true),
      rememberFood: jest.fn().mockResolvedValue(true),
      addRecipe: jest.fn().mockResolvedValue(true),
      addCardio: jest.fn().mockResolvedValue(true),
      removeCardio: jest.fn().mockResolvedValue(true),
      restoreCardio: jest.fn().mockResolvedValue(true),
      saveSettings: jest.fn().mockResolvedValue(true),
    },
    records: buildRecords(meals, feelByDay, {}),
    weightKg: 75,
    reload: jest.fn().mockResolvedValue(undefined),
  };

  let renderer: {
    root: { findAll: (p: (n: Instance) => boolean) => Instance[] };
    toJSON: () => unknown;
  };

  act(() => {
    renderer = TestRenderer.create(createElement(TodayView, { nourish: nourish as never }));
  });

  const texts = () => JSON.stringify(renderer.toJSON());

  const findByLabel = (label: string | RegExp) => {
    return renderer.root.findAll((n) => {
      const a11y = n.props?.accessibilityLabel;
      if (typeof a11y !== "string") return false;
      if (n.parent && n.parent.props?.accessibilityLabel === a11y) return false;
      return typeof label === "string" ? a11y === label : label.test(a11y);
    });
  };

  const press = (label: string | RegExp) => {
    const hits = findByLabel(label);
    const hit = hits[0];
    let node: Instance | null = hit ?? null;
    while (node && typeof node.props.onPress !== "function") node = node.parent;
    if (!node) throw new Error(`No pressable for ${String(label)}`);
    act(() => (node!.props.onPress as () => void)());
  };

  return {
    texts,
    findByLabel,
    press,
    setFeelMock,
    createSavedFoodMock,
    saveMealWithItemsMock,
    removeSavedMock,
    updateSavedFoodMock,
  };
}

describe("TodayView Phase B UI Integration", () => {
  it("removes the old full-width 'Save as meal' button", () => {
    const { texts } = renderTodayView();
    // "Save as meal" button inside occasion card must no longer exist
    expect(texts()).not.toContain('"Save as meal"');
  });

  it("renders Save meal header icon and satiety text links in occasion card", () => {
    const { findByLabel, press, setFeelMock } = renderTodayView();

    // Save meal icon in occasion header
    const saveMealBtns = findByLabel(/Save .* as meal/i);
    expect(saveMealBtns.length).toBeGreaterThan(0);

    // Satiety text links (Very light / Light / Good / Heavy / Stuffed)
    expect(findByLabel("Very light").length).toBe(1);
    expect(findByLabel("Light").length).toBe(1);
    expect(findByLabel("Good").length).toBe(1);
    expect(findByLabel("Heavy").length).toBe(1);
    expect(findByLabel("Stuffed").length).toBe(1);

    // Tapping feel link triggers setFeel
    press("Good");
    expect(setFeelMock).toHaveBeenCalled();
  });

  it("renders satiety text links with selected state", () => {
    const { findByLabel } = renderTodayView({
      feel: { m1: 2 },
    });

    expect(findByLabel("Very light").length).toBe(1);
    expect(findByLabel("Good").length).toBe(1);
    expect(findByLabel("Stuffed").length).toBe(1);
  });

  it("renders bookmark icons for each food row, indicating saved state", () => {
    const { findByLabel, press, createSavedFoodMock } = renderTodayView();

    // Roti was in mock saved foods -> labeled "Roti is saved"
    expect(findByLabel("Roti is saved").length).toBe(1);

    // Dal tadka was NOT in mock saved foods -> labeled "Save Dal tadka"
    expect(findByLabel("Save Dal tadka").length).toBe(1);

    // Tapping bookmark on unsaved item triggers createSavedFood
    press("Save Dal tadka");
    expect(createSavedFoodMock).toHaveBeenCalledWith(
      "Dal tadka",
      expect.objectContaining({ calories: 170, protein: 9 }),
      undefined,
      expect.objectContaining({ qty: "1 bowl" }),
    );
  });

  it("tapping a filled bookmark with identical macros removes it from saved foods", () => {
    const { press, removeSavedMock } = renderTodayView();

    // Roti in mock has 160 kcal, and saved Roti has 160 kcal
    press("Roti is saved");
    expect(removeSavedMock).toHaveBeenCalledWith("s1");
  });

  it("tapping a filled bookmark with differing macros prompts to update saved food", () => {
    const { Alert } = require("react-native");
    const alertSpy = jest.spyOn(Alert, "alert");

    // Roti saved has 160 kcal, but meal has 200 kcal
    const mealsWithDiffMacros: Meal[] = [
      {
        ...SAMPLE_MEALS[0],
        calories: 200,
        protein: 8,
      },
    ];

    const { press, removeSavedMock } = renderTodayView({
      meals: mealsWithDiffMacros,
    });

    press("Roti is saved");

    // Must NOT remove directly; must show alert
    expect(removeSavedMock).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      "Update saved food?",
      expect.stringContaining("differ from your saved food"),
      expect.any(Array),
    );

    alertSpy.mockRestore();
  });
});
