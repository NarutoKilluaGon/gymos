import { planReviewHandoff } from "@/services/review-handoff";
import type { PendingDescriptionReviewAvailability } from "@/services/description-ai-queue";

// The description-ai-queue module pulls in storage and the AI provider;
// this test only needs its pure availability helper, so keep it isolated.
jest.mock("@/storage/storage", () => ({
  getStorage: jest.fn(async () => null),
  setStorage: jest.fn(async () => undefined),
  removeStorage: jest.fn(async () => undefined),
  StorageError: class StorageError extends Error {},
}));

function availability(
  overrides: Partial<PendingDescriptionReviewAvailability> = {},
): PendingDescriptionReviewAvailability {
  return {
    screenMounted: true,
    screenFocused: true,
    nutritionEnabled: true,
    addMealOpen: false,
    mealSheetOpen: false,
    ...overrides,
  };
}

describe("planReviewHandoff", () => {
  it("REGRESSION: a direct submission opens review even though the Add Meal sheet is still open", () => {
    // This is the exact state at the moment Analyze succeeds: the sheet
    // that triggered the handoff has not been closed yet. When the typed
    // description leaked into the pendingId slot, this returned
    // { open: false } and the whole AI flow silently did nothing.
    const plan = planReviewHandoff({
      availability: availability({ addMealOpen: true }),
      handoffInFlight: false,
      description: "  2 rotis and dal  ",
    });

    expect(plan).toEqual({
      open: true,
      pendingReviewId: null,
      pendingReviewDescription: "2 rotis and dal",
    });
  });

  it("a direct submission never carries a pending id", () => {
    const plan = planReviewHandoff({
      availability: availability(),
      handoffInFlight: false,
      description: "banana",
    });

    expect(plan).toMatchObject({ open: true, pendingReviewId: null });
  });

  it("blank description on a direct submission reconciles nothing", () => {
    const plan = planReviewHandoff({
      availability: availability(),
      handoffInFlight: false,
      description: "   ",
    });

    expect(plan).toEqual({
      open: true,
      pendingReviewId: null,
      pendingReviewDescription: null,
    });
  });

  it("a queue retry opens review when the screen is focused and clear", () => {
    const plan = planReviewHandoff({
      availability: availability(),
      handoffInFlight: false,
      pendingId: "p1",
      description: "ignored for queue retries",
    });

    expect(plan).toEqual({
      open: true,
      pendingReviewId: "p1",
      pendingReviewDescription: null,
    });
  });

  it("a queue retry does NOT open while the Add Meal sheet is open", () => {
    expect(
      planReviewHandoff({
        availability: availability({ addMealOpen: true }),
        handoffInFlight: false,
        pendingId: "p1",
      }),
    ).toEqual({ open: false });
  });

  it("a queue retry does NOT open when the screen is unfocused", () => {
    expect(
      planReviewHandoff({
        availability: availability({ screenFocused: false }),
        handoffInFlight: false,
        pendingId: "p1",
      }),
    ).toEqual({ open: false });
  });

  it.each([
    ["screen unmounted", { screenMounted: false }],
    ["nutrition disabled", { nutritionEnabled: false }],
    ["review sheet already open", { mealSheetOpen: true }],
  ])("nothing opens when %s", (_label, override) => {
    const base = availability(override);

    expect(
      planReviewHandoff({
        availability: base,
        handoffInFlight: false,
        description: "x",
      }),
    ).toEqual({ open: false });
    expect(
      planReviewHandoff({
        availability: base,
        handoffInFlight: false,
        pendingId: "p1",
      }),
    ).toEqual({ open: false });
  });

  it("nothing opens while another handoff is in flight", () => {
    expect(
      planReviewHandoff({
        availability: availability(),
        handoffInFlight: true,
        description: "x",
      }),
    ).toEqual({ open: false });
  });
});
