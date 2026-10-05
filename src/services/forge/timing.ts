import type { WorkoutSession } from "@/types/gymos";

/** If nothing was logged for this long, finishing trims the clock back. */
export const IDLE_LIMIT_MS = 30 * 60_000;
/** Time credited after the last logged activity when trimming. */
export const IDLE_GRACE_MS = 5 * 60_000;

const ms = (iso: string | undefined): number =>
  iso ? new Date(iso).getTime() : Number.NaN;

/** Time actually spent training at `now`: elapsed minus paused time. */
export function activeMs(session: WorkoutSession, now: number): number {
  const start = ms(session.startedAt);
  const pausedNow = session.pausedAt ? now - ms(session.pausedAt) : 0;

  return Math.max(0, now - start - (session.pausedMs ?? 0) - pausedNow);
}

/** Duration to display: stored for finished sessions, live otherwise. */
export function durationMs(session: WorkoutSession, now: number): number {
  if (session.backdated) return 0;

  if (session.endedAt) {
    return (
      session.durationMs ??
      Math.max(0, ms(session.endedAt) - ms(session.startedAt))
    );
  }

  return activeMs(session, now);
}

export function pause(session: WorkoutSession, now: Date): WorkoutSession {
  if (session.pausedAt || session.endedAt || session.backdated) return session;

  return { ...session, pausedAt: now.toISOString() };
}

export function resume(session: WorkoutSession, now: Date): WorkoutSession {
  if (!session.pausedAt) return session;

  const next: WorkoutSession = {
    ...session,
    pausedMs:
      (session.pausedMs ?? 0) +
      Math.max(0, now.getTime() - ms(session.pausedAt)),
  };

  delete next.pausedAt;

  return next;
}

/**
 * Close a session. The clock is the active time, with two protections for
 * a workout left open: a paused session ends at the pause, and one idle
 * for 30+ minutes ends 5 minutes after its last activity (`trimmed`).
 * `endedAt` is set to start + active duration so every consumer that
 * subtracts the two sees training time, not wall time.
 */
export function finish(
  session: WorkoutSession,
  now: Date,
): { session: WorkoutSession; trimmed: boolean } {
  const nowMs = now.getTime();
  const next: WorkoutSession = { ...session };
  let trimmed = false;

  if (session.backdated) {
    next.endedAt = session.startedAt;
    next.durationMs = 0;
  } else {
    const last = ms(session.lastActivityAt) || nowMs;
    let cutoff = session.pausedAt ? ms(session.pausedAt) : nowMs;

    if (!session.pausedAt && nowMs - last > IDLE_LIMIT_MS) {
      cutoff = last + IDLE_GRACE_MS;
      trimmed = true;
    }

    const duration = activeMs(session, Math.min(cutoff, nowMs));

    next.durationMs = duration;
    next.endedAt = new Date(ms(session.startedAt) + duration).toISOString();
  }

  delete next.pausedAt;

  return { session: next, trimmed };
}

/**
 * Reopen a finished session; the clock continues from its duration. Reopening
 * is itself activity: without resetting `lastActivityAt`, finishing later
 * would measure idle time from before the session was ever finished and trim
 * the whole workout away. Backdated sessions keep their timestamps as is.
 */
export function reopen(session: WorkoutSession, now: Date): WorkoutSession {
  const next: WorkoutSession = { ...session };

  if (!session.backdated) {
    const elapsed = now.getTime() - ms(session.startedAt);

    next.pausedMs = Math.max(0, elapsed - durationMs(session, now.getTime()));
    next.lastActivityAt = now.toISOString();
  }

  delete next.endedAt;
  delete next.durationMs;
  delete next.pausedAt;
  delete next.prs;

  return next;
}

export function formatClock(totalMs: number): string {
  const seconds = Math.max(0, Math.floor(totalMs / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
