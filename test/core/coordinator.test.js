import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { ReviewCoordinator } from '../../src/core/coordinator.js';
import { buildPositions } from '../../src/core/review.js';
import {
  TURN_WHITE, TURN_BLACK, EVT_EVAL, EVT_ERROR, SEVERITY_BLUNDER,
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
    stop: vi.fn(),
    shutdown: vi.fn(),
    setDepth: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn((evt, fn) => { handlers[evt] = fn; }),
  };
}

function makePanel() {
  return {
    mounted: false,
    mount: vi.fn(function mount() { this.mounted = true; }),
    isMounted: vi.fn(function isMounted() { return this.mounted; }),
    el: { style: { setProperty: vi.fn() }, contains: vi.fn(() => false) },
    restoreState: vi.fn(),
    showLocked: vi.fn(),
    showProgress: vi.fn(),
    showMistakes: vi.fn(),
    showError: vi.fn(),
    render: vi.fn(),
    destroy: vi.fn(),
  };
}

function makeAdapter(moves, { over = true, color = TURN_WHITE } = {}) {
  return {
    moves,
    over,
    readMoves: vi.fn(function readMoves() { return this.moves; }),
    isGameOver: vi.fn(function isGameOver() { return this.over; }),
    playerColor: vi.fn(() => color),
    detectPly: vi.fn(() => 0),
    getMountPoint: vi.fn(() => ({})),
    jumpToPly: vi.fn(),
    markMoves: vi.fn(),
    observe: vi.fn(),
    disconnect: vi.fn(),
  };
}

function setup(moves, opts) {
  const engine = makeEngine();
  const panel = makePanel();
  const adapter = makeAdapter(moves, opts);
  const coordinator = new ReviewCoordinator({
    engine, panel, adapter, settings: { searchDepth: 15, theme: 'site' },
  });
  return {
    engine, panel, adapter, coordinator,
  };
}

// Engine reply for the position currently being analysed (score from side to move)
function reply(engine, data) {
  const fen = engine.analyze.mock.calls.at(-1)[0];
  engine.handlers[EVT_EVAL]({
    fen, depth: 15, mate: null, bestmove: null, ...data,
  });
}

