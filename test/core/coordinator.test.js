import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { BotCoordinator } from '../../src/core/coordinator.js';
import { buildPositions } from '../../src/core/review.js';
import {
  TURN_WHITE, TURN_BLACK, EVT_EVAL, EVT_ERROR, MATE_CP,
} from '../../src/constants.js';

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => ''),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal('window', { location: { hostname: 'www.chess.com' } });
});

function makeEngine() {
  const handlers = {};
  return {
    handlers,
    init: vi.fn(),
    analyze: vi.fn(),
    shutdown: vi.fn(),
    setDepth: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn((evt, fn) => { handlers[evt] = fn; }),
  };
}

function makeBar() {
  return {
    mounted: false,
    el: { style: { setProperty: vi.fn() } },
    mount: vi.fn(function mount() { this.mounted = true; }),
    isMounted: vi.fn(function isMounted() { return this.mounted; }),
    show: vi.fn(),
    showError: vi.fn(),
    destroy: vi.fn(function destroy() { this.mounted = false; }),
  };
}

function makeAdapter(moves, { bot = true, color = TURN_WHITE } = {}) {
  return {
    moves,
    bot,
    readMoves: vi.fn(function readMoves() { return this.moves; }),
    isBotGame: vi.fn(function isBotGame() { return this.bot; }),
    playerColor: vi.fn(() => color),
    detectPly: vi.fn(function detectPly() { return this.moves.length; }),
    getBarSlot: vi.fn(() => ({})),
    markMoves: vi.fn(),
    observe: vi.fn(),
    disconnect: vi.fn(),
  };
}

function setup(moves, opts) {
  const engine = makeEngine();
  const bar = makeBar();
  const adapter = makeAdapter(moves, opts);
  const coordinator = new BotCoordinator({
    engine, bar, adapter, settings: { searchDepth: 15 },
  });
  return {
    engine, bar, adapter, coordinator,
  };
}

// Engine reply for the position currently being analysed (score from side to move)
function reply(engine, data) {
  const fen = engine.analyze.mock.calls.at(-1)[0];
  engine.handlers[EVT_EVAL]({
    fen, depth: 15, mate: null, bestmove: null, ...data,
  });
}

const fens = (moves) => buildPositions(moves).map((p) => p.fen);

