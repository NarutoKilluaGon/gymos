/**
 * Minimal FIFO async mutex, dependency-free on purpose.
 *
 * Used to serialize read → modify → write transactions against a
 * single AsyncStorage key so two overlapping operations can't each
 * persist their own stale snapshot (a lost update).
 *
 * Failure-safe by construction: the internal queue tail is advanced
 * with both a fulfillment and a rejection handler, so a task that
 * throws — synchronously or asynchronously — never wedges the lock
 * for subsequent operations. The caller still receives the original
 * error unchanged.
 */

export type Mutex = {
  /**
   * Run `task` once every previously queued task has fully settled.
   * The task's resolved value or rejection is passed through to the
   * caller untouched.
   *
   * Not re-entrant: `task` must never await another `runExclusive`
   * on the same mutex — it would wait for itself and deadlock.
   */
  runExclusive<T>(task: () => T | Promise<T>): Promise<T>;
};

export function createMutex(): Mutex {
  // Tail of the queue. Always observed as settled-agnostic so one
  // failed task can't poison the chain for everything behind it.
  let tail: Promise<unknown> = Promise.resolve();

  return {
    runExclusive<T>(task: () => T | Promise<T>): Promise<T> {
      // Runs after the previous task settles, whatever its outcome.
      // Wrapping in `.then` also converts a synchronous throw from
      // `task` into a rejection instead of breaking the chain.
      const result = tail.then(() => task());

      // Advance the queue independently of `result`'s outcome. Both
      // handlers are required: a fulfillment-only `.then` would leave
      // the tail rejected and permanently block later tasks.
      tail = result.then(
        () => undefined,
        () => undefined,
      );

      return result;
    },
  };
}
