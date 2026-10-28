// AnalysisCoordinator: mediates between engine, panel, and adapter.
// Owns all orchestration state.

import {
  times, constant, forEach,
} from 'lodash-es';
import createDebug, { refreshDebugFlag } from '../lib/debug.js';
import { LruCache } from '../lib/lru.js';
import { applyTheme } from '../lib/themes.js';
import { boardToFen } from './fen.js';
import {
  BOARD_SIZE, LAST_RANK,
  DEBOUNCE_MS, POLL_INTERVAL_MS,
  MAX_PIECE_ATTEMPTS, NUM_LINES,
  TURN_WHITE, TURN_BLACK,
  EVT_READY, EVT_EVAL, EVT_ERROR,
} from '../constants.js';

const log = createDebug('chee:coordinator');

export class AnalysisCoordinator {
  constructor({
    engine, panel, adapter, settings, boardState,
  }) {
    this._engine = engine;
    this._panel = panel;
    this._adapter = adapter;
    this._settings = settings;
    this._boardState = boardState;

    this._evalCache = new LruCache(1024);
    this._debounceTimer = null;
    this._activeFen = null;
  }

  _cacheKey(fen, depth) {
    return `${fen}|${depth}`;
  }

  _cacheLookup(fen) {
    return this._evalCache.get(this._cacheKey(fen, this._settings.searchDepth)) || null;
  }

  _engineSettings() {
    return { ...this._settings, numLines: NUM_LINES };
  }

  start(boardEl) {
    this._boardState.setBoardEl(boardEl);
    log.info('Board found:', boardEl.tagName, boardEl.id, boardEl.className);

    this._panel.mount(this._adapter.getPanelAnchor(boardEl));
    applyTheme(this._panel.el, this._settings.theme);
    this._panel.restoreState(
      this._settings.panelMinimized,
      this._settings.panelHidden,
      this._settings.panelLeft,
      this._settings.panelTop,
      this._settings.panelWidth,
    );

    this._bindEngineListeners();
    this._engine.init(this._engineSettings());
    this._adapter.observe(boardEl, () => this._onBoardChange());

    const fen = this._readFen();
    log.info('Initial FEN:', fen);
    if (fen) {
      this._activeFen = fen;
      this._engine.analyze(fen);
    } else {
      log.warn('No pieces yet, polling...');
      this._adapter.exploreBoardArea();
      this._waitForPieces();
    }
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

    if (this._activeFen) {
      const cached = this._cacheLookup(this._activeFen);
      if (cached) {
        this._applyEval(cached);
        return;
      }
    }

    this._engine.reconfigure(this._engineSettings());
    if (this._activeFen) this._engine.analyze(this._activeFen);
  }

  _detectTurnFromHighlights(board) {
    const lastMove = this._adapter.detectLastMove(this._boardState.boardEl);
    if (!lastMove) return null;
    const piece = board[LAST_RANK - lastMove.to.rank][lastMove.to.file];
    if (!piece) return null;
    // Uppercase = white piece moved last → black's turn
    return piece === piece.toUpperCase() ? TURN_BLACK : TURN_WHITE;
  }

  _readFen() {
    if (!this._boardState.boardEl) return null;

    const pieces = this._adapter.readPieces(this._boardState.boardEl);
    if (pieces.length === 0) return null;

    const board = times(BOARD_SIZE, () => times(BOARD_SIZE, constant(null)));
    forEach(pieces, (p) => {
      board[LAST_RANK - p.rank][p.file] = p.piece;
    });

    if (this._boardState.boardEquals(board)) return null;

    const diffTurn = this._boardState.detectTurnFromDiff(board);
    const turn = diffTurn || this._detectTurnFromHighlights(board) || this._adapter.detectTurn();
    const castling = this._adapter.detectCastling(board);
    const enPassant = this._adapter.detectEnPassant(board);
    const moveCount = this._adapter.detectMoveCount();

    const fen = boardToFen(board, turn, castling, enPassant, moveCount);
    this._panel.setTurn(turn);
    const ply = this._adapter.detectPly();
    this._boardState.update(board, ply, fen, turn);
    return fen;
  }

  _applyEval(data) {
    this._panel.recordScore(this._boardState.ply, data);
  }

  _onEvalData(data) {
    if (this._engine.currentFen !== this._activeFen) return;
    this._applyEval(data);
    this._evalCache.set(this._cacheKey(this._activeFen, data.depth), data);
  }

  _onBoardChange() {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      const fen = this._readFen();
      if (!fen) return;
      log.info('board change — ply:', this._boardState.ply, 'turn:', this._boardState.turn, 'fen:', fen);
      this._activeFen = fen;

      const cached = this._cacheLookup(fen);
      if (cached) {
        this._engine.stop();
        this._applyEval(cached);
      } else {
        this._engine.analyze(fen);
      }
    }, DEBOUNCE_MS);
  }

  _bindEngineListeners() {
    this._engine.on(EVT_READY, () => {
      log.info('Engine ready');
      // After crash recovery, ensure we're analyzing the current position
      if (this._activeFen && this._engine.currentFen !== this._activeFen) {
        this._engine.analyze(this._activeFen);
      }
    });
    this._engine.on(EVT_EVAL, (data) => this._onEvalData(data));
    this._engine.on(EVT_ERROR, (msg) => { log.error('Engine error:', msg); });
  }

  _waitForPieces() {
    let attempts = 0;
    const pieceInterval = setInterval(() => {
      attempts += 1;

      const alt = this._adapter.findAlternatePieceContainer(this._boardState.boardEl);
      if (alt) {
        this._boardState.setBoardEl(alt);
        this._adapter.observe(alt, () => this._onBoardChange());
      }

      const fen = this._readFen();
      if (fen) {
        log.info('Pieces appeared! FEN:', fen);
        clearInterval(pieceInterval);
        this._activeFen = fen;
        this._engine.analyze(fen);
        return;
      }

      if (attempts > MAX_PIECE_ATTEMPTS) {
        clearInterval(pieceInterval);
        log.error('Gave up waiting for pieces');
      }
    }, POLL_INTERVAL_MS);
  }
}
