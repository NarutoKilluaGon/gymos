import { completedSessions, sessionDate } from "@/services/forge/history";
import {
  bestSet,
  formatSet,
  workSets,
  type WeightUnit,
} from "@/services/forge/load";
import { MONTH_SHORT } from "@/services/nourish/insights";
import type { WorkoutSession } from "@/types/gymos";
import { dateFromKey } from "@/utils/date";

export type GridColumn = { session: WorkoutSession; label: string };
export type GridRow = {
  exerciseId: string;
  name: string;
  /** One entry per column: the best set that day, or null. */
  cells: (string | null)[];
  sessions: number;
};

/**
 * Exercises × recent sessions. Each cell is the best work set of that
 * exercise in that session. Rows are ordered by how often the exercise
 * appears (within the shown columns), then name.
 */
export function historyGrid(
  sessions: readonly WorkoutSession[],
  unit: WeightUnit,
  limit = 8,
): { columns: GridColumn[]; rows: GridRow[] } {
  const recent = completedSessions(sessions).slice(-limit);
  const columns = recent.map((session) => {
    const date = dateFromKey(sessionDate(session));

    return {
      session,
      label: `${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`,
    };
  });
  const rows = new Map<string, GridRow>();

  recent.forEach((session, column) => {
    for (const exercise of session.exercises) {
      if (workSets(exercise).length === 0) continue;

      const row = rows.get(exercise.exerciseId) ?? {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        cells: recent.map(() => null),
        sessions: 0,
      };
      const best = bestSet(session, exercise);

      if (best && row.cells[column] === null) {
        row.cells[column] = formatSet(exercise, best, unit);
        row.sessions += 1;
      }

      rows.set(exercise.exerciseId, row);
    }
  });

  return {
    columns,
    rows: [...rows.values()].sort(
      (a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name),
    ),
  };
}
