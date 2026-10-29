// Game review: replay the move list, score positions and grade the player's moves.

import { clamp } from 'lodash-es';
import { Chess } from 'chess.js';
import {
  TURN_BLACK, MATE_CP, SEVERITY_THRESHOLDS,
} from '../constants.js';

// lichess winning-chances curve: centipawns → 0..100
const WIN_CHANCE_SLOPE = 0.00368208;

// Score of a game-ending position, which the engine cannot analyse; null if the game goes on
function finalScore(chess) {
  if (chess.isCheckmate()) return { whiteCp: chess.turn() === TURN_BLACK ? MATE_CP : -MATE_CP };
  if (chess.isStalemate() || chess.isInsufficientMaterial()) return { whiteCp: 0 };
  return null;
}

// Positions after each ply (index 0 = before any move). Stops at the first move it cannot replay.
export function buildPositions(sans, startFen) {
  const chess = new Chess(startFen);
  const snapshot = (san) => ({
    fen: chess.fen(), turn: chess.turn(), san, final: null,
  });
  const positions = [snapshot(null)];
  for (const san of sans) {
    try {
      chess.move(san);
    } catch {
      break;
    }
    positions.push(snapshot(san));
  }
  // Only the last position can end the game
  positions[positions.length - 1].final = finalScore(chess);
  return positions;
}

// Engine score (side to move) → white's point of view, capped at ±MATE_CP
export function whiteCp({ score, mate }, turn) {
  const cp = mate !== null ? Math.sign(mate) * MATE_CP : clamp(score, -MATE_CP, MATE_CP);
  return turn === TURN_BLACK ? -cp : cp;
}

export function winChance(cp) {
  return 50 + 50 * (2 / (1 + Math.exp(-WIN_CHANCE_SLOPE * cp)) - 1);
}

export function plyLabel(ply) {
  const moveNum = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${moveNum}.` : `${moveNum}...`;
}

export function uciToSan(fen, uci) {
  if (!uci) return null;
  try {
    return new Chess(fen).move(uci).san;
  } catch {
    return null;
  }
}

// Moves by `color` that lost enough winning chances. evals[i] = { whiteCp, bestmove } for positions[i].
export function findMistakes(positions, evals, color) {
  const mistakes = [];
  const sign = color === TURN_BLACK ? -1 : 1;
  for (let ply = 1; ply < positions.length; ply += 1) {
    const before = evals[ply - 1];
    const after = evals[ply];
    const moverIsColor = (ply % 2 === 1) === (color !== TURN_BLACK);
    if (moverIsColor && before && after) {
      const drop = winChance(sign * before.whiteCp) - winChance(sign * after.whiteCp);
      const grade = SEVERITY_THRESHOLDS.find((t) => drop >= t.drop);
      const best = grade && uciToSan(positions[ply - 1].fen, before.bestmove);
      if (grade && best !== positions[ply].san) {
        mistakes.push({
          ply,
          label: plyLabel(ply),
          san: positions[ply].san,
          severity: grade.severity,
          glyph: grade.glyph,
          before: before.whiteCp,
          after: after.whiteCp,
          best,
        });
      }
    }
  }
  return mistakes;
}
