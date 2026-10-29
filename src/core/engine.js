// Stockfish worker lifecycle (blob URL, messaging)

import createDebug from '../lib/debug.js';
import { Emitter } from '../lib/emitter.js';
import {
  WORKER_FILE, STOCKFISH_JS_FILE, STOCKFISH_WASM_FILE,
  EVT_READY, EVT_EVAL, EVT_ERROR,
  MSG_SETUP, MSG_READY, MSG_EVAL, MSG_ERROR, MSG_POSITION, MSG_STOP,
  SEARCH_DEPTH,
} from '../constants.js';

const log = createDebug('chee:engine');

// ─── State machine ───────────────────────────────────────────
const State = Object.freeze({
  IDLE: 'idle',
  INITIALIZING: 'initializing',
  READY: 'ready',
  ANALYZING: 'analyzing',
  ERROR: 'error',
});

const MAX_RECOVER_ATTEMPTS = 2;

function fetchOk(file) {
  return fetch(chrome.runtime.getURL(file)).then((r) => {
    if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
    return r;
  });
}

export class Engine extends Emitter {
  constructor() {
    super();
    this._worker = null;
    this._depth = SEARCH_DEPTH;
    this._state = State.IDLE;
    this._currentFen = null;
    this._pendingFen = null;
    this._recoverTimer = null;
    this._recoverAttempts = 0;
    this._recoverFen = null;
    this._recovering = false;
  }

  get state() { return this._state; }
  get currentFen() { return this._currentFen; }

  async init(settings = {}) {
    if (settings.searchDepth) this._depth = settings.searchDepth;
    if (this._state !== State.IDLE) return;
    this._state = State.INITIALIZING;
    log.info('fetching resources...');

    try {
      const [workerCode, sfCode, wasmBuf] = await Promise.all([
        fetchOk(WORKER_FILE).then((r) => r.text()),
        fetchOk(STOCKFISH_JS_FILE).then((r) => r.text()),
        fetchOk(STOCKFISH_WASM_FILE).then((r) => r.arrayBuffer()),
      ]);

      log(
        `resources fetched, worker=${workerCode.length}`,
        `sf=${sfCode.length} wasm=${wasmBuf.byteLength}`,
      );

      const bootstrap = [
        'self.addEventListener("message", function __h(e) {',
        `  if (e.data && e.data.type === "${MSG_SETUP}") {`,
        '    self.removeEventListener("message", __h);',
        '    self.__sfCode = e.data.sfCode;',
        '    self.__wasmBinary = e.data.wasmBinary;',
        '    try { (0, eval)(e.data.workerCode); }',
        `    catch(err) { self.postMessage({ type: "${MSG_ERROR}", message: "Worker eval failed: " + err.message }); }`,
        '  }',
        '});',
      ].join('\n');

      const blob = new Blob([bootstrap], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);

      // stockfish.js reads its wasm path from the worker URL hash; the worker serves that file from memory
      this._worker = new Worker(`${blobUrl}#${STOCKFISH_WASM_FILE}`);
      URL.revokeObjectURL(blobUrl);
      log.info('blob worker created');

      this._worker.onmessage = (e) => this._handleMessage(e.data);

      this._worker.onerror = (err) => {
        // Recoverable: only giving up is reported as EVT_ERROR
        log.warn('worker onerror:', err.message, err);
        this._state = State.ERROR;
        this._autoRecover();
      };

      this._worker.postMessage({
        type: MSG_SETUP,
        workerCode,
        sfCode,
        wasmBinary: wasmBuf,
      }, [wasmBuf]);

      log('setup message sent');
    } catch (err) {
      log.error('init failed:', err);
      this._state = State.ERROR;
      this.emit(EVT_ERROR, `Init failed: ${err.message}`);
    }
  }

  analyze(fen) {
    // Still starting, or restarting after a crash: run it once ready
    if (this._state === State.INITIALIZING || this._recovering) {
      this._pendingFen = fen;
      return;
    }
    if (!this._worker) return;

    log('analyzing:', fen);
    this._state = State.ANALYZING;
    this._currentFen = fen;
    this._worker.postMessage({ type: MSG_POSITION, fen, depth: this._depth });
  }

  stop() {
    this._pendingFen = null;
    if (this._worker) {
      this._worker.postMessage({ type: MSG_STOP });
      if (this._state === State.ANALYZING) {
        this._state = State.READY;
      }
    }
  }

  // Applies from the next analyze() call
  setDepth(depth) {
    this._depth = depth;
  }

  // Unloads the worker; listeners stay so init() can start it again
  shutdown() {
    this._recovering = false;
    if (this._recoverTimer) { clearTimeout(this._recoverTimer); this._recoverTimer = null; }
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    this._state = State.IDLE;
    this._currentFen = null;
    this._pendingFen = null;
    this._recoverAttempts = 0;
    this._recoverFen = null;
  }

  destroy() {
    this.shutdown();
    this.removeAllListeners();
  }

  _autoRecover() {
    if (this._recovering) return;
    this._recovering = true;
    // A crash before the engine was ready leaves the position queued rather than current
    const fen = this._currentFen ?? this._pendingFen;

    if (fen === this._recoverFen) {
      this._recoverAttempts += 1;
    } else {
      this._recoverFen = fen;
      this._recoverAttempts = 1;
    }

    if (this._recoverAttempts > MAX_RECOVER_ATTEMPTS) {
      log.error('giving up recovery after', MAX_RECOVER_ATTEMPTS, 'attempts for:', fen);
      this.shutdown();
      this._state = State.ERROR;
      this.emit(EVT_ERROR, 'Engine kept crashing');
      return;
    }

    log.warn('auto-recovering (attempt', this._recoverAttempts, 'of', MAX_RECOVER_ATTEMPTS, '), will re-analyze:', fen);
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    this._state = State.IDLE;
    this._currentFen = null;
    this._pendingFen = fen;
    this._recoverTimer = setTimeout(() => {
      this._recoverTimer = null;
      this._recovering = false;
      this.init();
    }, 1000);
  }

  _handleMessage(msg) {
    if (msg.type === MSG_READY) {
      this._state = State.READY;
      log.info('Stockfish ready!');
      this.emit(EVT_READY);
      if (this._pendingFen) {
        const fen = this._pendingFen;
        this._pendingFen = null;
        this.analyze(fen);
      }
    } else if (msg.type === MSG_EVAL) {
      // Results are matched to positions by the caller via msg.fen
      this._state = State.READY;
      this._recoverAttempts = 0;
      this._recoverFen = null;
      this.emit(EVT_EVAL, msg);
    } else if (msg.type === MSG_ERROR) {
      log.error('worker error:', msg.message);
      this._state = State.ERROR;
      this.emit(EVT_ERROR, msg.message);
    }
  }
}
