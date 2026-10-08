import type { PositionCode } from '../types';

/**
 * Default grid coordinates per position, in percent of the pitch area.
 * y = 0 is behind our own goal, y = 100 is the opponent goal.
 * Used when a match record does not carry explicit coordinates.
 */
export const POSITION_COORDS: Record<PositionCode, { x: number; y: number }> = {
  GK: { x: 50, y: 6 },
  RB: { x: 84, y: 24 },
  CB: { x: 61, y: 20 },
  LB: { x: 16, y: 24 },
  DM: { x: 50, y: 38 },
  CM: { x: 32, y: 49 },
  AM: { x: 68, y: 49 },
  RW: { x: 84, y: 68 },
  LW: { x: 16, y: 68 },
  ST: { x: 50, y: 80 },
};

export function coordsFor(position: PositionCode, x?: number, y?: number) {
  const base = POSITION_COORDS[position] ?? POSITION_COORDS.CM;
  return { x: x ?? base.x, y: y ?? base.y };
}
