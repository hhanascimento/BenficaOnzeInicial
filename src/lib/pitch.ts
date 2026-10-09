/**
 * Pitch coordinate mapping.
 *
 * The source lineups all share one grid: every XI is symmetric about x = 40 and
 * no x exceeds 80 – the goalkeeper stands on x = 40 in all 288 matches – so the
 * positions are given on an 80-unit-wide pitch (80 wide x 100 tall). Stretch
 * that onto the full width of the rendered pitch, otherwise every formation
 * sits squashed into the left of the field.
 */
export const X_SCALE = 100 / 80;

/** Source x -> percentage across the rendered pitch, kept off the very edge. */
export function slotLeft(x: number): number {
  return Math.min(98, Math.max(2, x * X_SCALE));
}
