import { isCompletedWorkout, sessionDate } from "@/services/forge/history";
import { getEvents } from "@/storage/events";
import { getAllJournalEntries } from "@/storage/repositories/journal";
import { getAllSessions } from "@/storage/repositories/workout-sessions";
import type { AppEvent } from "@/types/events";
import type { WorkoutSession } from "@/types/gymos";
import type { TimelineItem } from "@/types/timeline";
import { dateKeyFromTimestamp, timestampForKey } from "@/utils/date";

type TimelineEventType =
  | "workout.finished"
  | "workout.cardio.logged"
  | "meal.logged"
  | "measurement.logged"
  | "weight.logged"
  | "water.logged"
  | "sleep.ended"
  | "northstar.changed"
  | "routine.created";

const TIMELINE_EVENT_TYPES: TimelineEventType[] = [
  "workout.finished",
  "workout.cardio.logged",
  "meal.logged",
  "measurement.logged",
  "weight.logged",
  "water.logged",
  "sleep.ended",
  "northstar.changed",
  "routine.created",
];

/** Discriminated union so `event.payload` narrows with `event.type`. */
type TimelineEvent = {
  [K in TimelineEventType]: AppEvent<K>;
}[TimelineEventType];

/**
 * When a workout belongs on the timeline: inside the local day it is filed
 * under (`session.date`), never the moment its event was logged. A workout
 * finished today for a past day is therefore listed on that past day. The
 * real finish/start time is kept when it falls on that day; otherwise (a
 * backdated or re-dated session) the day's noon stands in, the same anchor
 * Forge uses for backdated sessions.
 */
function workoutTimestamp(session: WorkoutSession): string {
  const day = sessionDate(session);

  for (const candidate of [session.endedAt, session.startedAt]) {
    if (candidate && dateKeyFromTimestamp(candidate) === day) {
      return candidate;
    }
  }

  return day ? timestampForKey(day, "12:00") : session.startedAt;
}

/**
 * The timeline entry for a finished workout, read from the stored session.
 * Events only record the moment of finishing (append-only), so renaming,
 * re-noting, re-dating or editing the workout afterwards would otherwise
 * leave the entry showing what it looked like at finish time.
 */
function storedWorkoutItem(
  event: AppEvent<"workout.finished">,
  session: WorkoutSession,
): TimelineItem {
  return {
    kind: "workout",
    id: event.id,
    timestamp: workoutTimestamp(session),
    name: session.name || "Workout",
    durationMs:
      session.durationMs ??
      Math.max(
        0,
        new Date(session.endedAt ?? session.startedAt).getTime() -
          new Date(session.startedAt).getTime(),
      ),
    exerciseCount: session.exercises.length,
    ...(session.notes ? { notes: session.notes } : {}),
  };
}

function toTimelineItem(
  event: TimelineEvent,
  workoutNames: Map<string, string>,
): TimelineItem {
  switch (event.type) {
    case "workout.finished":
      return {
        kind: "workout",
        id: event.id,
        timestamp: event.timestamp,
        name: workoutNames.get(event.payload.workoutId) ?? "Workout",
        durationMs: event.payload.durationMs,
        exerciseCount: event.payload.exerciseCount,
        ...(event.payload.notes ? { notes: event.payload.notes } : {}),
      };

    case "meal.logged":
      return {
        kind: "meal",
        id: event.id,
        timestamp: event.timestamp,
        name: event.payload.name,
        calories: event.payload.calories,
        protein: event.payload.protein,
      };

    case "measurement.logged":
      return {
        kind: "measurement",
        id: event.id,
        timestamp: event.timestamp,
        type: event.payload.type,
        value: event.payload.value,
        unit: event.payload.unit,
      };

    case "weight.logged":
      return {
        kind: "weight",
        id: event.id,
        timestamp: event.timestamp,
        weight: event.payload.weight,
        unit: event.payload.unit,
      };

    case "water.logged":
      return {
        kind: "water",
        id: event.id,
        timestamp: event.timestamp,
        amountMl: event.payload.amountMl,
      };

    case "sleep.ended":
      return {
        kind: "sleep",
        id: event.id,
        timestamp: event.timestamp,
      };

    case "northstar.changed":
      return {
        kind: "northstar",
        id: event.id,
        timestamp: event.timestamp,
        title: event.payload.newTitle,
      };

    case "routine.created":
      return {
        kind: "routine",
        id: event.id,
        timestamp: event.timestamp,
        name: event.payload.name,
      };

    case "workout.cardio.logged":
      return {
        kind: "cardio",
        id: event.id,
        timestamp: event.timestamp,
        activity: event.payload.activity,
        durationMin: event.payload.durationMin,
        ...(event.payload.distanceKm !== undefined
          ? { distanceKm: event.payload.distanceKm }
          : {}),
        ...(event.payload.calories !== undefined
          ? { calories: event.payload.calories }
          : {}),
      };
  }
}

