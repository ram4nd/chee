import { describe, it, expect } from 'vitest';
import { formatCp, formatScore } from '../../src/lib/format.js';
import { MATE_CP } from '../../src/constants.js';

describe('formatCp', () => {
  it('formats positive centipawns with + prefix', () => {
    expect(formatCp(150)).toBe('+150.0');
  });

  it('formats zero with + prefix', () => {
    expect(formatCp(0)).toBe('+0.0');
  });

  it('formats negative centipawns without extra prefix', () => {
    expect(formatCp(-200)).toBe('-200.0');
  });

  it('formats fractional centipawns to one decimal', () => {
    expect(formatCp(1.55)).toBe('+1.6');
    expect(formatCp(-0.75)).toBe('-0.8');
  });

  it('formats small values', () => {
    expect(formatCp(0.1)).toBe('+0.1');
    expect(formatCp(-0.1)).toBe('-0.1');
  });

  it('formats negative zero as positive', () => {
    expect(formatCp(-0)).toBe('+0.0');
  });
});

describe('formatScore', () => {
  it('formats centipawns in pawns', () => {
    expect(formatScore(-230)).toBe('-2.3');
  });

  it('shows capped mate scores as mate', () => {
    expect(formatScore(MATE_CP)).toBe('M');
    expect(formatScore(-MATE_CP)).toBe('-M');
  });
});
