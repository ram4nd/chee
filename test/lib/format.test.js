import { describe, it, expect } from 'vitest';
import { formatScore } from '../../src/lib/format.js';
import { MATE_CP } from '../../src/constants.js';

describe('formatScore', () => {
  it('formats centipawns in pawns with a sign', () => {
    expect(formatScore(150)).toBe('+1.5');
    expect(formatScore(-230)).toBe('-2.3');
  });

  it('rounds to one decimal', () => {
    expect(formatScore(155)).toBe('+1.6');
    expect(formatScore(-75)).toBe('-0.8');
  });

  it('formats zero and negative zero as positive', () => {
    expect(formatScore(0)).toBe('+0.0');
    expect(formatScore(-0)).toBe('+0.0');
  });

  it('shows big scores below mate as numbers', () => {
    expect(formatScore(MATE_CP - 1)).toBe('+10.0');
  });

  it('shows mate scores as mate', () => {
    expect(formatScore(MATE_CP)).toBe('M');
    expect(formatScore(-MATE_CP)).toBe('-M');
  });
});
