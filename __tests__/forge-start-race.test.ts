import AsyncStorage from "@react-native-async-storage/async-storage";

import { startSession } from "@/services/forge/start";
import { getEvents } from "@/storage/events";
import {
  createSessionIfNoneActive,
  getAllSessions,
  saveSession,
} from "@/storage/repositories/workout-sessions";
import type { WorkoutSession } from "@/types/gymos";

/** What `useForge().actions.begin` builds on every tap: a brand-new id each time. */
const tap = (date = "2026-03-10"): WorkoutSession =>
  startSession({
    day: null,
    date,
    catalog: [],
    sessions: [],
    unit: "kg",
  });

const unfinished = async () =>
  (await getAllSessions()).filter((session) => !session.endedAt);

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("Forge Start is safe against concurrent calls", () => {
  it("a double-tapped Start leaves exactly one unfinished session", async () => {
    const [first, second] = await Promise.all([
      createSessionIfNoneActive(tap()),
      createSessionIfNoneActive(tap()),
    ]);

    expect(await unfinished()).toHaveLength(1);
    // Both taps end up in the same workout, so the UI opens one session.
    expect(second.session.id).toBe(first.session.id);
    expect([first.created, second.created].filter(Boolean)).toHaveLength(1);
  });

  it("a burst of Start calls (some backdated) still creates one session", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        createSessionIfNoneActive(tap(i % 2 ? "2026-03-10" : "2026-03-08")),
      ),
    );

    expect(await unfinished()).toHaveLength(1);
    expect(await getAllSessions()).toHaveLength(1);
    expect(new Set(results.map((r) => r.session.id)).size).toBe(1);
  });

  it("logs workout.started once", async () => {
    await Promise.all([
      createSessionIfNoneActive(tap()),
      createSessionIfNoneActive(tap()),
      createSessionIfNoneActive(tap()),
    ]);

    const started = (await getEvents()).filter(
      (event) => event.type === "workout.started",
    );

    expect(started).toHaveLength(1);
  });

  it("returns the running session instead of creating another, until it is finished", async () => {
    const first = await createSessionIfNoneActive(tap());
    const again = await createSessionIfNoneActive(tap());

    expect(first.created).toBe(true);
    expect(again.created).toBe(false);
    expect(again.session.id).toBe(first.session.id);

    // Once the running session is finished, Start works again.
    await saveSession({
      ...first.session,
      endedAt: "2026-03-10T11:00:00.000Z",
    });

    const next = await createSessionIfNoneActive(tap());

    expect(next.created).toBe(true);
    expect(next.session.id).not.toBe(first.session.id);
    expect(await unfinished()).toHaveLength(1);
  });
});
