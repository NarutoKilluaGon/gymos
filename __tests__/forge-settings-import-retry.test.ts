import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getForgeSettings,
  updateForgeSettings,
} from "@/storage/repositories/forge-settings";
import { getRoutines } from "@/storage/repositories/routines";
import type { Routine } from "@/types/gymos";

jest.mock("@/storage/repositories/routines", () => ({
  getRoutines: jest.fn(),
}));

const SETTINGS_KEY = "@gymos/forge-settings";
const mockGetRoutines = getRoutines as jest.MockedFunction<typeof getRoutines>;

const push = {
  id: "r1",
  name: "Push",
  exercises: [{ exerciseId: "bench-press", name: "Bench Press", order: 0 }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as Routine;

/** The settings object as persisted, or null if nothing was written. */
async function stored(): Promise<{
  routinesImported?: boolean;
  plans?: unknown[];
} | null> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);

  return raw === null ? null : JSON.parse(raw);
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockGetRoutines.mockReset();
});

describe("routine import: a failed routines read is not an empty list", () => {
  it("failed read leaves the import undone; the next read imports", async () => {
    mockGetRoutines.mockRejectedValueOnce(new Error("read failed"));

    const first = await getForgeSettings();

    // Usable defaults, no import, no invented plan.
    expect(first.routinesImported).toBe(false);
    expect(first.plans).toEqual([]);
    expect((await stored())?.routinesImported).not.toBe(true);

    mockGetRoutines.mockResolvedValueOnce([push]);

    const second = await getForgeSettings();

    expect(second.routinesImported).toBe(true);
    expect(second.plans).toHaveLength(1);
    expect(second.plans[0]?.days[0]?.name).toBe("Push");
    expect(second.activePlanId).toBe(second.plans[0]?.id);
    expect((await stored())?.routinesImported).toBe(true);
    expect(mockGetRoutines).toHaveBeenCalledTimes(2);
  });

  it("a settings update after a failed read keeps the retry possible", async () => {
    mockGetRoutines.mockRejectedValueOnce(new Error("read failed"));

    const updated = await updateForgeSettings((current) => ({
      ...current,
      restSeconds: 120,
    }));

    expect(updated.restSeconds).toBe(120);
    expect(updated.routinesImported).toBe(false);
    expect((await stored())?.routinesImported).not.toBe(true);

    mockGetRoutines.mockResolvedValueOnce([push]);

    const retry = await getForgeSettings();

    expect(retry.routinesImported).toBe(true);
    expect(retry.plans).toHaveLength(1);
    // The unrelated change survived the retry.
    expect(retry.restSeconds).toBe(120);
  });

  it("a successful empty read still completes the migration", async () => {
    mockGetRoutines.mockResolvedValue([]);

    const first = await getForgeSettings();

    expect(first.routinesImported).toBe(true);
    expect(first.plans).toEqual([]);
    expect((await stored())?.routinesImported).toBe(true);

    await getForgeSettings();

    // Done: the routines are not read again.
    expect(mockGetRoutines).toHaveBeenCalledTimes(1);
  });

  it("a successful read with routines imports once", async () => {
    mockGetRoutines.mockResolvedValue([push]);

    const first = await getForgeSettings();
    const second = await getForgeSettings();

    expect(first.plans).toHaveLength(1);
    expect(second.plans).toHaveLength(1);
    expect(second.routinesImported).toBe(true);
    expect(mockGetRoutines).toHaveBeenCalledTimes(1);
  });
});
