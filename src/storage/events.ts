import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  AppEvent,
  EventPayload,
  EventType,
} from "@/types/events";
import { createId } from "@/utils/id";

const EVENTS_STORAGE_KEY = "@gymos/events";

/**
 * Rolling window to keep the event log bounded.
 * Even a heavy user logging ~50 events/day gets 200 days
 * of history before the oldest events roll off.
 */
const MAX_EVENTS = 10_000;

type StoredEvents = AppEvent[];

/**
 * Append an event to the log. Events are permanent by design —
 * there is no delete or update operation.
 */
export async function appendEvent<
  T extends EventType,
>(
  type: T,
  payload: EventPayload[T],
): Promise<AppEvent<T>> {
  const event: AppEvent<T> = {
    id: createId(),
    type,
    timestamp: new Date().toISOString(),
    payload,
  };

  const existing =
    await AsyncStorage.getItem(
      EVENTS_STORAGE_KEY,
    );

  const events: StoredEvents = existing
    ? (JSON.parse(existing) as StoredEvents)
    : [];

  events.push(event);

  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }

  await AsyncStorage.setItem(
    EVENTS_STORAGE_KEY,
    JSON.stringify(events),
  );

  return event;
}

export async function getEvents(
  filter?: {
    type?: EventType;
    since?: string;
    limit?: number;
  },
): Promise<AppEvent[]> {
  const existing =
    await AsyncStorage.getItem(
      EVENTS_STORAGE_KEY,
    );

  let events: AppEvent[] = existing
    ? (JSON.parse(existing) as AppEvent[])
    : [];

  if (filter?.type) {
    events = events.filter(
      (event) => event.type === filter.type,
    );
  }

  if (filter?.since) {
    const sinceTime = new Date(filter.since).getTime();

    events = events.filter(
      (event) =>
        new Date(event.timestamp).getTime() >=
        sinceTime,
    );
  }

  events.sort(
    (a, b) =>
      new Date(a.timestamp).getTime() -
      new Date(b.timestamp).getTime(),
  );

  if (filter?.limit) {
    events = events.slice(-filter.limit);
  }

  return events;
}