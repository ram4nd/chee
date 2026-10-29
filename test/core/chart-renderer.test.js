// @vitest-environment jsdom
import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { ChartRenderer } from '../../src/core/renderers/chart-renderer.js';
import { MATE_CP, SEVERITY_BLUNDER } from '../../src/constants.js';

describe('ChartRenderer', () => {
  let chart;
  let container;

  beforeEach(() => {
    chart = new ChartRenderer();
    container = chart.createDOM();
    container.getBoundingClientRect = () => ({ left: 0, width: 200 });
  });

  const move = (x) => container.dispatchEvent(new MouseEvent('mousemove', { clientX: x }));
  const tooltip = () => container.querySelector('.chee-chart-tooltip');

  it('draws only analysed plies and places the cursor', () => {
    chart.render([30, undefined, -40], 3, 1);
    const d = container.querySelector('.chee-chart-white').getAttribute('d');
    expect(d.match(/L/g)).toHaveLength(3); // up to the first score, across to the second, back down
    expect(container.querySelector('.chee-chart-cursor').style.left).toBe('50%');
  });

  it('keeps the cursor inside the chart', () => {
    chart.render([0, 0], 2, 7);
    expect(container.querySelector('.chee-chart-cursor').style.left).toBe('100%');
  });

  it('labels the start and moves in the tooltip', () => {
    chart.render([30, -120, MATE_CP], 3, 0);
    move(0);
    expect(tooltip().textContent).toBe('Start +0.3');
    move(100);
    expect(tooltip().textContent).toBe('1. -1.2');
    move(200);
    expect(tooltip().textContent).toBe('1... M');
  });

  it('seeks to the clicked ply and ignores clicks on an empty chart', () => {
    chart.onSeek = vi.fn();
    container.dispatchEvent(new MouseEvent('click', { clientX: 150 }));
    expect(chart.onSeek).not.toHaveBeenCalled();
    chart.render([0, 0, 0, 0, 0], 5, 0);
    container.dispatchEvent(new MouseEvent('click', { clientX: 150 }));
    expect(chart.onSeek).toHaveBeenCalledWith(3);
  });

  it('places mistake markers at their ply and score', () => {
    chart.render([0, 0, 0], 3, 0);
    chart.setMarkers([{ ply: 2, severity: SEVERITY_BLUNDER, after: -500 }]);
    const dot = container.querySelector('.chee-chart-marker');
    expect(dot.classList.contains('chee-blunder')).toBe(true);
    expect(dot.style.left).toBe('100%');
    expect(dot.style.top).toBe('100%');
  });
});