describe('ReviewCoordinator', () => {
  it('shows nothing and never starts the engine during a live game', () => {
    const { engine, panel, coordinator } = setup(['e4', 'e5'], { over: false });
    coordinator.sync();
    expect(panel.showLocked).toHaveBeenCalled();
    expect(engine.init).not.toHaveBeenCalled();
    expect(engine.analyze).not.toHaveBeenCalled();
  });

  it('waits for the move list before mounting', () => {
    const { adapter, panel, coordinator } = setup([]);
    adapter.getMountPoint.mockReturnValue(null);
    coordinator.sync();
    expect(panel.mount).not.toHaveBeenCalled();
  });

  it('analyses every position in order once the game is over', () => {
    const { engine, coordinator } = setup(['e4', 'e5']);
    coordinator.sync();
    expect(engine.init).toHaveBeenCalledTimes(1);
    const fens = buildPositions(['e4', 'e5']).map((p) => p.fen);
    expect(engine.analyze).toHaveBeenLastCalledWith(fens[0]);
    reply(engine, { score: 30, bestmove: 'e2e4' });
    expect(engine.analyze).toHaveBeenLastCalledWith(fens[1]);
    reply(engine, { score: -30, bestmove: 'e7e5' });
    expect(engine.analyze).toHaveBeenLastCalledWith(fens[2]);
  });

  it('ignores results for other positions', () => {
    const { engine, coordinator } = setup(['e4']);
    coordinator.sync();
    reply(engine, { score: 30, fen: 'other' });
    expect(engine.analyze).toHaveBeenCalledTimes(1);
  });

  it('reports only the player\'s mistakes when analysis finishes', () => {
    const {
      engine, panel, adapter, coordinator,
    } = setup(['e4', 'f6', 'd4', 'g5', 'Qh5#'], { color: TURN_BLACK });
    coordinator.sync();
    reply(engine, { score: 30, bestmove: 'e2e4' }); // start, white to move
    reply(engine, { score: -30, bestmove: 'e7e5' }); // after e4
    reply(engine, { score: 90, bestmove: 'd2d4' }); // after f6
    reply(engine, { score: -100, bestmove: 'e7e6' }); // after d4
    reply(engine, { score: null, mate: 1, bestmove: 'd1h5' }); // after g5: white mates
    expect(engine.analyze).toHaveBeenCalledTimes(5); // the mate position needs no engine

    const mistakes = panel.showMistakes.mock.calls.at(-1)[0];
    expect(mistakes.map((m) => [m.ply, m.san, m.severity, m.best])).toEqual([
      [4, 'g5', SEVERITY_BLUNDER, 'e6'],
    ]);
    expect(adapter.markMoves).toHaveBeenLastCalledWith(new Map([[4, '??']]));
  });

  it('does not re-analyse when the moves are unchanged', () => {
    const { engine, coordinator } = setup(['e4']);
    coordinator.sync();
    reply(engine, { score: 30, bestmove: 'e2e4' });
    reply(engine, { score: -30, bestmove: 'e7e5' });
    coordinator.sync();
    expect(engine.analyze).toHaveBeenCalledTimes(2);
  });

  it('locks again and clears marks when a new game starts', () => {
    const {
      engine, panel, adapter, coordinator,
    } = setup(['e4']);
    coordinator.sync();
    adapter.over = false;
    adapter.moves = [];
    coordinator.sync();
    expect(engine.shutdown).toHaveBeenCalled();
    expect(panel.showLocked).toHaveBeenCalled();
    expect(adapter.markMoves).toHaveBeenLastCalledWith(new Map());
  });

  it('unloads the engine on lock and starts it again for the next review', () => {
    const { engine, adapter, coordinator } = setup(['e4']);
    coordinator.sync();
    adapter.over = false;
    coordinator.sync();
    adapter.over = true;
    coordinator.sync();
    expect(engine.init).toHaveBeenCalledTimes(2);
  });

  it('reuses cached results when the same game is reviewed again', () => {
    const {
      engine, panel, adapter, coordinator,
    } = setup(['e4']);
    coordinator.sync();
    reply(engine, { score: 30, bestmove: 'e2e4' });
    reply(engine, { score: -30, bestmove: 'e7e5' });
    adapter.over = false;
    coordinator.sync();
    adapter.over = true;
    coordinator.sync();
    expect(engine.analyze).toHaveBeenCalledTimes(2);
    expect(panel.showMistakes).toHaveBeenCalledTimes(2);
  });

  it('locks even before the panel can be mounted', () => {
    const { engine, adapter, coordinator } = setup(['e4']);
    coordinator.sync();
    adapter.over = false;
    adapter.getMountPoint.mockReturnValue(null);
    coordinator._panel.mounted = false;
    coordinator.sync();
    expect(engine.shutdown).toHaveBeenCalled();
    expect(adapter.markMoves).toHaveBeenLastCalledWith(new Map());
  });

  it('waits while the finished game\'s move list is still empty', () => {
    const { engine, panel, coordinator } = setup([]);
    coordinator.sync();
    expect(engine.init).not.toHaveBeenCalled();
    expect(panel.showMistakes).not.toHaveBeenCalled();
  });

  it('refuses a game it cannot replay instead of showing a partial review', () => {
    const { engine, panel, coordinator } = setup(['e4', 'N@e5']);
    coordinator.sync();
    expect(engine.init).not.toHaveBeenCalled();
    expect(panel.showError).toHaveBeenCalledWith(expect.stringContaining('1... N@e5'));
    expect(panel.showMistakes).not.toHaveBeenCalled();
  });

  it('shows an engine failure and can retry', () => {
    const { engine, panel, coordinator } = setup(['e4']);
    coordinator.sync();
    engine.handlers[EVT_ERROR]('Init failed');
    expect(engine.shutdown).toHaveBeenCalled();
    const [message, retry] = panel.showError.mock.calls.at(-1);
    expect(message).toContain('Init failed');

    retry();
    expect(engine.init).toHaveBeenCalledTimes(2);
    expect(engine.analyze).toHaveBeenCalledTimes(2);
  });

  it('re-reviews at a new depth', () => {
    const { engine, coordinator } = setup(['e4']);
    coordinator.sync();
    reply(engine, { score: 30, bestmove: 'e2e4' });
    reply(engine, { score: -30, bestmove: 'e7e5' });
    coordinator.applySettings({ searchDepth: 18 });
    expect(engine.setDepth).toHaveBeenCalledWith(18);
    expect(engine.analyze).toHaveBeenCalledTimes(3);
  });

  it('jumps the board when the panel asks to seek', () => {
    const { panel, adapter, coordinator } = setup(['e4']);
    coordinator.sync();
    panel.onSeek(1);
    expect(adapter.jumpToPly).toHaveBeenCalledWith(1);
  });
});
