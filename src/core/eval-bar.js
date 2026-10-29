// Vertical eval bar in chess.com's evaluation column beside the board.
// The white share is the winning chance, so small advantages read clearly and mate fills the bar.

import { el } from '../lib/dom.js';
import { formatScore } from '../lib/format.js';
import { winChance } from './review.js';
import { BAR_ID } from '../constants.js';

const PENDING_LABEL = '…';
const RETRY_HINT = 'Click to retry.';

export class EvalBar {
  constructor() {
    this._el = null;
    this._white = null;
    this._label = null;
    this._onRetry = null;
  }

  get el() { return this._el; }

  isMounted() {
    return !!this._el && this._el.isConnected;
  }

  mount(slot) {
    if (this.isMounted()) return;
    document.getElementById(BAR_ID)?.remove();
    this._el = el('div');
    this._el.id = BAR_ID;
    this._white = el('div', 'chee-bar-white');
    this._label = el('span', 'chee-bar-label');
    this._el.append(this._white, this._label);
    this._el.addEventListener('click', () => this._onRetry?.());
    slot.append(this._el);
    this.show(null, false);
  }

  // whiteCp: white's point of view, or null while the first result is pending
  show(whiteCp, flipped) {
    this._setError(null, null);
    this._el.classList.toggle('chee-flipped', flipped);
    this._white.style.height = `${whiteCp === null ? 50 : winChance(whiteCp)}%`;
    this._label.textContent = whiteCp === null ? PENDING_LABEL : formatScore(whiteCp);
    this._el.classList.toggle('chee-black-ahead', whiteCp !== null && whiteCp < 0);
  }

  // A clickable error when onRetry is given
  showError(message, onRetry) {
    this._setError(onRetry ? `${message}. ${RETRY_HINT}` : message, onRetry);
    this._label.textContent = '!';
  }

  _setError(title, onRetry) {
    this._el.classList.toggle('chee-error', !!title);
    this._el.title = title || '';
    this._onRetry = onRetry || null;
  }

  destroy() {
    this._el?.remove();
    this._el = null;
    this._white = null;
    this._label = null;
    this._onRetry = null;
  }
}
