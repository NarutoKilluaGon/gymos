import {
  canPresentPendingDescriptionReview,
  type PendingDescriptionReviewAvailability,
} from "@/services/description-ai-queue";

export type ReviewHandoffPlan =
  | { open: false }
  | {
      open: true;
      /** Queue item to acknowledge after the sheet renders, if any. */
      pendingReviewId: string | null;
      /** Typed description to reconcile against the queue after save.
       *  Only set for a direct submission, never for a queue retry. */
      pendingReviewDescription: string | null;
    };

/**
 * Decide whether a resolved estimate may open the review sheet, and what
 * bookkeeping rides along. Takes a single options object on purpose: the
 * previous positional (estimate, pendingId?, description?) signature was
 * silently miswired once, putting a typed description into the pendingId
 * slot, which then failed the queue-only guard below and made every
 * direct submission a silent no-op.
 *
 * The two paths are deliberately different:
 *  - Direct submission (no pendingId): the Add Meal sheet is STILL open at
 *    this moment (the handoff itself closes it), so the strict
 *    canPresentPendingDescriptionReview check must NOT apply.
 *  - Queue retry (pendingId set): the user may be anywhere, so the review
 *    may only open when the screen is focused with no sheet in the way.
 */
export function planReviewHandoff(input: {
  availability: PendingDescriptionReviewAvailability;
  handoffInFlight: boolean;
  pendingId?: string;
  description?: string;
}): ReviewHandoffPlan {
  const { availability, handoffInFlight, pendingId, description } = input;

  if (
    !availability.screenMounted ||
    !availability.nutritionEnabled ||
    availability.mealSheetOpen ||
    handoffInFlight
  ) {
    return { open: false };
  }

  if (pendingId && !canPresentPendingDescriptionReview(availability)) {
    return { open: false };
  }

  return {
    open: true,
    pendingReviewId: pendingId ?? null,
    pendingReviewDescription: pendingId
      ? null
      : description?.trim() || null,
  };
}
