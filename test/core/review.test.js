import { describe, it, expect } from 'vitest';
import {
  buildPositions, whiteCp, winChance, findMistakes, uciToSan, plyLabel,
} from '../../src/core/review.js';
import {
  TURN_WHITE, TURN_BLACK, MATE_CP, SEVERITY_BLUNDER, SEVERITY_MISTAKE, SEVERITY_INACCURACY,
} from '../../src/constants.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('buildPositions', () => {
  it('returns the start position plus one position per move', () => {
    const positions = buildPositions(['e4', 'e5', 'Nf3']);
    expect(positions).toHaveLength(4);
    expect(positions[0].fen).toBe(START);
    expect(positions[1].san).toBe('e4');
    expect(positions[1].turn).toBe(TURN_BLACK);
    expect(positions[3].fen).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2');
  });

  it('stops at the first move it cannot parse', () => {
    expect(buildPositions(['e4', 'Ke5', 'Nf3'])).toHaveLength(2);
  });

  it('scores checkmate without the engine', () => {
    const positions = buildPositions(['f3', 'e5', 'g4', 'Qh4#']);
    expect(positions[4].final).toEqual({ whiteCp: -MATE_CP });
    expect(positions[3].final).toBeNull();
  });

  it('scores stalemate as a draw', () => {
    // Fastest known stalemate
    const moves = 'e3 a5 Qh5 Ra6 Qxa5 h5 h4 Rah6 Qxc7 f6 Qxd7+ Kf7 Qxb7 Qd3 Qxb8 Qh7 Qxc8 Kg6 Qe6'.split(' ');
    const positions = buildPositions(moves);
    expect(positions).toHaveLength(20);
    expect(positions[19].final).toEqual({ whiteCp: 0 });
  });

  it('scores threefold repetition as a draw', () => {
    const positions = buildPositions(['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']);
    expect(positions[8].final).toEqual({ whiteCp: 0 });
  });
});

describe('whiteCp', () => {
  it('flips the score when black is to move', () => {
    expect(whiteCp({ score: 50, mate: null }, TURN_WHITE)).toBe(50);
    expect(whiteCp({ score: 50, mate: null }, TURN_BLACK)).toBe(-50);
  });

  it('keeps large normal scores below the mate score', () => {
    expect(whiteCp({ score: 5000, mate: null }, TURN_WHITE)).toBe(MATE_CP - 1);
    expect(whiteCp({ score: 5000 }, TURN_BLACK)).toBe(-(MATE_CP - 1));
  });

  it('turns a mate score into a large score for the mating side', () => {
    expect(whiteCp({ score: null, mate: 3 }, TURN_BLACK)).toBe(-MATE_CP);
    expect(whiteCp({ score: null, mate: -2 }, TURN_BLACK)).toBe(MATE_CP);
  });
});

describe('winChance', () => {
  it('is 50 at equality and saturates near the ends', () => {
    expect(winChance(0)).toBe(50);
    expect(winChance(MATE_CP)).toBeGreaterThan(97);
    expect(winChance(-MATE_CP)).toBeLessThan(3);
  });
});

describe('plyLabel', () => {
  it('numbers white and black moves', () => {
    expect(plyLabel(1)).toBe('1.');
    expect(plyLabel(2)).toBe('1...');
    expect(plyLabel(27)).toBe('14.');
  });
});

describe('uciToSan', () => {
  it('converts an engine move to SAN', () => {
    expect(uciToSan(START, 'g1f3')).toBe('Nf3');
    expect(uciToSan('8/P7/8/8/8/8/8/k6K w - - 0 1', 'a7a8q')).toBe('a8=Q+');
  });

  it('returns null for an illegal move', () => {
    expect(uciToSan(START, 'e2e5')).toBeNull();
  });
});

describe('findMistakes', () => {
  const positions = buildPositions(['e4', 'e5', 'Qh5', 'Ke7', 'Qxe5#']);
  // White-perspective scores after each ply
  const evals = [
    { whiteCp: 30, bestmove: 'e2e4' },
    { whiteCp: 30, bestmove: 'e7e5' },
    { whiteCp: 25, bestmove: 'g1f3' },
    { whiteCp: -60, bestmove: 'b8c6' },
    { whiteCp: MATE_CP, bestmove: 'h5e5' },
    { whiteCp: MATE_CP, bestmove: null },
  ];

  it('flags only moves by the given colour', () => {
    expect(findMistakes(positions, evals, TURN_WHITE)).toEqual([]);
    const black = findMistakes(positions, evals, TURN_BLACK);
    expect(black).toEqual([{
      ply: 4, label: '2...', san: 'Ke7', severity: SEVERITY_BLUNDER, glyph: '??', before: -60, after: MATE_CP, best: 'Nc6',
    }]);
  });

  it('grades by the drop in winning chances', () => {
    const p = buildPositions(['e4']);
    const grade = (after) => findMistakes(p, [{ whiteCp: 0, bestmove: 'd2d4' }, { whiteCp: after }], TURN_WHITE)[0]?.severity;
    expect(grade(-30)).toBeUndefined();
    expect(grade(-120)).toBe(SEVERITY_INACCURACY);
    expect(grade(-250)).toBe(SEVERITY_MISTAKE);
    expect(grade(-500)).toBe(SEVERITY_BLUNDER);
  });

  it('does not grade a move when the engine move cannot be read', () => {
    const p = buildPositions(['e4']);
    expect(findMistakes(p, [{ whiteCp: 0, bestmove: 'e2e5' }, { whiteCp: -500 }], TURN_WHITE)).toEqual([]);
  });

  it('grades at the exact thresholds', () => {
    const p = buildPositions(['e4']);
    // Just either side of the 30-point blunder line
    const grade = (after) => findMistakes(p, [{ whiteCp: 0, bestmove: 'd2d4' }, { whiteCp: after }], TURN_WHITE)[0]?.severity;
    expect(grade(-370)).toBe(SEVERITY_MISTAKE);
    expect(grade(-380)).toBe(SEVERITY_BLUNDER);
  });

  it('skips plies that are not analysed yet and moves equal to the best move', () => {
    const p = buildPositions(['e4']);
    expect(findMistakes(p, [{ whiteCp: 0, bestmove: 'd2d4' }, undefined], TURN_WHITE)).toEqual([]);
    expect(findMistakes(p, [{ whiteCp: 0, bestmove: 'e2e4' }, { whiteCp: -500 }], TURN_WHITE)).toEqual([]);
  });
});
