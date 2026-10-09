import AsyncStorage from "@react-native-async-storage/async-storage";
import { createElement } from "react";
import { AppState } from "react-native";

import { TodayView } from "@/components/nutrition/today-view";
import { useNourish } from "@/hooks/use-nourish";
import { addMeals } from "@/storage/repositories/meals";
import { addSavedFood, type SavedFood } from "@/storage/repositories/saved-foods";
import type { Meal } from "@/types/gymos";
import { addDaysToKey, getTodayKey, timestampForKey } from "@/utils/date";
import { showToast } from "@/utils/toast";

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("@/utils/toast", () => ({ showToast: jest.fn(), showUndoToast: jest.fn() }));

// Run the focus effect once on mount so the hook loads like it does on screen.
jest.mock("expo-router", () => ({
  useFocusEffect: (callback: () => void) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("react").useEffect(callback, [callback]),
}));

// lucide-react-native ships ESM that Jest's transform ignores; decoration only.
jest.mock("lucide-react-native", () => ({
  ChevronLeft: () => null,
  ChevronRight: () => null,
  Plus: () => null,
  Send: () => null,
  RotateCcw: () => null,
  Bookmark: () => null,
  Utensils: () => null,
  Sparkles: () => null,
}));

jest.mock("@/components/nutrition/nourish-ui", () => ({
  ...jest.requireActual("@/components/nutrition/nourish-ui"),
  Ring: ({ children }: { children: unknown }) => children,
  Bar: () => null,
}));

jest.mock("@/components/nutrition/log-sheets", () => ({
  ReviewSheet: () => null,
  ManualSheet: () => null,
  EditEntrySheet: () => null,
}));

jest.mock("@/components/nutrition/more-sheets", () => ({
  CardioSheet: () => null,
  MicrosSheet: () => null,
  SuggestionsSheet: () => null,
  SavedSheet: () => null,
}));

// The real repositories run against the in-memory AsyncStorage mock. Only the
// two append-style writes are wrapped so a test can hold one open (or fail it)
// and count how many times it was really invoked. Each delegates to the real
// implementation unless a test overrides it (see beforeEach).
jest.mock("@/storage/repositories/meals", () => ({
  ...jest.requireActual("@/storage/repositories/meals"),
  addMeals: jest.fn(),
}));