describe('BotCoordinator', () => {
  it('does nothing outside bot games', () => {
    const { engine, bar, coordinator } = setup(['e4'], { bot: false });
    coordinator.sync();
    expect(engine.init).not.toHaveBeenCalled();
    expect(bar.mount).not.toHaveBeenCalled();
  });

  it('shuts everything down when leaving the bot page', () => {
    const {
      engine, bar, adapter, coordinator,
    } = setup(['e4']);
    coordinator.sync();
    adapter.bot = false;
    coordinator.sync();
    expect(engine.shutdown).toHaveBeenCalled();
    expect(bar.destroy).toHaveBeenCalled();
    expect(adapter.markMoves).toHaveBeenLastCalledWith(new Map());
  });

  it('waits for the board slot before mounting', () => {
    const {
      adapter, bar, engine, coordinator,
    } = setup(['e4']);
    adapter.getBarSlot.mockReturnValue(null);
    coordinator.sync();
    expect(bar.mount).not.toHaveBeenCalled();
    expect(engine.init).not.toHaveBeenCalled();
  });

  it('analyses the current position first, then earlier ones', () => {
    const { engine, coordinator } = setup(['e4', 'e5']);
    coordinator.sync();
    expect(engine.init).toHaveBeenCalledTimes(1);
    const f = fens(['e4', 'e5']);
    expect(engine.analyze).toHaveBeenLastCalledWith(f[2]);
    reply(engine, { score: 20, bestmove: 'g1f3' });
    expect(engine.analyze).toHaveBeenLastCalledWith(f[1]);
    reply(engine, { score: -30, bestmove: 'e7e5' });
    expect(engine.analyze).toHaveBeenLastCalledWith(f[0]);
  });

  it('shows the eval of the displayed position on the bar', () => {
    const { engine, bar, coordinator } = setup(['e4']);
    coordinator.sync();
    expect(bar.show).toHaveBeenLastCalledWith(null, false);
    reply(engine, { score: -30, bestmove: 'e7e5' }); // black to move after e4
    expect(bar.show).toHaveBeenLastCalledWith(30, false);
  });

  it('keeps the last known eval while the next position is analysed', () => {
    const {
      engine, bar, adapter, coordinator,
    } = setup(['e4']);
    coordinator.sync();
    reply(engine, { score: -30, bestmove: 'e7e5' });
    adapter.moves = ['e4', 'e5'];
    coordinator.sync();
    expect(bar.show).toHaveBeenLastCalledWith(30, false);
  });

  it('jumps to a new move as soon as it is played', () => {
    const { engine, adapter, coordinator } = setup(['e4']);
    coordinator.sync();
    adapter.moves = ['e4', 'e5'];
    coordinator.sync();
    expect(engine.analyze).toHaveBeenLastCalledWith(fens(['e4', 'e5'])[2]);
  });

  it('marks the player\'s bad moves as soon as both sides of them are known', () => {
    const { engine, adapter, coordinator } = setup(['e4', 'f6', 'd4', 'g5'], { color: TURN_BLACK });
    coordinator.sync();
    reply(engine, { score: null, mate: 1, bestmove: 'd1h5' }); // after g5, white mates
    reply(engine, { score: -100, bestmove: 'e7e6' }); // after d4
    expect(adapter.markMoves).toHaveBeenLastCalledWith(new Map([[4, '??']]));
  });

  it('flips the bar with the board', () => {
    const { engine, bar, coordinator } = setup(['e4'], { color: TURN_BLACK });
    coordinator.sync();
    reply(engine, { score: -30, bestmove: 'e7e5' });
    expect(bar.show).toHaveBeenLastCalledWith(30, true);
  });

  it('scores a finished game without the engine', () => {
    const { engine, bar, coordinator } = setup(['f3', 'e5', 'g4', 'Qh4#']);
    coordinator.sync();
    expect(bar.show).toHaveBeenLastCalledWith(-MATE_CP, false);
    expect(engine.analyze).toHaveBeenLastCalledWith(fens(['f3', 'e5', 'g4'])[3]);
  });

  it('ignores results for other positions', () => {
    const { engine, coordinator } = setup(['e4']);
    coordinator.sync();
    reply(engine, { score: 30, fen: 'other' });
    expect(engine.analyze).toHaveBeenCalledTimes(1);
  });

  it('does not re-analyse when the moves are unchanged', () => {
    const { engine, coordinator } = setup(['e4']);
    coordinator.sync();
    reply(engine, { score: -30, bestmove: 'e7e5' });
    reply(engine, { score: 30, bestmove: 'e2e4' });
    coordinator.sync();
    expect(engine.analyze).toHaveBeenCalledTimes(2);
  });

  it('shows an error for a game it cannot replay', () => {
    const { engine, bar, coordinator } = setup(['e4', 'N@e5']);
    coordinator.sync();
    expect(engine.analyze).not.toHaveBeenCalled();
    expect(bar.showError).toHaveBeenCalledWith(expect.stringContaining('1... N@e5'));
  });

  it('shows an engine failure and can retry', () => {
    const { engine, bar, coordinator } = setup(['e4']);
    coordinator.sync();
    engine.handlers[EVT_ERROR]('Init failed');
    expect(engine.shutdown).toHaveBeenCalled();
    const [message, retry] = bar.showError.mock.calls.at(-1);
    expect(message).toContain('Init failed');

    retry();
    expect(engine.init).toHaveBeenCalledTimes(2);
    expect(engine.analyze).toHaveBeenCalledTimes(2);
  });

  it('re-analyses at a new depth', () => {
    const { engine, coordinator } = setup(['e4']);
    coordinator.sync();
    reply(engine, { score: -30, bestmove: 'e7e5' });
    reply(engine, { score: 30, bestmove: 'e2e4' });
    coordinator.applySettings({ searchDepth: 18 });
    expect(engine.setDepth).toHaveBeenCalledWith(18);
    expect(engine.analyze).toHaveBeenCalledTimes(3);
  });
});
