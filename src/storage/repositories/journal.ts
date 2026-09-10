import {
  getAllDailyActivities,
  getDailyActivity,
  saveDailyActivity,
} from "@/storage/daily";
import { appendEvent } from "@/storage/events";
import type { JournalEntry } from "@/types/gymos";
import { getTodayKey } from "@/utils/date";
import { createId } from "@/utils/id";

export async function addJournalEntry(
  text: string,
  mood?: JournalEntry["mood"],
): Promise<JournalEntry> {
  const activity = await getDailyActivity(getTodayKey());

  const entry: JournalEntry = {
    id: createId(),
    text,
    mood,
    timestamp: new Date().toISOString(),
  };

  if (!Array.isArray(activity.journal)) {
    activity.journal = [];
  }

  activity.journal.push(entry);

  await saveDailyActivity(activity);

  await appendEvent("journal.logged", {
    journalId: entry.id,
    textLength: text.length,
    ...(mood ? { mood } : {}),
  });

  return entry;
}

export async function getTodayJournal(): Promise<JournalEntry[]> {
  const activity = await getDailyActivity(getTodayKey());

  return Array.isArray(activity.journal)
    ? activity.journal
    : [];
}

export async function getAllJournalEntries(): Promise<JournalEntry[]> {
  const data = await getAllDailyActivities();

  return Object.values(data)
    .flatMap((activity) =>
      Array.isArray(activity.journal)
        ? activity.journal
        : [],
    )
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() -
        new Date(a.timestamp).getTime(),
    );
}