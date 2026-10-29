// @vitest-environment jsdom
import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { EvalBar } from '../../src/core/eval-bar.js';
import { MATE_CP } from '../../src/constants.js';

describe('EvalBar', () => {
  let bar;
  let slot;
  const fill = () => bar.el.querySelector('.chee-bar-white');
  const label = () => bar.el.querySelector('.chee-bar-label');

  beforeEach(() => {
    document.body.innerHTML = '<div class="slot"></div>';
    slot = document.querySelector('.slot');
    bar = new EvalBar();
    bar.mount(slot);
  });

  it('mounts into the slot once', () => {
    expect(bar.isMounted()).toBe(true);
    bar.mount(slot);
    expect(slot.children).toHaveLength(1);
  });

  it('fills white by winning chances and labels the score', () => {
    bar.show(0, false);
    expect(fill().style.height).toBe('50%');
    expect(label().textContent).toBe('+0.0');
    bar.show(MATE_CP, false);
    expect(parseFloat(fill().style.height)).toBeGreaterThan(97);
    expect(label().textContent).toBe('M');
  });

  it('puts white at the top when the board is flipped', () => {
    bar.show(-230, true);
    expect(bar.el.classList.contains('chee-flipped')).toBe(true);
    expect(label().textContent).toBe('-2.3');
  });

  it('shows a pending state before the first result', () => {
    bar.show(null, false);
    expect(label().textContent).toBe('…');
    expect(fill().style.height).toBe('50%');
  });

  it('shows an error and retries on click', () => {
    const retry = vi.fn();
    bar.showError('Engine unavailable', retry);
    expect(bar.el.classList.contains('chee-error')).toBe(true);
    expect(bar.el.title).toBe('Engine unavailable. Click to retry.');
    bar.el.click();
    expect(retry).toHaveBeenCalled();
    bar.show(10, false);
    expect(bar.el.classList.contains('chee-error')).toBe(false);
    bar.el.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('removes itself', () => {
    bar.destroy();
    expect(slot.children).toHaveLength(0);
    expect(bar.isMounted()).toBe(false);
  });
});
