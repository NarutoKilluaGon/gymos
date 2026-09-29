/**
 * Pure text parsing for a typed meal description. Nothing here knows
 * about the Food DB, saved foods, or nutrition — it only turns a
 * sentence into segments and a segment into a (name, amount, unit)
 * guess.
 */

/**
 * Split a typed description into candidate food segments on punctuation
 * (never inside decimals like "1.5") and food-list conjunctions
 * ("and"/"with"/"plus" as whole words — "coriander" stays intact).
 * This is the description parser: every segment becomes one review row.
 */
export function splitDescriptionSegments(
  description: string,
): string[] {
  return description
    .split(/[;,+]+|\.\s+|\s+(?:and|with|plus)\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Split a leading quantity from a typed food name — "1.5 tbsp ghee",
 * "200g rice", "2 banana". The unit is only consumed when text follows
 * it, so a unit-less amount keeps the whole remainder as the name.
 * A leading "a"/"an" counts as a portion of one ("a banana").
 * Returns the input unchanged when there is no quantity lead.
 *
 * Exported (it wasn't before the split) so food resolution — which needs
 * name/amount/unit, not raw text — can import it directly.
 */
export function parseLeadingQuantity(text: string): {
  name: string;
  amount?: number;
  unit?: string;
} {
  const single = text.match(/^(a|an)\s+(.+)$/i);

  if (single) {
    return { name: (single[2] ?? "").trim(), amount: 1 };
  }

  const match = text.match(/^([\d.]+)(?:\s*([a-zA-Z]+))?\s+(.+)$/);

  if (!match) {
    return { name: text };
  }

  const amount = Number(match[1]);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { name: text };
  }

  return {
    name: (match[3] ?? "").trim(),
    amount,
    ...(match[2] ? { unit: match[2] } : {}),
  };
}
