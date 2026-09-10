import { getEvents } from "@/storage/events";
import { getAllJournalEntries } from "@/storage/repositories/journal";
import type { AppEvent } from "@/types/events";
import type { TimelineItem } from "@/types/timeline";

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

export async function getTimeline(): Promise<TimelineItem[]> {
  const events = await getEvents();

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

  const timelineEvents = events
    .filter(isTimelineEvent)
    .map((event) =>
      toTimelineItem(event, workoutNames),
    );

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