function isTimelineEvent(
  event: AppEvent,
): event is TimelineEvent {
  return TIMELINE_EVENT_TYPES.includes(
    event.type as TimelineEventType,
  );
}

type DeletedIds = {
  meals: Set<string>;
  measurements: Set<string>;
  sleep: Set<string>;
  cardio: Set<string>;
  workouts: Set<string>;
};

function isTombstoned(
  event: TimelineEvent,
  deleted: DeletedIds,
): boolean {
  switch (event.type) {
    case "meal.logged":
      return deleted.meals.has(event.payload.mealId);
    case "measurement.logged":
      return deleted.measurements.has(
        event.payload.measurementId,
      );
    case "weight.logged":
      return (
        event.payload.measurementId !== undefined &&
        deleted.measurements.has(
          event.payload.measurementId,
        )
      );
    case "sleep.ended":
      return deleted.sleep.has(event.payload.sleepId);
    case "workout.cardio.logged":
      return deleted.cardio.has(event.payload.cardioId);
    case "workout.finished":
      return deleted.workouts.has(event.payload.workoutId);
    default:
      return false;
  }
}

export async function getTimeline(): Promise<TimelineItem[]> {
  const events = await getEvents();

  const deletedIds: DeletedIds = {
    meals: new Set(),
    measurements: new Set(),
    sleep: new Set(),
    cardio: new Set(),
    workouts: new Set(),
  };

  for (const event of events) {
    if (event.type === "meal.deleted") {
      const tombstone = event as AppEvent<"meal.deleted">;

      deletedIds.meals.add(tombstone.payload.mealId);
    } else if (event.type === "measurement.deleted") {
      const tombstone =
        event as AppEvent<"measurement.deleted">;

      deletedIds.measurements.add(
        tombstone.payload.measurementId,
      );
    } else if (event.type === "sleep.deleted") {
      const tombstone = event as AppEvent<"sleep.deleted">;

      deletedIds.sleep.add(tombstone.payload.sleepId);
    } else if (event.type === "workout.deleted") {
      const tombstone = event as AppEvent<"workout.deleted">;

      deletedIds.workouts.add(tombstone.payload.workoutId);
    } else if (event.type === "workout.cardio.removed") {
      const tombstone = event as AppEvent<"workout.cardio.removed">;

      deletedIds.cardio.add(tombstone.payload.cardioId);
    }
  }

  const workoutNames = new Map<string, string>();

  for (const event of events) {
    if (event.type === "workout.started") {
      const started = event as AppEvent<"workout.started">;

      workoutNames.set(
        started.payload.workoutId,
        started.payload.name,
      );
    }
  }

  // A reopened-then-refinished workout emits `workout.finished` again;
  // only its latest finish may appear in the timeline.
  const latestFinish = new Map<string, string>();

  for (const event of events) {
    if (event.type === "workout.finished") {
      const finished = event as AppEvent<"workout.finished">;

      latestFinish.set(finished.payload.workoutId, event.id);
    }
  }

  const sessionsById = new Map<string, WorkoutSession>();

  for (const session of await getAllSessions()) {
    if (Array.isArray(session.exercises)) {
      sessionsById.set(session.id, session);
    }
  }

  const timelineEvents = events
    .filter(isTimelineEvent)
    .filter((event) => !isTombstoned(event, deletedIds))
    .filter((event) => {
      if (event.type !== "workout.finished") return true;

      return latestFinish.get(event.payload.workoutId) === event.id;
    })
    .filter((event) => {
      if (event.type !== "workout.finished") return true;

      // A workout that has been reopened, or finished with nothing logged,
      // is not a completed workout (same rule as streak/History/Insights).
      const stored = sessionsById.get(event.payload.workoutId);

      return !stored || isCompletedWorkout(stored);
    })
    .map((event) => {
      if (event.type === "workout.finished") {
        const stored = sessionsById.get(event.payload.workoutId);

        if (stored) return storedWorkoutItem(event, stored);
      }

      // Everything else (and a finish whose session is no longer stored)
      // keeps reading the event payload, as before.
      return toTimelineItem(event, workoutNames);
    });

  const journalEntries =
    await getAllJournalEntries();

  const journalItems: TimelineItem[] =
    journalEntries.map((entry) => ({
      kind: "journal",
      id: entry.id,
      timestamp: entry.timestamp,
      text: entry.text,
      ...(entry.mood ? { mood: entry.mood } : {}),
    }));

  return [...timelineEvents, ...journalItems].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() -
      new Date(a.timestamp).getTime(),
  );
}