jest.mock("@/storage/repositories/saved-foods", () => ({
  ...jest.requireActual("@/storage/repositories/saved-foods"),
  addSavedFood: jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Nourish = ReturnType<typeof useNourish>;
type Instance = {
  props: Record<string, unknown>;
  parent: Instance | null;
  children: unknown[];
};

const mockAddMeals = addMeals as unknown as jest.Mock;
const mockAddSavedFood = addSavedFood as unknown as jest.Mock;

const TODAY = getTodayKey();
const YESTERDAY = addDaysToKey(TODAY, -1);

const MEAL: Meal = {
  id: "m1",
  name: "Dal",
  timestamp: timestampForKey(YESTERDAY, "20:00"),
  slot: "Dinner",
  qty: "1 serving",
  calories: 200,
  protein: 10,
  carbs: 30,
  fat: 5,
};

const SAVED_MEAL = {
  id: "saved-1",
  name: "Usual dinner",
  slot: "Dinner",
  foods: [{ name: "Dal", calories: 200, protein: 10, carbs: 30, fat: 5 }],
  createdAt: new Date().toISOString(),
} as unknown as SavedFood;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const renderers: { unmount: () => void }[] = [];

/** Let storage reads and the post-write reload finish. */
const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

async function mountHook() {
  const result = { current: undefined as unknown as Nourish };

  function Harness() {
    result.current = useNourish();

    return null;
  }

  act(() => {
    renderers.push(TestRenderer.create(createElement(Harness)));
  });
  await settle();

  return { result };
}

let appStateSpy: jest.SpyInstance;

beforeEach(async () => {
  await AsyncStorage.clear();
  (showToast as jest.Mock).mockClear();

  const realMeals = jest.requireActual("@/storage/repositories/meals");
  const realSaved = jest.requireActual("@/storage/repositories/saved-foods");

  mockAddMeals.mockReset();
  mockAddMeals.mockImplementation((...args: unknown[]) => realMeals.addMeals(...args));
  mockAddSavedFood.mockReset();
  mockAddSavedFood.mockImplementation((...args: unknown[]) =>
    realSaved.addSavedFood(...args),
  );

  appStateSpy = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((() => ({ remove: jest.fn() })) as never);
});

afterEach(() => {
  while (renderers.length > 0) {
    const renderer = renderers.pop()!;

    act(() => renderer.unmount());
  }

  appStateSpy.mockRestore();
});

describe("Nourish non-idempotent actions ignore a call while one is running", () => {
  it("1. repeatInto called twice while the first write is pending writes once", async () => {
    const { result } = await mountHook();
    const write = deferred<Meal[]>();

    mockAddMeals.mockImplementationOnce(() => write.promise);

    const first = result.current.actions.repeatInto([MEAL], TODAY);
    const second = result.current.actions.repeatInto([MEAL], TODAY);

    expect(await second).toBe(false);
    expect(mockAddMeals).toHaveBeenCalledTimes(1);

    await act(async () => {
      write.resolve([]);
      await first;
    });

    expect(await first).toBe(true);
    expect(mockAddMeals).toHaveBeenCalledTimes(1);
  });

  it("2. repeatInto works again once the first call has finished", async () => {
    const { result } = await mountHook();
    const write = deferred<Meal[]>();

    mockAddMeals.mockImplementationOnce(() => write.promise);

    const first = result.current.actions.repeatInto([MEAL], TODAY);

    await act(async () => {
      write.resolve([]);
      await first;
    });
    expect(mockAddMeals).toHaveBeenCalledTimes(1);

    let again = false;

    await act(async () => {
      again = await result.current.actions.repeatInto([MEAL], TODAY);
    });

    expect(again).toBe(true);
    expect(mockAddMeals).toHaveBeenCalledTimes(2);
  });

  it("3. logSaved double-call writes once", async () => {
    const { result } = await mountHook();
    const write = deferred<Meal[]>();

    mockAddMeals.mockImplementationOnce(() => write.promise);

    const first = result.current.actions.logSaved(SAVED_MEAL, TODAY);
    const second = result.current.actions.logSaved(SAVED_MEAL, TODAY);

    expect(await second).toBe(false);
    expect(mockAddMeals).toHaveBeenCalledTimes(1);

    await act(async () => {
      write.resolve([]);
      await first;
    });

    expect(mockAddMeals).toHaveBeenCalledTimes(1);
  });

  it("4. saveSection double-call writes once", async () => {
    const { result } = await mountHook();
    const write = deferred<SavedFood>();

    mockAddSavedFood.mockImplementationOnce(() => write.promise);

    const first = result.current.actions.saveSection([MEAL], "Dinner");
    const second = result.current.actions.saveSection([MEAL], "Dinner");

    expect(await second).toBe(false);
    expect(mockAddSavedFood).toHaveBeenCalledTimes(1);

    await act(async () => {
      write.resolve(SAVED_MEAL);
      await first;
    });

    expect(mockAddSavedFood).toHaveBeenCalledTimes(1);
  });

  const cases: [string, (nourish: Nourish) => Promise<boolean>, () => jest.Mock][] = [
    ["repeatInto", (n) => n.actions.repeatInto([MEAL], TODAY), () => mockAddMeals],
    ["logSaved", (n) => n.actions.logSaved(SAVED_MEAL, TODAY), () => mockAddMeals],
    [
      "saveSection",
      (n) => n.actions.saveSection([MEAL], "Dinner"),
      () => mockAddSavedFood,
    ],
  ];

  it.each(cases)("5. a failed %s releases the guard", async (_name, call, write) => {
    const { result } = await mountHook();
    const pending = deferred<never>();

    write().mockImplementationOnce(() => pending.promise);

    const first = call(result.current);
    const ignored = call(result.current);

    expect(await ignored).toBe(false);
    expect(write()).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.reject(new Error("disk full"));
      await first;
    });

    expect(await first).toBe(false);
    expect(showToast).toHaveBeenCalledTimes(1);

    let retried = false;

    await act(async () => {
      retried = await call(result.current);
    });

    expect(retried).toBe(true);
    expect(write()).toHaveBeenCalledTimes(2);
  });
});

describe("TodayView Repeat pill", () => {
  it("6. a double-tap on the pill repeats yesterday once", async () => {
    // Yesterday's entry is what makes the Repeat pill appear.
    await addMeals([
      {
        name: MEAL.name,
        macros: { calories: 200, protein: 10, carbs: 30, fat: 5 },
        slot: "Dinner",
        qty: "1 serving",
        timestamp: MEAL.timestamp,
      },
    ]);
    mockAddMeals.mockClear();

    function Screen() {
      const nourish = useNourish();

      return createElement(TodayView, { nourish });
    }

    act(() => {
      renderers.push(TestRenderer.create(createElement(Screen)));
    });
    await settle();

    const root = (renderers[renderers.length - 1] as unknown as {
      root: { findAll: (p: (n: Instance) => boolean) => Instance[] };
    }).root;

    const press = (label: string) => {
      const hit = root.findAll(
        (n) => n.children?.length === 1 && n.children[0] === label,
      )[0];
      let node: Instance | null = hit ?? null;

      while (node && typeof node.props.onPress !== "function") node = node.parent;

      if (!node) throw new Error(`No pressable for "${label}"`);

      act(() => (node!.props.onPress as () => void)());
    };

    const write = deferred<Meal[]>();

    mockAddMeals.mockImplementationOnce(() => write.promise);

    press("Repeat yesterday");
    press("Repeat yesterday");

    expect(mockAddMeals).toHaveBeenCalledTimes(1);

    await act(async () => {
      write.resolve([]);
    });
    await settle();

    expect(mockAddMeals).toHaveBeenCalledTimes(1);
  });
});
