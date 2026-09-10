import { appendEvent } from "@/storage/events";
import { getStorage, setStorage } from "@/storage/storage";
import type {
  ID,
  Routine,
  RoutineExercise,
  Timestamp,
} from "@/types/gymos";
import { createId } from "@/utils/id";

const ROUTINES_KEY = "@gymos/routines";

type RoutineStore = Record<ID, Routine>;

async function readStore(): Promise<RoutineStore> {
  return (await getStorage<RoutineStore>(ROUTINES_KEY)) ?? {};
}

async function writeStore(store: RoutineStore): Promise<void> {
  await setStorage(ROUTINES_KEY, store);
}

function now(): Timestamp {
  return new Date().toISOString();
}

export async function getRoutines(): Promise<Routine[]> {
  const store = await readStore();

  return Object.values(store)
    .filter((routine) => !routine.archived)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() -
        new Date(a.updatedAt).getTime(),
    );
}

export async function getRoutine(
  id: string,
): Promise<Routine | undefined> {
  const store = await readStore();

  return store[id];
}

export async function createRoutine(
  name: string,
  description?: string,
  exercises: RoutineExercise[] = [],
): Promise<Routine> {
  const routine: Routine = {
    id: createId(),
    name: name.trim(),
    description: description?.trim() || undefined,
    exercises,
    createdAt: now(),
    updatedAt: now(),
  };

  const store = await readStore();

  store[routine.id] = routine;

  await writeStore(store);

  await appendEvent("routine.created", {
    routineId: routine.id,
    name: routine.name,
    exerciseCount: routine.exercises.length,
  });

  return routine;
}

export async function updateRoutine(
  id: string,
  patch: Partial<Pick<Routine, "name" | "description" | "exercises">>,
): Promise<Routine | undefined> {
  const store = await readStore();

  const routine = store[id];

  if (!routine) {
    return undefined;
  }

  const next: Routine = {
    ...routine,
    ...patch,
    name: (patch.name ?? routine.name).trim(),
    description:
      (patch.description ?? routine.description)?.trim() || undefined,
    updatedAt: now(),
  };

  store[id] = next;

  await writeStore(store);

  await appendEvent("routine.updated", {
    routineId: next.id,
    name: next.name,
    exerciseCount: next.exercises.length,
  });

  return next;
}

export async function deleteRoutine(
  id: string,
): Promise<void> {
  const store = await readStore();

  const routine = store[id];

  if (!routine) {
    return;
  }

  delete store[id];

  await writeStore(store);

  await appendEvent("routine.deleted", {
    routineId: id,
    name: routine.name,
    exerciseCount: routine.exercises.length,
  });
}

export async function duplicateRoutine(
  id: string,
): Promise<Routine | undefined> {
  const store = await readStore();

  const source = store[id];

  if (!source) {
    return undefined;
  }

  const copy: Routine = {
    ...source,
    id: createId(),
    name: `Copy of ${source.name}`,
    exercises: source.exercises.map((exercise) => ({
      ...exercise,
    })),
    createdAt: now(),
    updatedAt: now(),
  };

  store[copy.id] = copy;

  await writeStore(store);

  await appendEvent("routine.duplicated", {
    routineId: copy.id,
    sourceRoutineId: id,
    name: copy.name,
    exerciseCount: copy.exercises.length,
  });

  return copy;
}

export async function archiveRoutine(
  id: string,
): Promise<void> {
  const store = await readStore();

  const routine = store[id];

  if (!routine) {
    return;
  }

  store[id] = { ...routine, archived: true, updatedAt: now() };

  await writeStore(store);
}

export async function unarchiveRoutine(
  id: string,
): Promise<void> {
  const store = await readStore();

  const routine = store[id];

  if (!routine) {
    return;
  }

  store[id] = { ...routine, archived: false, updatedAt: now() };

  await writeStore(store);
}