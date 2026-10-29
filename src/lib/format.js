// Shared score formatting utilities.

import {
  CENTIPAWN_DIVISOR, MATE_CP, MATE_PREFIX, MATE_NEG_PREFIX,
} from '../constants.js';

export function formatCp(cp) {
  return (cp >= 0 ? '+' : '') + cp.toFixed(1);
}

// White-perspective centipawns (mate capped at ±MATE_CP) → "+1.2" or "M"
export function formatScore(cp) {
  if (Math.abs(cp) >= MATE_CP) return cp > 0 ? MATE_PREFIX : MATE_NEG_PREFIX;
  return formatCp(cp / CENTIPAWN_DIVISOR);
}
