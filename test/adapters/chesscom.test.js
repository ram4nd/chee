// @vitest-environment jsdom
import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { ChesscomAdapter } from '../../src/adapters/chesscom.js';
import { TURN_WHITE, TURN_BLACK } from '../../src/constants.js';

function node(cls, inner, selected = false) {
  return `<div class="node ${cls} main-line-ply"><span class="node-highlight-content${selected ? ' selected' : ''}">${inner}</span></div>`;
}

function render({ result = '', selected = -1, flipped = false } = {}) {
  const moves = [
    node('white-move', 'e4 '),
    node('black-move', '<span class="icon-font-chess knight-black" data-figurine="N"></span> c6 '),
    node('white-move', 'e8=<span class="icon-font-chess queen-white" data-figurine="Q"></span>+ '),
  ].map((html, i) => (i === selected ? html.replace('node-highlight-content', 'node-highlight-content selected') : html));
  document.body.innerHTML = `
    <wc-chess-board class="board${flipped ? ' flipped' : ''}"></wc-chess-board>
    <div class="sidebar">
      <wc-eco-opening></wc-eco-opening>
      <div class="play-controller-scrollable">
        <wc-simple-move-list>
          <div class="main-line-row">${moves.join('')}</div>
          ${result ? `<div class="main-line-row result-row"><span class="game-result">${result} </span></div>` : ''}
        </wc-simple-move-list>
      </div>
    </div>`;
}

describe('ChesscomAdapter', () => {
  let adapter;
  beforeEach(() => { adapter = new ChesscomAdapter(); });

  it('reads SAN moves, including figurine icons', () => {
    render();
    expect(adapter.readMoves()).toEqual(['e4', 'Nc6', 'e8=Q+']);
  });

  it('reads no moves without a move list', () => {
    document.body.innerHTML = '';
    expect(adapter.readMoves()).toEqual([]);
  });

  it('treats the game as over only when a result is shown', () => {
    render();
    expect(adapter.isGameOver()).toBe(false);
    render({ result: '0-1' });
    expect(adapter.isGameOver()).toBe(true);
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
    render();
    expect(adapter.detectPly()).toBe(3);
  });

  it('jumps to a ply by clicking its move', () => {
    render();
    const click = vi.fn();
    document.querySelectorAll('.node-highlight-content')[1].addEventListener('click', click);
    expect(adapter.jumpToPly(2)).toBe(true);
    expect(click).toHaveBeenCalled();
    expect(adapter.jumpToPly(0)).toBe(false);
  });

  it('mounts the panel above the scrolling move list', () => {
    render();
    expect(adapter.getMountPoint()).toBe(document.querySelector('.play-controller-scrollable'));
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
