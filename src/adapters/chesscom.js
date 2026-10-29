// chess.com adapter: bot-game detection, move list, board orientation and the eval bar slot

import { forEach } from 'lodash-es';
import { indexOfNode } from '../lib/dom.js';
import { TURN_WHITE, TURN_BLACK } from '../constants.js';

const SEL_MOVE_NODES = 'wc-simple-move-list .node.main-line-ply';
const SEL_MOVE_CONTENT = '.node-highlight-content';
const SEL_SELECTED_MOVE = 'wc-simple-move-list .node-highlight-content.selected';
const SEL_BOARD = 'wc-chess-board';
// chess.com's own (empty unless assisted) evaluation column left of the board
const SEL_BAR_SLOT = '.board-layout-evaluation';
// Games against chess.com's computer bots
const BOT_PATH = /^\/play\/computer(\/|$)/;
const CLS_FLIPPED = 'flipped';
const ATTR_GLYPH = 'cheeGlyph';

// SAN tokens only: drops annotation icons and whitespace; keeps @ so variant drops fail to replay
const NON_SAN = /[^A-Za-z0-9=+#@-]/g;

// Move text with piece icons (<span data-figurine="N">) turned back into letters
function readSan(content) {
  let san = '';
  forEach(content.childNodes, (child) => {
    san += child.dataset?.figurine || child.textContent;
  });
  return san.replace(NON_SAN, '');
}

export class ChesscomAdapter {
  constructor() {
    this._observer = null;
  }

  _nodes() {
    return document.querySelectorAll(SEL_MOVE_NODES);
  }

  readMoves() {
    return Array.from(this._nodes(), (node) => readSan(node.querySelector(SEL_MOVE_CONTENT) || node));
  }

  isBotGame() {
    return BOT_PATH.test(window.location.pathname);
  }

  // The player sits at the bottom of the board
  playerColor() {
    const board = document.querySelector(SEL_BOARD);
    return board && board.classList.contains(CLS_FLIPPED) ? TURN_BLACK : TURN_WHITE;
  }

  // chess.com highlights the shown move; nothing is highlighted at the start position
  detectPly() {
    const selected = document.querySelector(SEL_SELECTED_MOVE);
    return indexOfNode(this._nodes(), selected ? selected.closest('.node') : null) + 1;
  }

  getBarSlot() {
    return document.querySelector(SEL_BAR_SLOT);
  }

  // Annotates moves through a data attribute (rendered by CSS) so the move text stays untouched
  markMoves(glyphs) {
    forEach(this._nodes(), (node, i) => {
      const glyph = glyphs.get(i + 1);
      if (glyph) node.dataset[ATTR_GLYPH] = glyph;
      else delete node.dataset[ATTR_GLYPH];
    });
  }

  observe(onChange) {
    this.disconnect();
    this._observer = new MutationObserver(onChange);
    this._observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  disconnect() {
    if (this._observer) { this._observer.disconnect(); this._observer = null; }
  }
}
