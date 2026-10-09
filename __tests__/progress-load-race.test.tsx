import { createElement } from "react";
import { Alert } from "react-native";

import ProgressScreen from "@/components/progress/progress";
import {
  deleteProgressPhoto,
  getProgressPhotos,
} from "@/storage/repositories/progress-photos";
import { getExercisesWithHistory } from "@/storage/repositories/workout-progress";
import type { ProgressPhoto } from "@/types/gymos";
import { showToast } from "@/utils/toast";

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");
const act: (callback: () => unknown) => Promise<void> = TestRenderer.act;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The theme module side-effect-imports a stylesheet Jest cannot parse.
jest.mock("@/global.css", () => ({}));
jest.mock("lucide-react-native", () => ({ LineChart: () => null }));
jest.mock("@/utils/toast", () => ({ showToast: jest.fn(), showUndoToast: jest.fn() }));

jest.mock("expo-router", () => {
  const { useEffect } = require("react");

  return {
    useFocusEffect: (callback: () => void) => {
      useEffect(() => {
        callback();
      }, [callback]);
    },
  };
});

jest.mock("@/contexts/modules-context", () => ({
  useModules: () => ({
    enabled: { workouts: true, nutrition: true, progress: true },
    setEnabled: jest.fn(),
  }),
}));

// The sheet's `onSaved` is wired straight to the screen's load: capture it so
// a test can start an extra, overlapping load the way saving a reading does.
const mockSheet: { onSaved?: () => unknown } = {};

jest.mock("@/components/quick-add/measurement-sheet", () => ({
  MeasurementSheet: (props: { onSaved: () => unknown }) => {
    mockSheet.onSaved = props.onSaved;

    return null;
  },
}));

jest.mock("@/storage/repositories/measurements", () => ({
  getMeasurementHistory: jest.fn().mockResolvedValue([]),
  deleteMeasurement: jest.fn(),
}));
jest.mock("@/storage/repositories/progress-photos", () => ({
  getProgressPhotos: jest.fn(),
  deleteProgressPhoto: jest.fn(),
}));
jest.mock("@/storage/repositories/workout-progress", () => ({
  getExercisesWithHistory: jest.fn(),
  getExerciseHistory: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/services/insights", () => ({
  getNorthStarProgress: jest.fn().mockResolvedValue(null),
  getMonthlySummaries: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/services/progress-photos", () => ({
  pickAndSavePhotoFromLibrary: jest.fn(),
}));
jest.mock("@/components/progress/measurement-chart", () => ({
  MeasurementChart: () => null,
}));
jest.mock("@/components/progress/exercise-progress-chart", () => ({
  ExerciseProgressChart: () => null,
}));
jest.mock("@/components/insights/monthly-summary", () => ({
  MonthlySummaryCard: () => null,
}));
jest.mock("@/components/insights/goal-progress", () => ({
  GoalProgressCard: () => null,
}));
// Loading placeholders use reanimated, which Jest can't load.
jest.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => null,
  SkeletonList: () => null,
}));

const mockPhotos = getProgressPhotos as jest.MockedFunction<typeof getProgressPhotos>;
const mockDeletePhoto = deleteProgressPhoto as jest.MockedFunction<typeof deleteProgressPhoto>;
const mockExercises = getExercisesWithHistory as jest.MockedFunction<typeof getExercisesWithHistory>;
const mockToast = showToast as jest.MockedFunction<typeof showToast>;

type Instance = { props: Record<string, unknown> };
type Renderer = {
  root: { findAll: (test: (node: Instance) => boolean) => Instance[] };
  unmount: () => void;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const photo = (id: string): ProgressPhoto => ({
  id,
  uri: `file:///photos/${id}.jpg`,
  date: "2026-03-01",
  timestamp: "2026-03-01T10:00:00.000Z",
});

const settle = async () => {
  for (let i = 0; i < 12; i += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => setImmediate(() => resolve()));
    });
  }
};

let mounted: Renderer | undefined;

async function mount() {
  await act(async () => {
    mounted = TestRenderer.create(createElement(ProgressScreen));
  });

  const renderer = mounted as Renderer;

  /** Photo ids on screen, in order (from each tile's image uri). The Image
   *  component and its host node both carry the props, so de-duplicate. */
  const shownPhotos = () => [
    ...new Set(
      renderer.root
        .findAll(
          (node) =>
            node.props.accessibilityLabel === "Progress photo" &&
            typeof (node.props.source as { uri?: unknown } | undefined)?.uri === "string",
        )
        .map((node) => /([^/]+)\.jpg$/.exec((node.props.source as { uri: string }).uri)?.[1]),
    ),
  ];

  const deleteButtons = () =>
    renderer.root.findAll(
      (node) =>
        node.props.accessibilityLabel === "Delete progress photo" &&
        typeof node.props.onPress === "function",
    );

  return { renderer, shownPhotos, deleteButtons };
}

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  mockPhotos.mockReset();
  mockDeletePhoto.mockReset();
  mockExercises.mockReset();
  mockExercises.mockResolvedValue([]);
  mockToast.mockClear();
  mockSheet.onSaved = undefined;
  alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

afterEach(async () => {
  await act(async () => mounted?.unmount());
  mounted = undefined;
  alertSpy.mockRestore();
});

