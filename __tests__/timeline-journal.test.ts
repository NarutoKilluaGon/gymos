import AsyncStorage from "@react-native-async-storage/async-storage";

import { buildSession } from "@/services/forge/build";
import { finish, reopen } from "@/services/forge/timing";
import { getTimeline } from "@/services/timeline";
import { appendEvent } from "@/storage/events";
import { addJournalEntry, deleteJournalEntry } from "@/storage/repositories/journal";
import { deleteSession, saveSession } from "@/storage/repositories/workout-sessions";
import type { WorkoutSession } from "@/types/gymos";
import type { TimelineItem } from "@/types/timeline";
import { addDaysToKey, dateKeyFromTimestamp, getTodayKey } from "@/utils/date";

const TODAY = getTodayKey();
const PAST = addDaysToKey(TODAY, -9);
const OLDER = addDaysToKey(TODAY, -20);

const dayOf = (item: TimelineItem): string | null =>
  dateKeyFromTimestamp(item.timestamp);

const workouts = (items: TimelineItem[]) =>
  items.filter((item) => item.kind === "workout");

/** A finished session in the shape Forge stores it. Times are local. */
const done = (
  id: string,
  date: string,
  extra: Partial<WorkoutSession> = {},
): WorkoutSession => {
  const [y, m, d] = date.split("-").map(Number);

  return {
    id,
    name: id,
    date,
    startedAt: new Date(y!, m! - 1, d!, 18, 0, 0).toISOString(),
    endedAt: new Date(y!, m! - 1, d!, 19, 0, 0).toISOString(),
    durationMs: 3_600_000,
    exercises: [
      { id: "e1", exerciseId: "bench", name: "Bench", sets: [] },
    ],
    ...extra,
  };
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("timeline: entries sit on the workout's date, not the log time", () => {
  it("a workout backdated to a past day is listed on that day", async () => {
    // Exactly how Forge logs one: started on a past date, finished now.
    const backdated = buildSession({
      name: "Upper",
      date: PAST,
      exercises: [],
      backdated: true,
    });
    const { session } = finish(backdated, new Date());

    await saveSession(session);

    const [item] = workouts(await getTimeline());

    expect(item?.kind).toBe("workout");
    expect(dayOf(item!)).toBe(PAST);
  });

  it("a finished workout on today still lists today, at its real finish time", async () => {
    const s = done("t", TODAY);

    await saveSession(s);

    const [item] = workouts(await getTimeline());

    expect(item?.timestamp).toBe(s.endedAt);
    expect(dayOf(item!)).toBe(TODAY);
  });

  it("a workout that ran past midnight stays on the day it was filed under", async () => {
    const [y, m, d] = PAST.split("-").map(Number);
    const late = done("late", PAST, {
      startedAt: new Date(y!, m! - 1, d!, 23, 40, 0).toISOString(),
      endedAt: new Date(y!, m! - 1, d! + 1, 0, 30, 0).toISOString(),
    });

    await saveSession(late);

    const [item] = workouts(await getTimeline());

    expect(dayOf(item!)).toBe(PAST);
  });

  it("a journal note written today stays on today beside a past workout", async () => {
    await saveSession(done("p", PAST));
    await addJournalEntry("felt strong", "good");

    const items = await getTimeline();
    const journal = items.find((item) => item.kind === "journal");

    expect(dayOf(journal!)).toBe(TODAY);
    expect(dayOf(workouts(items)[0]!)).toBe(PAST);
    expect(items[0]?.kind).toBe("journal");
  });
});

describe("timeline: editing a workout updates its entry", () => {
  it("re-dating a finished workout moves its entry to the new day, once", async () => {
    await saveSession(done("m", OLDER));
    expect(dayOf(workouts(await getTimeline())[0]!)).toBe(OLDER);

    await saveSession(done("m", PAST));

    const found = workouts(await getTimeline());

    expect(found.length).toBe(1);
    expect(dayOf(found[0]!)).toBe(PAST);
  });

  it("editing notes after finishing shows the new notes, not the finish-time ones", async () => {
    await saveSession(done("n", PAST, { notes: "first draft" }));
    await saveSession(done("n", PAST, { notes: "second draft" }));

    const found = workouts(await getTimeline());

    expect(found.length).toBe(1);
    expect(found[0]).toMatchObject({ notes: "second draft" });
  });

  it("clearing the notes removes them from the entry", async () => {
    await saveSession(done("c", PAST, { notes: "temp" }));
    await saveSession(done("c", PAST));

    const [item] = workouts(await getTimeline());

    expect(item).not.toHaveProperty("notes");
  });

  it("renaming and changing exercises updates the entry", async () => {
    await saveSession(done("r", PAST, { name: "Upper" }));
    await saveSession(
      done("r", PAST, {
        name: "Upper B",
        exercises: [
          { id: "e1", exerciseId: "bench", name: "Bench", sets: [] },
          { id: "e2", exerciseId: "row", name: "Row", sets: [] },
        ],
      }),
    );

    const [item] = workouts(await getTimeline());

    expect(item).toMatchObject({ name: "Upper B", exerciseCount: 2 });
  });

  it("reopening hides the entry; finishing again shows it once with the new data", async () => {
    const first = done("o", PAST, { notes: "v1" });

    await saveSession(first);
    await saveSession(reopen(first, new Date()));
    expect(workouts(await getTimeline()).length).toBe(0);

    await saveSession(done("o", PAST, { notes: "v2" }));

    const found = workouts(await getTimeline());

    expect(found.length).toBe(1);
    expect(found[0]).toMatchObject({ notes: "v2" });
    expect(dayOf(found[0]!)).toBe(PAST);
  });

  it("deleting a workout removes its entry", async () => {
    await saveSession(done("d", PAST));
    await deleteSession("d");

    expect(workouts(await getTimeline()).length).toBe(0);
  });

  it("an unfinished workout never appears", async () => {
    const open = done("u", PAST);

    delete open.endedAt;
    await saveSession(open);

    expect(workouts(await getTimeline()).length).toBe(0);
  });
});

describe("timeline: several entries across several days", () => {
  it("each entry lands on its own day, newest day first", async () => {
    await saveSession(done("a", OLDER));
    await saveSession(done("b", TODAY));
    await saveSession(done("c", PAST));
    const [y, m, d] = PAST.split("-").map(Number);

    await saveSession(
      done("c2", PAST, {
        startedAt: new Date(y!, m! - 1, d!, 19, 30, 0).toISOString(),
        endedAt: new Date(y!, m! - 1, d!, 20, 30, 0).toISOString(),
      }),
    );

    const days = workouts(await getTimeline()).map(dayOf);

    expect(days).toEqual([TODAY, PAST, PAST, OLDER]);
  });

  it("editing one entry does not disturb the others", async () => {
    await saveSession(done("a", OLDER, { notes: "keep" }));
    await saveSession(done("b", PAST, { notes: "old" }));
    await saveSession(done("b", PAST, { notes: "new" }));

    const found = workouts(await getTimeline());

    expect(found.map(dayOf)).toEqual([PAST, OLDER]);
    expect(found[0]).toMatchObject({ notes: "new" });
    expect(found[1]).toMatchObject({ notes: "keep" });
  });

  it("journal notes and workouts interleave by their own dates; deleting a note leaves workouts alone", async () => {
    await saveSession(done("w", PAST));
    const note = await addJournalEntry("today note");

    const before = await getTimeline();

    expect(before.map((item) => item.kind)).toEqual(["journal", "workout"]);

    await deleteJournalEntry(note.id);

    const after = await getTimeline();

    expect(after.map((item) => item.kind)).toEqual(["workout"]);
    expect(dayOf(after[0]!)).toBe(PAST);
  });

  it("a finish whose session is no longer stored keeps its logged entry", async () => {
    await appendEvent("workout.started", { workoutId: "gone", name: "Legacy" });
    await appendEvent("workout.finished", {
      workoutId: "gone",
      durationMs: 1000,
      exerciseCount: 3,
      notes: "from the log",
    });

    const [item] = workouts(await getTimeline());

    expect(item).toMatchObject({
      name: "Legacy",
      exerciseCount: 3,
      notes: "from the log",
    });
  });
});
