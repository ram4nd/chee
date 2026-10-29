// BotCoordinator: in games against chess.com's computer bots, keeps an eval bar beside the board
// and marks the player's bad moves in the move list. Anywhere else (including games against
// people) the engine is not loaded and nothing is shown.

import createDebug, { refreshDebugFlag } from '../lib/debug.js';
import { LruCache } from '../lib/lru.js';
import {
  buildPositions, whiteCp, findMistakes, plyLabel,
} from './review.js';
import {
  DEBOUNCE_MS, TURN_BLACK, EVT_EVAL, EVT_ERROR,
} from '../constants.js';

const log = createDebug('chee:coordinator');

export class BotCoordinator {
  constructor({
    engine, bar, adapter, settings,
  }) {
    this._engine = engine;
    this._bar = bar;
    this._adapter = adapter;
    this._settings = settings;

    this._evalCache = new LruCache(1024);
    this._debounceTimer = null;
    this._engineStarted = false;
    this._movesKey = null;
    this._positions = [];
    this._evals = [];
    this._pending = null; // index of the position being analysed
    this._failed = false; // an error is shown; wait for a retry

    this._engine.on(EVT_EVAL, (data) => this._onEvalData(data));
    this._engine.on(EVT_ERROR, (msg) => this._onEngineError(msg));
  }

  start() {
    this._adapter.observe((mutations) => {
      // The bar's own updates are not page changes
      if (mutations.every((m) => this._bar.el && this._bar.el.contains(m.target))) return;
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this.sync(), DEBOUNCE_MS);
    });
    this.sync();
  }

  destroy() {
    clearTimeout(this._debounceTimer);
    this._adapter.disconnect();
    this._engine.destroy();
    this._bar.destroy();
  }

  applySettings(newSettings) {
    const prevSearchDepth = this._settings.searchDepth;
    Object.assign(this._settings, newSettings);
    log.info('settings changed:', JSON.stringify(newSettings));

    if ('debugMode' in newSettings) { // eslint-disable-line no-restricted-globals
      if (newSettings.debugMode) localStorage.debug = 'chee:*';
      else localStorage.removeItem('debug');
      refreshDebugFlag();
    }

    if (!('searchDepth' in newSettings) || newSettings.searchDepth === prevSearchDepth) return;
    this._engine.setDepth(this._settings.searchDepth);
    this._movesKey = null;
    this.sync();
  }

  sync() {
    // chess.com navigates without reloading, so check the page on every change
    if (!this._adapter.isBotGame()) {
      this._deactivate();
      return;
    }
    if (!this._ensureMounted()) return;

    const moves = this._adapter.readMoves();
    const key = moves.join(' ');
    if (key !== this._movesKey) this._loadGame(moves, key);
    if (!this._failed) this._render();
  }

  _ensureMounted() {
    if (this._bar.isMounted()) return true;
    const slot = this._adapter.getBarSlot();
    if (!slot) return false;
    this._bar.mount(slot);
    return true;
  }

  _deactivate() {
    if (!this._engineStarted && !this._bar.isMounted()) return;
    log.info('not a bot game: engine unloaded');
    this._movesKey = null;
    this._positions = [];
    this._evals = [];
    this._pending = null;
    this._stopEngine();
    this._adapter.markMoves(new Map());
    this._bar.destroy();
  }

  _stopEngine() {
    if (!this._engineStarted) return;
    this._engine.shutdown();
    this._engineStarted = false;
  }

  _loadGame(moves, key) {
    this._movesKey = key;
    this._failed = false;
    this._positions = buildPositions(moves);

    const replayed = this._positions.length - 1;
    if (replayed < moves.length) {
      // Variants or unreadable move text: say so rather than show a wrong eval
      log.warn('could not replay move', replayed + 1, moves[replayed]);
      this._positions = [];
      this._evals = [];
      this._pending = null;
      this._stopEngine();
      this._failed = true;
      this._adapter.markMoves(new Map());
      this._bar.showError(`Can't read move ${plyLabel(replayed + 1)} ${moves[replayed]}`);
      return;
    }

    this._evals = this._positions.map((p) => p.final || this._evalCache.get(this._cacheKey(p.fen)));
    if (!this._engineStarted) {
      this._engineStarted = true;
      this._engine.init(this._settings);
    }
    this._markMistakes();
    this._analyzeNext();
  }

  _cacheKey(fen) {
    return `${fen}|${this._settings.searchDepth}`;
  }

  // Newest position first so the bar keeps up with the game; earlier ones fill in for move grading
  _analyzeNext() {
    const index = this._evals.findLastIndex((e) => !e);
    this._pending = index === -1 ? null : index;
    if (this._pending !== null) this._engine.analyze(this._positions[index].fen);
  }

  _markMistakes() {
    const mistakes = findMistakes(this._positions, this._evals, this._adapter.playerColor());
    this._adapter.markMoves(new Map(mistakes.map((m) => [m.ply, m.glyph])));
  }

  // Shows the displayed position, or the latest known eval before it while that one is analysed
  _render() {
    const ply = Math.min(this._adapter.detectPly(), this._evals.length - 1);
    let known = null;
    for (let i = ply; i >= 0 && known === null; i -= 1) {
      if (this._evals[i]) known = this._evals[i].whiteCp;
    }
    this._bar.show(known, this._adapter.playerColor() === TURN_BLACK);
  }

  _onEvalData(data) {
    if (this._pending === null) return;
    const { fen, turn } = this._positions[this._pending];
    if (data.fen !== fen) return;
    const result = { whiteCp: whiteCp(data, turn), bestmove: data.bestmove };
    this._evalCache.set(this._cacheKey(fen), result);
    this._evals[this._pending] = result;
    this._markMistakes();
    this._render();
    this._analyzeNext();
  }

  // The engine gave up; offer a retry instead of a stale bar
  _onEngineError(msg) {
    log.error('Engine error:', msg);
    this._pending = null;
    this._stopEngine();
    if (!this._bar.isMounted()) return;
    this._failed = true;
    this._bar.showError(`Engine unavailable: ${msg}`, () => {
      this._movesKey = null;
      this.sync();
    });
  }
}