describe("Progress load sequencing", () => {
  it("a lone load still commits", async () => {
    mockPhotos.mockResolvedValue([photo("a")]);

    const { shownPhotos } = await mount();

    await settle();

    expect(shownPhotos()).toEqual(["a"]);
  });

  it("two overlapping loads resolving out of order: the newest result wins", async () => {
    mockPhotos.mockResolvedValueOnce([photo("base")]);

    const { shownPhotos } = await mount();

    await settle();
    expect(shownPhotos()).toEqual(["base"]);

    // Two more loads start back to back (e.g. two measurements saved).
    const older = deferred<ProgressPhoto[]>();
    const newer = deferred<ProgressPhoto[]>();

    mockPhotos.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    // Each load parks on its own photo read before the next one starts.
    await act(async () => {
      void mockSheet.onSaved?.();
    });
    await settle();
    await act(async () => {
      void mockSheet.onSaved?.();
    });
    await settle();

    // The newer load finishes first and commits.
    await act(async () => newer.resolve([photo("new")]));
    await settle();
    expect(shownPhotos()).toEqual(["new"]);

    // The older load finishes late with an older snapshot.
    await act(async () => older.resolve([photo("old")]));
    await settle();
    expect(shownPhotos()).toEqual(["new"]);
  });

  it("overlapping loads resolving in order still end on the newest", async () => {
    mockPhotos.mockResolvedValueOnce([photo("base")]);

    const { shownPhotos } = await mount();

    await settle();

    const older = deferred<ProgressPhoto[]>();
    const newer = deferred<ProgressPhoto[]>();

    mockPhotos.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    // Each load parks on its own photo read before the next one starts.
    await act(async () => {
      void mockSheet.onSaved?.();
    });
    await settle();
    await act(async () => {
      void mockSheet.onSaved?.();
    });
    await settle();

    await act(async () => older.resolve([photo("old")]));
    await settle();
    await act(async () => newer.resolve([photo("new")]));
    await settle();

    expect(shownPhotos()).toEqual(["new"]);
  });

  it("a stale load can't bring back a photo that was deleted meanwhile", async () => {
    mockPhotos.mockResolvedValueOnce([photo("keep"), photo("gone")]);

    const { shownPhotos, deleteButtons } = await mount();

    await settle();
    expect(shownPhotos()).toEqual(["keep", "gone"]);

    // A load starts and reads the photo list, but is slow to finish...
    const stale = deferred<ProgressPhoto[]>();

    mockPhotos.mockReturnValueOnce(stale.promise);
    await act(async () => {
      void mockSheet.onSaved?.();
    });
    await settle();

    // ...the user deletes a photo and confirms; storage now has one photo.
    mockDeletePhoto.mockResolvedValueOnce(undefined as never);
    mockPhotos.mockResolvedValue([photo("keep")]);

    await act(async () => {
      (deleteButtons()[1]?.props.onPress as () => void)();
    });

    const buttons = (alertSpy.mock.calls[0] as unknown[])[2] as {
      text: string;
      onPress?: () => void;
    }[];

    await act(async () => {
      buttons.find((button) => button.text === "Delete")?.onPress?.();
    });
    await settle();

    expect(mockDeletePhoto).toHaveBeenCalledWith("gone");
    expect(shownPhotos()).toEqual(["keep"]);

    // The slow load finally lands with the list it read before the delete.
    await act(async () => stale.resolve([photo("keep"), photo("gone")]));
    await settle();

    expect(shownPhotos()).toEqual(["keep"]);
  });

  it("a failed delete leaves the photo in place and starts no reload", async () => {
    mockPhotos.mockResolvedValue([photo("keep"), photo("stays")]);

    const { shownPhotos, deleteButtons } = await mount();

    await settle();
    mockPhotos.mockClear();
    mockDeletePhoto.mockRejectedValueOnce(new Error("disk error"));

    await act(async () => {
      (deleteButtons()[1]?.props.onPress as () => void)();
    });

    const buttons = (alertSpy.mock.calls[0] as unknown[])[2] as {
      text: string;
      onPress?: () => void;
    }[];

    await act(async () => {
      buttons.find((button) => button.text === "Delete")?.onPress?.();
    });
    await settle();

    expect(mockToast).toHaveBeenCalledWith("Couldn't delete photo");
    expect(shownPhotos()).toEqual(["keep", "stays"]);
    expect(mockPhotos).not.toHaveBeenCalled();
  });

  it("unmounting while a load is pending commits nothing further", async () => {
    const pending = deferred<ProgressPhoto[]>();

    mockPhotos.mockReturnValueOnce(pending.promise);

    await mount();
    await settle();

    // The load is parked on the photo read; its goal/summary step comes next.
    const { getNorthStarProgress } = require("@/services/insights");

    getNorthStarProgress.mockClear();

    await act(async () => mounted?.unmount());
    mounted = undefined;
    await act(async () => pending.resolve([photo("late")]));
    await settle();

    expect(getNorthStarProgress).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("a superseded load failing late neither toasts nor changes what is shown", async () => {
    mockPhotos.mockResolvedValueOnce([photo("base")]);

    const { shownPhotos } = await mount();

    await settle();

    const older = deferred<ProgressPhoto[]>();

    mockPhotos
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce([photo("new")]);
    // Each load parks on its own photo read before the next one starts.
    await act(async () => {
      void mockSheet.onSaved?.();
    });
    await settle();
    await act(async () => {
      void mockSheet.onSaved?.();
    });
    await settle();
    expect(shownPhotos()).toEqual(["new"]);

    await act(async () => older.reject(new Error("late failure")));
    await settle();

    expect(shownPhotos()).toEqual(["new"]);
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("the newest load failing still toasts", async () => {
    mockPhotos.mockResolvedValueOnce([photo("base")]);

    await mount();
    await settle();

    mockPhotos.mockRejectedValueOnce(new Error("storage unavailable"));
    await act(async () => {
      void mockSheet.onSaved?.();
    });
    await settle();

    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith("Couldn't load progress");
  });
});
