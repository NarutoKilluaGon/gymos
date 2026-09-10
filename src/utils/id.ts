/**
 * Generate a unique ID using timestamp + random string.
 * Collision-resistant for single-device use at human typing speed.
 */
export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
