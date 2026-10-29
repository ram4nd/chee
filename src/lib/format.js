// Shared score formatting utilities.

import {
  CENTIPAWN_DIVISOR, MATE_CP, MATE_PREFIX, MATE_NEG_PREFIX,
} from '../constants.js';

// White-perspective centipawns → "+1.2", or "M" for mate (only mate reaches ±MATE_CP)
export function formatScore(cp) {
  if (Math.abs(cp) >= MATE_CP) return cp > 0 ? MATE_PREFIX : MATE_NEG_PREFIX;
  const pawns = cp / CENTIPAWN_DIVISOR;
  return (pawns >= 0 ? '+' : '') + pawns.toFixed(1);
}
