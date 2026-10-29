// Chart sub-renderer: SVG area chart of the white-perspective eval at each ply, with mistake markers.

import { forEach, clamp } from 'lodash-es';
import { el, svgEl } from '../../lib/dom.js';
import { formatScore } from '../../lib/format.js';
import { plyLabel } from '../review.js';

const CHART_VB_W = 200;
const CHART_VB_H = 40;
const CHART_MAX_CP = 500;
const START_LABEL = 'Start';

export class ChartRenderer {
  constructor() {
    this._scores = [];
    this._total = 0;
    this._container = null;
    this._chartWhite = null;
    this._cursor = null;
    this._markers = null;
    this._tooltip = null;
    this.onSeek = null;
  }

  createDOM() {
    this._container = el('div', 'chee-chart');
    const svg = svgEl('svg', {
      viewBox: `0 0 ${CHART_VB_W} ${CHART_VB_H}`,
      preserveAspectRatio: 'none',
    });
    // Background (black's territory)
    svg.appendChild(svgEl('rect', { class: 'chee-chart-bg', width: CHART_VB_W, height: CHART_VB_H }));
    // White area path (filled from bottom up to score line)
    this._chartWhite = svgEl('path', { class: 'chee-chart-white', d: '' });
    svg.appendChild(this._chartWhite);
    svg.appendChild(svgEl('line', {
      class: 'chee-chart-zero',
      x1: 0,
      y1: CHART_VB_H / 2,
      x2: CHART_VB_W,
      y2: CHART_VB_H / 2,
    }));
    // Markers and cursor are HTML so they keep their shape when the SVG stretches
    this._cursor = el('div', 'chee-chart-cursor');
    this._markers = el('div', 'chee-chart-markers');
    this._tooltip = el('div', 'chee-chart-tooltip');
    this._container.append(svg, this._cursor, this._markers, this._tooltip);
    this._container.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this._container.addEventListener('mouseleave', () => { this._tooltip.style.display = 'none'; });
    this._container.addEventListener('click', (e) => {
      if (this.onSeek && this._total > 0) this.onSeek(this._plyAt(e));
    });
    return this._container;
  }

  _xPct(ply) {
    return this._total > 1 ? (ply / (this._total - 1)) * 100 : 50;
  }

  _yPct(cp) {
    return 50 - (clamp(cp, -CHART_MAX_CP, CHART_MAX_CP) / CHART_MAX_CP) * 50;
  }

  // scores[ply] = white-perspective centipawns, or undefined while not analysed
  render(scores, total, cursor) {
    this._scores = scores;
    this._total = total;
    const toX = (ply) => (this._xPct(ply) / 100) * CHART_VB_W;
    const toY = (cp) => (this._yPct(cp) / 100) * CHART_VB_H;

    let d = '';
    let lastX = 0;
    forEach(scores, (cp, ply) => {
      if (cp === undefined) return;
      const x = toX(ply);
      d += d ? ` L ${x} ${toY(cp)}` : `M ${x} ${CHART_VB_H} L ${x} ${toY(cp)}`;
      lastX = x;
    });
    this._chartWhite.setAttribute('d', d ? `${d} L ${lastX} ${CHART_VB_H} Z` : '');

    this._cursor.style.display = total > 0 ? 'block' : 'none';
    this._cursor.style.left = `${this._xPct(cursor)}%`;
  }

  // mistakes: [{ ply, severity, after }]
  setMarkers(mistakes) {
    this._markers.replaceChildren(...mistakes.map((m) => {
      const dot = el('div', `chee-chart-marker chee-${m.severity}`);
      dot.style.left = `${this._xPct(m.ply)}%`;
      dot.style.top = `${this._yPct(m.after)}%`;
      return dot;
    }));
  }

  _plyAt(e) {
    const rect = this._container.getBoundingClientRect();
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    return Math.round(ratio * (this._total - 1));
  }

  _onMouseMove(e) {
    if (this._total === 0) return;
    const ply = this._plyAt(e);
    const cp = this._scores[ply];
    const label = ply === 0 ? START_LABEL : plyLabel(ply);
    this._tooltip.textContent = cp === undefined ? label : `${label} ${formatScore(cp)}`;
    this._tooltip.style.left = `${this._xPct(ply)}%`;
    this._tooltip.style.display = 'block';
  }

  destroy() {
    this._scores = [];
    this._total = 0;
    this._container = null;
    this._chartWhite = null;
    this._cursor = null;
    this._markers = null;
    this._tooltip = null;
  }
}
