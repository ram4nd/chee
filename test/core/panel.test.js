import { describe, it, expect } from 'vitest';
import { summarize } from '../../src/core/panel.js';
import { SEVERITY_BLUNDER, SEVERITY_INACCURACY, SEVERITY_MISTAKE } from '../../src/constants.js';

describe('summarize', () => {
  it('counts mistakes worst first with correct plurals', () => {
    const list = [SEVERITY_INACCURACY, SEVERITY_BLUNDER, SEVERITY_INACCURACY, SEVERITY_MISTAKE]
      .map((severity) => ({ severity }));
    expect(summarize(list)).toBe('1 blunder, 1 mistake, 2 inaccuracies');
  });

  it('says so when there are no mistakes', () => {
    expect(summarize([])).toBe('No mistakes found');
  });
});
