import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { AnalysisCoordinator } from '../../src/core/coordinator.js';
import {
  TURN_WHITE,
} from '../../src/constants.js';

// Mock globals needed by coordinator dependencies
beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => ''),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal('window', {
    addEventListener: vi.fn(),
    location: { hostname: 'chess.com' },
  });
  vi.stubGlobal('document', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

function makeEngine() {
  return {
    init: vi.fn(),
    analyze: vi.fn(),
    stop: vi.fn(),
    reconfigure: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
    currentFen: null,
  };
}

function makePanel() {
  return {
    mount: vi.fn(),
    el: { querySelector: vi.fn(), style: { setProperty: vi.fn() } },
    restoreState: vi.fn(),
    setTurn: vi.fn(),
    recordScore: vi.fn(),
    destroy: vi.fn(),
  };
}

function makeAdapter() {
  return {
    findBoard: vi.fn(),
    readPieces: vi.fn(() => []),
    isFlipped: vi.fn(() => false),
    detectTurn: vi.fn(() => TURN_WHITE),
    detectCastling: vi.fn(() => 'KQkq'),
    detectEnPassant: vi.fn(() => '-'),
    detectMoveCount: vi.fn(() => 1),
    detectPly: vi.fn(() => 0),
    detectLastMove: vi.fn(() => null),
    getPanelAnchor: vi.fn(() => ({})),
    observe: vi.fn(),
    disconnect: vi.fn(),
    exploreBoardArea: vi.fn(),
    findAlternatePieceContainer: vi.fn(() => null),
  };
}

function makeBoardState() {
  return {
    board: null,
    ply: 0,
    fen: null,
    turn: null,
    boardEl: null,
    isValid: false,
    setBoardEl: vi.fn(function setBoardEl(el) { this.boardEl = el; }),
    update: vi.fn(function update(board, ply, fen, turn) {
      this.board = board;
      this.ply = ply;
      this.fen = fen;
      this.turn = turn;
    }),
    boardEquals: vi.fn(() => false),
    detectTurnFromDiff: vi.fn(() => null),
  };
}

function createCoordinator(overrides = {}) {
  const engine = makeEngine();
  const panel = makePanel();
  const adapter = makeAdapter();
  const boardState = makeBoardState();
  const settings = {
    searchDepth: 22,
    theme: 'site',
    panelMinimized: false,
    panelHidden: false,
    panelLeft: null,
    panelTop: null,
    panelWidth: null,
    ...overrides,
  };

  const coordinator = new AnalysisCoordinator({
    engine, panel, adapter, settings, boardState,
  });

  return {
    coordinator, engine, panel, adapter, boardState, settings,
  };
}

describe('AnalysisCoordinator', () => {
  const evalData = {
    depth: 22,
    complete: true,
    lines: [{ score: 30, mate: null, pv: ['e2e4'] }],
  };

  function makeBoardEl() {
    return {
      tagName: 'DIV',
      id: 'board',
      className: 'board',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  }

  describe('applySettings', () => {
    it('applies theme to panel', () => {
      const { coordinator, panel } = createCoordinator();
      coordinator.applySettings({ theme: 'mocha' });
      expect(panel.el.style.setProperty).toHaveBeenCalled();
    });

    it('reconfigures engine with a single line when searchDepth changes', () => {
      const { coordinator, engine } = createCoordinator();
      coordinator.applySettings({ searchDepth: 18 });
      expect(engine.reconfigure).toHaveBeenCalledWith(expect.objectContaining({ searchDepth: 18, numLines: 1 }));
    });

    it('does not reconfigure engine for unrelated settings', () => {
      const { coordinator, engine } = createCoordinator();
      coordinator.applySettings({ theme: 'mocha' });
      expect(engine.reconfigure).not.toHaveBeenCalled();
    });

    it('handles debugMode setting', () => {
      const { coordinator } = createCoordinator();
      coordinator.applySettings({ debugMode: true });
      expect(localStorage.debug).toBe('chee:*');

      coordinator.applySettings({ debugMode: false });
      expect(localStorage.removeItem).toHaveBeenCalledWith('debug');
    });

    it('records cached score instead of reconfiguring on cache hit', () => {
      const { coordinator, engine, panel } = createCoordinator();
      coordinator._activeFen = 'testfen';
      coordinator._evalCache.set('testfen|18', evalData);

      coordinator.applySettings({ searchDepth: 18 });

      expect(panel.recordScore).toHaveBeenCalledWith(0, evalData);
      expect(engine.reconfigure).not.toHaveBeenCalled();
    });

    it('re-analyzes after reconfigure when activeFen exists', () => {
      const { coordinator, engine } = createCoordinator();
      coordinator._activeFen = 'testfen';
      coordinator.applySettings({ searchDepth: 18 });
      expect(engine.analyze).toHaveBeenCalledWith('testfen');
    });
  });

  describe('_onEvalData', () => {
    it('records score for the active position', () => {
      const { coordinator, engine, panel } = createCoordinator();
      coordinator._activeFen = 'testfen';
      engine.currentFen = 'testfen';

      coordinator._onEvalData(evalData);

      expect(panel.recordScore).toHaveBeenCalledWith(0, evalData);
      expect(coordinator._cacheLookup('testfen')).toBe(evalData);
    });

    it('ignores evals for a stale position', () => {
      const { coordinator, engine, panel } = createCoordinator();
      coordinator._activeFen = 'newfen';
      engine.currentFen = 'oldfen';

      coordinator._onEvalData(evalData);

      expect(panel.recordScore).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('cleans up everything', () => {
      const {
        coordinator, engine, panel, adapter,
      } = createCoordinator();
      coordinator.destroy();

      expect(adapter.disconnect).toHaveBeenCalled();
      expect(engine.destroy).toHaveBeenCalled();
      expect(panel.destroy).toHaveBeenCalled();
    });
  });

  describe('_cacheKey', () => {
    it('formats as fen|depth', () => {
      const { coordinator } = createCoordinator();
      expect(coordinator._cacheKey('testfen', 22)).toBe('testfen|22');
    });
  });

  describe('_cacheLookup', () => {
    it('returns null when cache is empty', () => {
      const { coordinator } = createCoordinator();
      expect(coordinator._cacheLookup('testfen')).toBeNull();
    });
  });

  describe('start', () => {
    it('mounts panel, initializes engine with a single line, and starts observing', () => {
      const {
        coordinator, engine, panel, adapter, boardState,
      } = createCoordinator();

      adapter.readPieces.mockReturnValue([
        { file: 4, rank: 1, piece: 'P' },
        { file: 4, rank: 6, piece: 'p' },
        { file: 4, rank: 0, piece: 'K' },
        { file: 4, rank: 7, piece: 'k' },
      ]);

      const boardEl = makeBoardEl();
      coordinator.start(boardEl);

      expect(boardState.setBoardEl).toHaveBeenCalledWith(boardEl);
      expect(panel.mount).toHaveBeenCalled();
      expect(panel.setTurn).toHaveBeenCalledWith(TURN_WHITE);
      expect(engine.init).toHaveBeenCalledWith(expect.objectContaining({ numLines: 1 }));
      expect(engine.analyze).toHaveBeenCalled();
      expect(adapter.observe).toHaveBeenCalled();
      coordinator.destroy();
    });

    it('polls for pieces when readPieces returns empty', () => {
      const { coordinator, adapter } = createCoordinator();
      adapter.readPieces.mockReturnValue([]);

      coordinator.start(makeBoardEl());

      expect(adapter.exploreBoardArea).toHaveBeenCalled();
      coordinator.destroy();
    });
  });
});
