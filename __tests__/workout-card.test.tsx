import { WorkoutCard } from "@/components/dashboard/workout-card";
import type { PlanDay } from "@/types/forge";

const mockNavigate = jest.fn();

// The theme module side-effect-imports a stylesheet Jest cannot parse.
jest.mock("@/global.css", () => ({}));

jest.mock("expo-router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
// react-test-renderer ships with jest-expo (no @types), so load it untyped.
const TestRenderer = require("react-test-renderer");

type Node = { type?: string; props?: Record<string, unknown>; children?: (Node | string)[] | null };

function render(element: React.ReactElement) {
  let renderer: { toJSON: () => Node | Node[] | null; root: { findAll: (p: (n: { props: Record<string, unknown> }) => boolean) => { props: Record<string, unknown> }[] } };

  TestRenderer.act(() => {
    renderer = TestRenderer.create(element);
  });

  const texts: string[] = [];
  const walk = (node: Node | string | null | (Node | string)[]) => {
    if (node === null) return;
    if (typeof node === "string") texts.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else (node.children ?? []).forEach(walk);
  };

  walk(renderer!.toJSON());

  return {
    texts,
    press: (label: string) =>
      renderer!.root
        .findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === "function")[0]
        ?.props.onPress,
  };
}

const day: PlanDay = {
  id: "d1",
  name: "Upper A",
  exercises: [
    { exerciseId: "bench", name: "Bench press", sets: 3, reps: "8-10", weight: 0 },
    { exerciseId: "row", name: "Row", sets: 3, reps: "8-10", weight: 0 },
  ],
};

describe("WorkoutCard", () => {
  beforeEach(() => mockNavigate.mockClear());

  it("shows today's day from the Forge plan", () => {
    const { texts } = render(<WorkoutCard plannedDay={day} />);

    expect(texts).toContain("Upper A");
    expect(texts).toContain("2 exercises ready — start from Workouts.");
    expect(texts).toContain("WORKOUT SCHEDULED");
  });

  it("no longer renders the legacy routine chip", () => {
    const { texts } = render(<WorkoutCard plannedDay={day} />);

    expect(texts).not.toContain("Start routine");
  });

  it("falls back to the empty state with no planned day", () => {
    const { texts } = render(<WorkoutCard plannedDay={null} />);

    expect(texts).toContain("No workout yet");
  });

  it("an active workout wins over the planned day", () => {
    const { texts } = render(
      <WorkoutCard
        plannedDay={day}
        workout={{
          id: "w",
          name: "Live session",
          startedAt: "2026-03-01T10:00:00.000Z",
          exercises: [],
        }}
      />,
    );

    expect(texts).toContain("Live session");
    expect(texts).not.toContain("Upper A");
  });

  it("the idle card opens Workouts", () => {
    const { press } = render(<WorkoutCard plannedDay={day} />);

    (press("Open workouts") as () => void)();

    expect(mockNavigate).toHaveBeenCalledWith("/workouts");
  });

  it("shows finished today state with volume and duration", () => {
    const { texts, press } = render(
      <WorkoutCard
        plannedDay={day}
        finishedToday={{
          id: "f1",
          name: "Back & Biceps",
          startedAt: "2026-03-01T10:00:00.000Z",
          endedAt: "2026-03-01T10:47:00.000Z",
          exercises: [
            {
              id: "e1",
              exerciseId: "pullup",
              name: "Pull Up",
              sets: [
                { id: "s1", reps: 10, weight: 10, completed: true },
                { id: "s2", reps: 10, weight: 10, completed: true },
              ],
            },
          ],
        }}
      />,
    );

    expect(texts).toContain("WORKOUT COMPLETE");
    expect(texts).toContain("Back & Biceps");
    expect(texts).toContain("200 kg · 1 exercise · 47 min");
    expect(texts).toContain("Up next: Upper A · tomorrow");
    expect(texts).toContain("View");

    (press("View workout") as () => void)();
    expect(mockNavigate).toHaveBeenCalledWith("/workouts");
  });

  it("shows rest day state when scheduled as rest", () => {
    const { texts } = render(
      <WorkoutCard plannedDay={null} isRestDay={true} />,
    );

    expect(texts).toContain("REST & RECOVERY");
    expect(texts).toContain("Rest day");
  });
});
