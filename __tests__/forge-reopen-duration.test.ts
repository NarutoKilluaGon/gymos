import { buildSession } from "@/services/forge/build";
import { durationMs, finish, reopen } from "@/services/forge/timing";
import type { WorkoutSession } from "@/types/gymos";

const MIN = 60_000;

/** A running 60-minute workout whose last logged activity was at its end. */
const running = (): WorkoutSession => ({
  id: "s1",
  name: "Push",
  date: "2026-01-01",
  startedAt: "2026-01-01T10:00:00.000Z",
  lastActivityAt: "2026-01-01T11:00:00.000Z",
  exercises: [],
});

const finishedHourLong = (): WorkoutSession =>
  finish(running(), new Date("2026-01-01T11:00:00.000Z")).session;

describe("reopen then finish after a long idle gap", () => {
  it("keeps the stored duration instead of trimming to zero", () => {
    const done = finishedHourLong();

    expect(done.durationMs).toBe(60 * MIN);

    // Next morning, far past the 30 minute idle limit from the old activity.
    const reopenedAt = new Date("2026-01-02T08:00:00.000Z");
    const reopened = reopen(done, reopenedAt);

    // Reopening is the new activity boundary.
    expect(reopened.lastActivityAt).toBe(reopenedAt.toISOString());
    expect(reopened.endedAt).toBeUndefined();
    expect(durationMs(reopened, reopenedAt.getTime())).toBe(60 * MIN);

    // Finish two minutes later without editing anything.
    const { session: again, trimmed } = finish(
      reopened,
      new Date(reopenedAt.getTime() + 2 * MIN),
    );

    expect(trimmed).toBe(false);
    expect(again.durationMs).toBe(62 * MIN);
    expect(again.durationMs).not.toBe(0);
    expect(again.endedAt).not.toBe(again.startedAt);
    expect(again.endedAt).toBe(
      new Date(Date.parse(again.startedAt) + 62 * MIN).toISOString(),
    );
  });

  it("still trims when the reopened workout is then left idle", () => {
    const reopenedAt = new Date("2026-01-02T08:00:00.000Z");
    const reopened = reopen(finishedHourLong(), reopenedAt);

    // Idle 3 hours after reopening: the normal protection still applies,
    // measured from the reopen time.
    const { session: again, trimmed } = finish(
      reopened,
      new Date(reopenedAt.getTime() + 3 * 60 * MIN),
    );

    expect(trimmed).toBe(true);
    expect(again.durationMs).toBe(60 * MIN + 5 * MIN);
  });

  it("backdated reopen is unchanged: timestamps are not touched", () => {
    const backdated = buildSession({
      name: "Old",
      date: "2026-01-01",
      exercises: [],
      backdated: true,
      newId: () => "b1",
    });
    const done = finish(backdated, new Date("2026-01-05T09:00:00.000Z")).session;
    const reopened = reopen(done, new Date("2026-01-06T09:00:00.000Z"));

    expect(reopened.lastActivityAt).toBe(done.lastActivityAt);
    expect(reopened.pausedMs).toBe(done.pausedMs);
    expect(reopened.endedAt).toBeUndefined();
    expect(finish(reopened, new Date("2026-01-06T09:05:00.000Z")).session.durationMs).toBe(0);
  });
});
