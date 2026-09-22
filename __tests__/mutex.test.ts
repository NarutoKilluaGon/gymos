import { createMutex } from "@/storage/mutex";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

describe("createMutex", () => {
  it("runs queued tasks one at a time, in FIFO order", async () => {
    const mutex = createMutex();

    let active = 0;
    let maxActive = 0;
    const order: number[] = [];

    const task =
      (id: number, ms: number) => async (): Promise<void> => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await sleep(ms);
        order.push(id);
        active -= 1;
      };

    await Promise.all([
      mutex.runExclusive(task(1, 20)),
      mutex.runExclusive(task(2, 10)),
      mutex.runExclusive(task(3, 1)),
    ]);

    expect(maxActive).toBe(1);
    expect(order).toEqual([1, 2, 3]);
  });

  it("passes a task's return value through to the caller", async () => {
    const mutex = createMutex();

    await expect(
      mutex.runExclusive(async () => "done"),
    ).resolves.toBe("done");
  });

  it("rejects with the original error object", async () => {
    const mutex = createMutex();
    const error = new Error("boom");

    await expect(
      mutex.runExclusive(async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });

  it("keeps serving tasks after a rejected task", async () => {
    const mutex = createMutex();

    const failing = mutex.runExclusive(async () => {
      throw new Error("write failed");
    });
    const following = mutex.runExclusive(
      async () => "recovered",
    );

    await expect(failing).rejects.toThrow("write failed");
    await expect(following).resolves.toBe("recovered");
  });

  it("keeps serving tasks after a task throws synchronously", async () => {
    const mutex = createMutex();

    const syncThrow = mutex.runExclusive<never>(() => {
      throw new Error("sync failure");
    });
    const following = mutex.runExclusive(
      async () => "still running",
    );

    await expect(syncThrow).rejects.toThrow("sync failure");
    await expect(following).resolves.toBe("still running");
  });

  it("does not start a task before the previous one has settled", async () => {
    const mutex = createMutex();

    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = mutex.runExclusive(async () => {
      events.push("first:start");
      await firstGate;
      events.push("first:end");
    });
    const second = mutex.runExclusive(async () => {
      events.push("second:start");
    });

    // Give the queue a chance to misbehave while the first task
    // is still holding the lock.
    await sleep(10);
    expect(events).toEqual(["first:start"]);

    releaseFirst();
    await Promise.all([first, second]);

    expect(events).toEqual([
      "first:start",
      "first:end",
      "second:start",
    ]);
  });
});
