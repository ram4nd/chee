// @vitest-environment jsdom
import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { Panel, summarize } from '../../src/core/panel.js';
import {
  SEVERITY_BLUNDER, SEVERITY_INACCURACY, SEVERITY_MISTAKE,
} from '../../src/constants.js';

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

describe('Panel', () => {
  let panel;
  const mistake = {
    ply: 5, label: '3.', san: 'Bc4', severity: SEVERITY_BLUNDER, glyph: '??', before: 510, after: -680, best: 'Qxe5+',
  };

  beforeEach(() => {
    vi.stubGlobal('chrome', { storage: { sync: { set: vi.fn(() => Promise.resolve()) } } });
    document.body.innerHTML = '<div id="list"></div>';
    panel = new Panel();
    panel.mount(document.getElementById('list'));
    panel.onSeek = vi.fn();
  });

  it('mounts before the given element', () => {
    expect(document.body.firstElementChild).toBe(panel.el);
  });

  it('jumps to the position before a mistake when it is clicked', () => {
    panel.showMistakes([mistake]);
    panel.el.querySelector('.chee-item').click();
    expect(panel.onSeek).toHaveBeenCalledWith(4);
  });

  it('reveals the best move without jumping', () => {
    panel.showMistakes([mistake, { ...mistake, ply: 7, best: null }]);
    const [first, second] = panel.el.querySelectorAll('.chee-best');
    first.click();
    second.click();
    expect(first.textContent).toBe('Best: Qxe5+');
    expect(second.textContent).toBe('Best: n/a');
    expect(panel.onSeek).not.toHaveBeenCalled();
  });

  it('switches between locked and review states', () => {
    panel.showLocked();
    expect(panel.el.classList.contains('chee-locked')).toBe(true);
    panel.showMistakes([]);
    expect(panel.el.classList.contains('chee-locked')).toBe(false);
  });

  it('shows an error with a retry button', () => {
    const retry = vi.fn();
    panel.showError('Engine unavailable', retry);
    expect(panel.el.querySelector('.chee-status').textContent).toBe('Engine unavailable');
    panel.el.querySelector('.chee-retry').click();
    expect(retry).toHaveBeenCalled();
  });

  it('shows an error without retry when none is possible', () => {
    panel.showError('Could not read move 4. Nf3');
    expect(panel.el.querySelector('.chee-retry')).toBeNull();
  });

  it('remembers being minimized', () => {
    panel.el.querySelector('.chee-toggle').click();
    expect(panel.el.classList.contains('chee-minimized')).toBe(true);
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ panelMinimized: true });
  });
});
