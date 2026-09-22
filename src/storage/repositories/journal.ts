import {
  getAllDailyActivities,
  getDailyActivity,
  readAllDailyActivitiesUnlocked,
  readDailyActivityUnlocked,
  withDailyLock,
  writeDailyActivityUnlocked,
} from "@/storage/daily";
import { appendEvent } from "@/storage/events";
import type { JournalEntry } from "@/types/gymos";
import { getTodayKey } from "@/utils/date";
import { createId } from "@/utils/id";

export async function addJournalEntry(
  text: string,
  mood?: JournalEntry["mood"],
): Promise<JournalEntry> {
  const saved = await withDailyLock(async () => {
    const activity = await readDailyActivityUnlocked(
      getTodayKey(),
    );

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

    await writeDailyActivityUnlocked(activity);

    return entry;
  });

  await appendEvent("journal.logged", {
    journalId: saved.id,
    textLength: text.length,
    ...(mood ? { mood } : {}),
  });

  return saved;
}

export async function deleteJournalEntry(
  journalId: string,
): Promise<void> {
  await withDailyLock(async () => {
    const data = await readAllDailyActivitiesUnlocked();

    for (const activity of Object.values(data)) {
      if (!Array.isArray(activity.journal)) {
        continue;
      }

      if (!activity.journal.some((item) => item.id === journalId)) {
        continue;
      }

      activity.journal = activity.journal.filter(
        (item) => item.id !== journalId,
      );

      await writeDailyActivityUnlocked(activity);
      return;
    }
  });
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