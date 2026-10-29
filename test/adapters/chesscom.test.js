// @vitest-environment jsdom
import {
  describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import { ChesscomAdapter } from '../../src/adapters/chesscom.js';
import { TURN_WHITE, TURN_BLACK } from '../../src/constants.js';

function node(cls, inner) {
  return `<div class="node ${cls} main-line-ply"><span class="node-highlight-content">${inner}</span></div>`;
}

function render({ selected = -1, flipped = false } = {}) {
  const moves = [
    node('white-move', 'e4 '),
    node('black-move', '<span class="icon-font-chess knight-black" data-figurine="N"></span> c6 '),
    node('white-move', 'e8=<span class="icon-font-chess queen-white" data-figurine="Q"></span>+ '),
  ].map((html, i) => (i === selected ? html.replace('node-highlight-content', 'node-highlight-content selected') : html));
  document.body.innerHTML = `
    <div class="board-layout-chessboard">
      <div class="board-layout-evaluation"><div id="evaluation"></div></div>
      <wc-chess-board class="board${flipped ? ' flipped' : ''}"></wc-chess-board>
    </div>
    <wc-simple-move-list><div class="main-line-row">${moves.join('')}</div></wc-simple-move-list>`;
}

describe('ChesscomAdapter', () => {
  let adapter;
  beforeEach(() => { adapter = new ChesscomAdapter(); });
  afterEach(() => { window.history.replaceState(null, '', '/'); });

  it('is active only on the bot page', () => {
    window.history.replaceState(null, '', '/play/computer');
    expect(adapter.isBotGame()).toBe(true);
    window.history.replaceState(null, '', '/play/computer/discover');
    expect(adapter.isBotGame()).toBe(true);
    window.history.replaceState(null, '', '/play/online');
    expect(adapter.isBotGame()).toBe(false);
    window.history.replaceState(null, '', '/game/live/123');
    expect(adapter.isBotGame()).toBe(false);
    window.history.replaceState(null, '', '/play/computers');
    expect(adapter.isBotGame()).toBe(false);
  });

  it('reads SAN moves, including figurine icons', () => {
    render();
    expect(adapter.readMoves()).toEqual(['e4', 'Nc6', 'e8=Q+']);
  });

  it('reads no moves without a move list', () => {
    document.body.innerHTML = '';
    expect(adapter.readMoves()).toEqual([]);
  });

  it('reads castling and checks, ignores annotation icons and variations', () => {
    document.body.innerHTML = `<wc-simple-move-list>
      ${node('white-move', 'O-O ')}
      ${node('black-move', 'O-O-O<span class="annotation">?!</span> ')}
      ${node('white-move', '<span data-figurine="Q"></span>xe5# ')}
      <div class="node white-move"><span class="node-highlight-content">Nf3</span></div>
    </wc-simple-move-list>`;
    expect(adapter.readMoves()).toEqual(['O-O', 'O-O-O', 'Qxe5#']);
  });

  it('uses the board orientation as the player colour', () => {
    render();
    expect(adapter.playerColor()).toBe(TURN_WHITE);
    render({ flipped: true });
    expect(adapter.playerColor()).toBe(TURN_BLACK);
  });

  it('detects the shown ply from the selected move', () => {
    render({ selected: 1 });
    expect(adapter.detectPly()).toBe(2);
    render(); // nothing selected: the start position is shown
    expect(adapter.detectPly()).toBe(0);
  });

  it('finds the eval bar slot beside the board', () => {
    render();
    expect(adapter.getBarSlot()).toBe(document.querySelector('.board-layout-evaluation'));
    document.body.innerHTML = '';
    expect(adapter.getBarSlot()).toBeNull();
  });

  it('marks moves with glyphs without changing their text', () => {
    render();
    adapter.markMoves(new Map([[2, '??']]));
    const nodes = document.querySelectorAll('.node');
    expect(nodes[1].dataset.cheeGlyph).toBe('??');
    expect(adapter.readMoves()).toEqual(['e4', 'Nc6', 'e8=Q+']);
    adapter.markMoves(new Map([[1, '?!']]));
    expect(nodes[1].dataset.cheeGlyph).toBeUndefined();
    expect(nodes[0].dataset.cheeGlyph).toBe('?!');
  });
});
