import {
  enqueuePendingDescriptionAnalysis,
  getPendingDescriptionAnalysis,
  getPendingDescriptionAnalyses,
  recordPendingDescriptionFailure,
  removePendingDescriptionAnalysis,
  removePendingDescriptionAnalysesByDescription,
  type PendingDescriptionAnalysis,
  type PendingDescriptionErrorCode,
} from "@/storage/repositories/description-ai-queue";
import {
  DescriptionAiError,
  getDescriptionAiProvider,
  resolveMealDescriptionWithAiStaged,
  type DescriptionAiProvider,
  type MealEstimate,
} from "@/services/meal-estimator";

/** Exact user-facing copy for a queued network failure. */
export const OFFLINE_DESCRIPTION_MESSAGE =
  "You're offline. We'll estimate this when you're back online.";

export type PendingDescriptionRetryResult =
  | {
      status: "review";
      item: PendingDescriptionAnalysis;
      estimate: MealEstimate;
    }
  | {
      status: "pending";
      item: PendingDescriptionAnalysis;
      error: DescriptionAiError;
    }
  | {
      status: "needs-attention";
      item: PendingDescriptionAnalysis;
      error: DescriptionAiError;
    }
  | {
      status: "busy";
    }
  | {
      status: "missing";
    }
  | {
      status: "no-provider";
      item: PendingDescriptionAnalysis;
    };

export type PendingDescriptionRetryBatch = {
  results: PendingDescriptionRetryResult[];
};

const inFlightItems = new Set<string>();
let activeRetryPass: Promise<PendingDescriptionRetryBatch> | null =
  null;

export type PendingDescriptionReviewAvailability = {
  /** The screen that owns the review must still be mounted. */
  screenMounted: boolean;
  /** The screen must also be focused for its modal to be visible. */
  screenFocused: boolean;
  nutritionEnabled: boolean;
  addMealOpen: boolean;
  mealSheetOpen: boolean;
};

/** A retry may only hand off when the existing review surface can open. */
export function canPresentPendingDescriptionReview(
  availability: PendingDescriptionReviewAvailability,
): boolean {
  return (
    availability.screenMounted &&
    availability.screenFocused &&
    availability.nutritionEnabled &&
    !availability.addMealOpen &&
    !availability.mealSheetOpen
  );
}

/** Only network/connectivity failures enter the automatic queue. */
export function isNetworkDescriptionFailure(
  error: Pick<DescriptionAiError, "code">,
): boolean {
  return error.code === "network";
}

/**
 * Enqueue only a network failure from the initial description submit.
 * HTTP/provider and invalid-response failures are surfaced to the user
 * without creating an offline item.
 */
export async function enqueueDescriptionAiNetworkFailure(
  description: string,
  error: Pick<DescriptionAiError, "code">,
): Promise<PendingDescriptionAnalysis | null> {
  if (!isNetworkDescriptionFailure(error)) {
    return null;
  }

  return enqueuePendingDescriptionAnalysis(description);
}

export async function acknowledgePendingDescriptionReview(
  id: string,
): Promise<boolean> {
  return removePendingDescriptionAnalysis(id);
}

/** Reconcile a successful direct submission with matching queued work. */
export async function acknowledgePendingDescriptionReviewByDescription(
  description: string,
): Promise<number> {
  return removePendingDescriptionAnalysesByDescription(description);
}

export async function listPendingDescriptionAnalyses(): Promise<
  PendingDescriptionAnalysis[]
> {
  return getPendingDescriptionAnalyses();
}

function mapErrorCode(
  code: DescriptionAiError["code"],
): PendingDescriptionErrorCode {
  // The two unions intentionally share the same three values. Keeping the
  // mapping here makes that persistence boundary explicit.
  return code;
}

/**
 * Retry one item. A success deliberately leaves the item in storage; the
 * caller must hand the estimate to the existing review flow and then call
 * `acknowledgePendingDescriptionReview`. This closes the crash window
 * between an AI response and a visible review sheet.
 */
export async function retryPendingDescription(
  id: string,
  options: {
    provider?: DescriptionAiProvider | null;
  } = {},
): Promise<PendingDescriptionRetryResult> {
  if (inFlightItems.has(id)) {
    return { status: "busy" };
  }

  inFlightItems.add(id);

  try {
    const item = await getPendingDescriptionAnalysis(id);

    if (!item) {
      return { status: "missing" };
    }

    const provider =
      options.provider === undefined
        ? getDescriptionAiProvider()
        : options.provider;

    if (!provider) {
      return { status: "no-provider", item };
    }

    const result = await resolveMealDescriptionWithAiStaged(
      item.description,
      undefined,
      undefined,
      undefined,
      provider,
    );

    if (result.status === "resolved") {
      return {
        status: "review",
        item,
        estimate: result.estimate,
      };
    }

    if (result.status === "empty") {
      // A stored non-empty description should never reach this branch, but
      // treat it as invalid rather than silently dropping the item.
      const invalid = new DescriptionAiError(
        "invalid-response",
        "Pending description resolved to no foods",
      );
      const updated = await recordPendingDescriptionFailure(
        item.id,
        mapErrorCode(invalid.code),
      );

      return {
        status: "needs-attention",
        item: updated ?? item,
        error: invalid,
      };
    }

    const updated = await recordPendingDescriptionFailure(
      item.id,
      mapErrorCode(result.error.code),
    );
    const nextItem = updated ?? item;

    return result.error.code === "network"
      ? {
          status: "pending",
          item: nextItem,
          error: result.error,
        }
      : {
          status: "needs-attention",
          item: nextItem,
          error: result.error,
        };
  } finally {
    inFlightItems.delete(id);
  }
}

/**
 * Retry automatically eligible items sequentially. The first successful
 * result stops the pass so the caller can open one review sheet at a time;
 * remaining items stay durable for the next focus/resume pass.
 */
export function retryPendingDescriptions(
  options: {
    provider?: DescriptionAiProvider | null;
  } = {},
): Promise<PendingDescriptionRetryBatch> {
  if (activeRetryPass) {
    return activeRetryPass;
  }

  const pass = (async (): Promise<PendingDescriptionRetryBatch> => {
    const provider =
      options.provider === undefined
        ? getDescriptionAiProvider()
        : options.provider;

    if (!provider) {
      return { results: [] };
    }

    const items = (await getPendingDescriptionAnalyses()).filter(
      (item) => item.status === "pending",
    );
    const results: PendingDescriptionRetryResult[] = [];

    for (const item of items) {
      const result = await retryPendingDescription(item.id, {
        provider,
      });
      results.push(result);

      if (
        result.status === "review" ||
        result.status === "busy" ||
        result.status === "no-provider"
      ) {
        break;
      }
    }

    return { results };
  })();

  activeRetryPass = pass;
  void pass.then(
    () => {
      if (activeRetryPass === pass) {
        activeRetryPass = null;
      }
    },
    () => {
      if (activeRetryPass === pass) {
        activeRetryPass = null;
      }
    },
  );

  return pass;
}
