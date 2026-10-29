// Review panel, embedded in the site's sidebar above the move list:
// eval chart, a summary of the player's mistakes and a clickable list of them.

import { countBy } from 'lodash-es';
import createDebug from '../lib/debug.js';
import { el } from '../lib/dom.js';
import { formatScore } from '../lib/format.js';
import { ChartRenderer } from './renderers/chart-renderer.js';
import {
  PANEL_ID, SEVERITY_THRESHOLDS,
} from '../constants.js';

const log = createDebug('chee:panel');

const TITLE = 'Chee review';
const RETRY_TEXT = 'Retry';
const LOCKED_TEXT = 'Hidden until the game ends';
const NO_MISTAKES_TEXT = 'No mistakes found';
const ANNOUNCE_CLASS = 'chee-announce';
const ANNOUNCE_MS = 2400;

export function summarize(mistakes) {
  if (mistakes.length === 0) return NO_MISTAKES_TEXT;
  const counts = countBy(mistakes, 'severity');
  return SEVERITY_THRESHOLDS
    .filter((t) => counts[t.severity])
    .map((t) => `${counts[t.severity]} ${counts[t.severity] === 1 ? t.severity : t.plural}`)
    .join(', ');
}

export class Panel {
  constructor() {
    this._el = null;
    this._statusEl = null;
    this._toggleEl = null;
    this._retryEl = null;
    this._listEl = null;
    this._chart = new ChartRenderer();
    this.onSeek = null;
  }

  get el() { return this._el; }

  isMounted() {
    return !!this._el && this._el.isConnected;
  }

  mount(beforeEl) {
    document.getElementById(PANEL_ID)?.remove();
    this._chart.onSeek = (ply) => this.onSeek?.(ply);

    this._el = el('div');
    this._el.id = PANEL_ID;

    const header = el('div', 'chee-header');
    this._statusEl = el('span', 'chee-status');
    this._toggleEl = el('button', 'chee-toggle');
    this._toggleEl.addEventListener('click', () => {
      const minimized = !this._el.classList.contains('chee-minimized');
      this._setMinimized(minimized);
      chrome.storage.sync.set({ panelMinimized: minimized })
        .catch((err) => log.warn('could not save panelMinimized:', err.message));
    });
    header.append(el('span', 'chee-title', TITLE), this._statusEl, this._toggleEl);

    const body = el('div', 'chee-body');
    this._listEl = el('ul', 'chee-mistakes');
    body.append(this._chart.createDOM(), this._listEl);

    this._el.append(header, body);
    beforeEl.before(this._el);
  }

  restoreState(minimized) {
    this._setMinimized(minimized);
  }

  // One of: locked, error, or the review itself (null)
  _setState(state, status) {
    this._el.classList.toggle('chee-locked', state === 'locked');
    this._el.classList.toggle('chee-error', state === 'error');
    this._statusEl.textContent = status;
    this._retryEl?.remove();
    this._retryEl = null;
  }

  showLocked() {
    this._setState('locked', LOCKED_TEXT);
    this._listEl.replaceChildren();
    this._chart.render([], 0, 0);
    this._chart.setMarkers([]);
  }

  showProgress(done, total) {
    this._setState(null, `Analysing ${done}/${total}`);
  }

  // A review that cannot be shown; onRetry adds a button to try again
  showError(message, onRetry) {
    this._setState('error', message);
    this._listEl.replaceChildren();
    if (!onRetry) return;
    this._retryEl = el('button', 'chee-retry', RETRY_TEXT);
    this._retryEl.addEventListener('click', onRetry);
    this._toggleEl.before(this._retryEl);
  }

  render({ scores, total, cursor }) {
    this._chart.render(scores, total, cursor);
  }

  showMistakes(mistakes) {
    this._setState(null, summarize(mistakes));
    this._chart.setMarkers(mistakes);
    this._listEl.replaceChildren(...mistakes.map((m) => this._mistakeItem(m)));

    // Draw the eye once when the review is ready
    this._el.classList.add(ANNOUNCE_CLASS);
    setTimeout(() => this._el?.classList.remove(ANNOUNCE_CLASS), ANNOUNCE_MS);
  }

  // Clicking a mistake shows the position before it, so the better move can be found first
  _mistakeItem(m) {
    const item = el('li', `chee-item chee-${m.severity}`);
    item.title = 'Show the position before this move';
    const reveal = el('button', 'chee-best', 'Best move?');
    reveal.title = 'Try to find it on the board first';
    reveal.addEventListener('click', (e) => {
      e.stopPropagation();
      reveal.textContent = m.best ? `Best: ${m.best}` : 'Best: n/a';
      reveal.disabled = true;
    });
    item.append(
      el('span', 'chee-glyph', m.glyph),
      el('span', 'chee-move', `${m.label} ${m.san}`),
      el('span', 'chee-swing', `${formatScore(m.before)} → ${formatScore(m.after)}`),
      reveal,
    );
    item.addEventListener('click', () => this.onSeek?.(m.ply - 1));
    return item;
  }

  _setMinimized(minimized) {
    this._el.classList.toggle('chee-minimized', minimized);
    this._toggleEl.innerHTML = minimized ? '&#x2b;' : '&#x2212;';
    this._toggleEl.title = minimized ? 'Expand' : 'Minimize';
  }

  destroy() {
    this._el?.remove();
    this._el = null;
    this._statusEl = null;
    this._toggleEl = null;
    this._retryEl = null;
    this._listEl = null;
    this._chart.destroy();
  }
}
