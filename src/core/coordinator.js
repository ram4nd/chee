// ReviewCoordinator: once a game is over, analyses every position in the move list that is not
// cached or already decided, draws the eval chart and points out the player's mistakes.
// During a live game the engine is not loaded and no review is shown.

import createDebug, { refreshDebugFlag } from '../lib/debug.js';
import { LruCache } from '../lib/lru.js';
import { applyTheme } from '../lib/themes.js';
import {
  buildPositions, whiteCp, findMistakes, plyLabel,
} from './review.js';
import {
  DEBOUNCE_MS, EVT_EVAL, EVT_ERROR,
} from '../constants.js';

const log = createDebug('chee:coordinator');

export class ReviewCoordinator {
  constructor({
    engine, panel, adapter, settings,
  }) {
    this._engine = engine;
    this._panel = panel;
    this._adapter = adapter;
    this._settings = settings;

    this._evalCache = new LruCache(1024);
    this._debounceTimer = null;
    this._engineStarted = false;
    this._locked = false;
    this._movesKey = null;
    this._positions = [];
    this._evals = [];
    this._pending = null; // index of the position being analysed

    this._panel.onSeek = (ply) => {
      if (!this._adapter.jumpToPly(ply)) log.warn('could not jump to ply', ply);
    };
    this._bindEngineListeners();
  }

  start() {
    this._adapter.observe((mutations) => {
      // Our own panel updates are not page changes
      if (mutations.every((m) => this._panel.el && this._panel.el.contains(m.target))) return;
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this.sync(), DEBOUNCE_MS);
    });
    this.sync();
  }

  destroy() {
    clearTimeout(this._debounceTimer);
    this._adapter.disconnect();
    this._engine.destroy();
    this._panel.destroy();
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

    if (newSettings.theme && this._panel.el) applyTheme(this._panel.el, this._settings.theme);

    if (!('searchDepth' in newSettings) || newSettings.searchDepth === prevSearchDepth) return;
    if (this._engineStarted) this._engine.reconfigure(this._settings);
    this._movesKey = null;
    this.sync();
  }

  sync() {
    const mounted = this._ensureMounted();
    // Lock even without a panel, so the engine never outlives a finished game
    if (!this._adapter.isGameOver()) {
      this._lock();
      return;
    }
    if (!mounted) return;
    this._locked = false;

    const moves = this._adapter.readMoves();
    if (moves.length === 0) return; // move list still rendering
    const key = moves.join(' ');
    if (key !== this._movesKey) this._loadGame(moves, key);
    this._render();
  }

  _ensureMounted() {
    if (this._panel.isMounted()) return true;
    const mountPoint = this._adapter.getMountPoint();
    if (!mountPoint) return false;
    this._panel.mount(mountPoint);
    applyTheme(this._panel.el, this._settings.theme);
    this._panel.restoreState(this._settings.panelMinimized);
    // A fresh panel has to be filled again
    this._locked = false;
    this._movesKey = null;
    return true;
  }

  _lock() {
    if (this._locked) return;
    log.info('game in progress: review hidden');
    this._locked = true;
    this._movesKey = null;
    this._positions = [];
    this._evals = [];
    this._pending = null;
    this._stopEngine();
    this._adapter.markMoves(new Map());
    if (this._panel.isMounted()) this._panel.showLocked();
  }

  _stopEngine() {
    if (!this._engineStarted) return;
    this._engine.shutdown();
    this._engineStarted = false;
  }

  _loadGame(moves, key) {
    log.info('reviewing', moves.length, 'moves');
    this._movesKey = key;
    this._positions = buildPositions(moves);
    this._adapter.markMoves(new Map());

    const replayed = this._positions.length - 1;
    if (replayed < moves.length) {
      // Variants, other start positions or unreadable move text: refuse rather than review part of the game
      log.warn('could not replay move', replayed + 1, moves[replayed]);
      this._positions = [];
      this._evals = [];
      this._pending = null;
      this._stopEngine();
      this._panel.showError(`Can't review this game: could not read move ${plyLabel(replayed + 1)} ${moves[replayed]}`);
      return;
    }

    this._evals = this._positions.map((p) => p.final || this._evalCache.get(this._cacheKey(p.fen)));
    if (!this._engineStarted) {
      this._engineStarted = true;
      this._engine.init(this._settings);
    }
    this._analyzeNext();
  }

  _cacheKey(fen) {
    return `${fen}|${this._settings.searchDepth}`;
  }

  _analyzeNext() {
    const index = this._evals.findIndex((e) => !e);
    if (index === -1) {
      this._pending = null;
      this._finish();
      return;
    }
    this._pending = index;
    this._panel.showProgress(this._evals.filter(Boolean).length, this._positions.length);
    this._engine.analyze(this._positions[index].fen);
  }

  _finish() {
    const mistakes = findMistakes(this._positions, this._evals, this._adapter.playerColor());
    log.info('review done:', mistakes.length, 'mistakes');
    this._adapter.markMoves(new Map(mistakes.map((m) => [m.ply, m.glyph])));
    this._panel.showMistakes(mistakes);
  }

  _render() {
    this._panel.render({
      scores: this._evals.map((e) => (e ? e.whiteCp : undefined)),
      total: this._positions.length,
      cursor: this._adapter.detectPly(),
    });
  }

  _onEvalData(data) {
    if (this._pending === null) return;
    const { fen, turn } = this._positions[this._pending];
    if (data.fen !== fen) return;
    const result = { whiteCp: whiteCp(data, turn), bestmove: data.bestmove };
    this._evalCache.set(this._cacheKey(fen), result);
    this._evals[this._pending] = result;
    this._render();
    this._analyzeNext();
  }

  _bindEngineListeners() {
    // After a crash the engine itself resends the position it was analysing
    this._engine.on(EVT_EVAL, (data) => this._onEvalData(data));
    this._engine.on(EVT_ERROR, (msg) => this._onEngineError(msg));
  }

  // The engine gave up; offer a retry instead of waiting forever
  _onEngineError(msg) {
    log.error('Engine error:', msg);
    this._pending = null;
    this._stopEngine();
    if (!this._panel.isMounted()) return;
    this._panel.showError(`Engine unavailable: ${msg}`, () => {
      this._movesKey = null;
      this.sync();
    });
  }
}
