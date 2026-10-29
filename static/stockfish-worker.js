/* eslint-disable no-restricted-globals */
// Stockfish Web Worker (blob-compatible, single-threaded)
// Globals __sfCode and __wasmBinary are injected by the bootstrap before this runs.

// ─── Engine config (overridden by setup message) ────────────
let SEARCH_DEPTH = 22;
const HASH_SIZE_MB = 16;

// ─── UCI tokens ──────────────────────────────────────────────
const UCI_INFO = 'info';
const UCI_BESTMOVE = 'bestmove';
const UCI_READY_OK = 'readyok';
const UCI_OK = 'uciok';
const UCI_SCORE = ' score ';
const UCI_DEPTH = /\bdepth (\d+)/;
const UCI_SCORE_MATE = /score mate (-?\d+)/;
const UCI_SCORE_CP = /score cp (-?\d+)/;

// ─── Message types (must match src/constants.js) ─────────────
const MSG_READY = 'ready';
const MSG_EVAL = 'eval';
const MSG_ERROR = 'error';
const MSG_POSITION = 'position';
const MSG_STOP = 'stop';
const MSG_RECONFIGURE = 'reconfigure';

// ─── State ───────────────────────────────────────────────────
let currentScore = null; // { score, mate } from the latest info line
let currentDepth = 0;
let analyzing = false;
let stopped = false; // search was interrupted, so its result is not worth reporting
let reconfiguring = false;
let isReady = false;
let sfOnMessage = null;
let pendingFen = null;
let activeFen = null;
const realPostMessage = self.postMessage.bind(self);

function sendUCI(cmd) {
  if (sfOnMessage) {
    sfOnMessage({ data: cmd });
  }
}

function parseInfoLine(line) {
  const depthMatch = line.match(UCI_DEPTH);
  if (!depthMatch) return;
  const depth = parseInt(depthMatch[1], 10);

  const mateMatch = line.match(UCI_SCORE_MATE);
  const cpMatch = mateMatch ? null : line.match(UCI_SCORE_CP);
  if (!mateMatch && !cpMatch) return;

  currentDepth = Math.max(currentDepth, depth);
  currentScore = {
    score: cpMatch ? parseInt(cpMatch[1], 10) : null,
    mate: mateMatch ? parseInt(mateMatch[1], 10) : null,
  };
}

let awaitingReady = false; // waiting for readyok before starting new analysis

function startAnalysis(fen) {
  currentScore = null;
  currentDepth = 0;
  analyzing = true;
  stopped = false;
  awaitingReady = false;
  activeFen = fen;

  sendUCI(`position fen ${fen}`);
  sendUCI(`go depth ${SEARCH_DEPTH}`);
}

// After stop+bestmove, sync with isready/readyok before new analysis
function syncBeforeNext() {
  if (pendingFen) {
    awaitingReady = true;
    sendUCI('isready');
  }
}

function onStockfishMessage(line) {
  if (line === UCI_READY_OK) {
    // Initial readyok (bootstrap) or sync readyok (between analyses)
    if (!isReady) {
      isReady = true;
      realPostMessage({ type: MSG_READY });
    }

    reconfiguring = false;
    if (awaitingReady && pendingFen) {
      awaitingReady = false;
      const readyFen = pendingFen;
      pendingFen = null;
      startAnalysis(readyFen);
    }
    return;
  }

  if (line === UCI_OK) {
    return;
  }

  if (line.indexOf(UCI_INFO) === 0 && line.indexOf(UCI_SCORE) !== -1) {
    if (!reconfiguring) parseInfoLine(line);
    return;
  }

  if (line.indexOf(UCI_BESTMOVE) === 0) {
    if (reconfiguring) return;
    analyzing = false;
    // One message per finished search
    if (!stopped && currentScore) {
      realPostMessage({
        type: MSG_EVAL,
        fen: activeFen,
        depth: currentDepth,
        ...currentScore,
        bestmove: line.split(' ')[1] || null,
      });
    } else if (!stopped) {
      realPostMessage({ type: MSG_ERROR, message: `No score for ${activeFen}` });
    }

    // Sync engine state before starting queued analysis
    syncBeforeNext();
  }
}

function sendStop() {
  stopped = true;
  sendUCI('stop');
}

function requestStop() {
  if (analyzing) {
    sendStop();
    // Don't set analyzing = false here — wait for bestmove
  }
}

function analyzePosition(fen) {
  if (!isReady) {
    pendingFen = fen;
    return;
  }
  // If analyzing or waiting for readyok, queue and stop
  if (analyzing || awaitingReady) {
    pendingFen = fen;
    if (analyzing) sendStop();
    return;
  }
  startAnalysis(fen);
}

function stopAnalysis() {
  pendingFen = null;
  requestStop();
}

function bootstrapStockfish() {
  // Apply config from setup message
  if (self.__searchDepth) SEARCH_DEPTH = self.__searchDepth;

  // Override fetch to serve WASM binary from memory
  const origFetch = self.fetch.bind(self);
  self.fetch = (url, opts) => {
    if (typeof url === 'string' && url.indexOf('.wasm') !== -1) {
      return Promise.resolve(new Response(self.__wasmBinary, {
        status: 200,
        headers: { 'Content-Type': 'application/wasm' },
      }));
    }
    return origFetch(url, opts);
  };

  // Override postMessage to intercept Stockfish's string UCI output
  self.postMessage = (data) => {
    if (typeof data === 'string') {
      onStockfishMessage(data);
    } else {
      realPostMessage(data);
    }
  };

  // Clear onmessage so stockfish.js auto-init can set its handler
  self.onmessage = null;

  // Eval stockfish.js — it auto-detects Worker context and initializes
  try {
    (0, eval)(self.__sfCode); // eslint-disable-line no-eval
  } catch (err) {
    realPostMessage({ type: MSG_ERROR, message: `Failed to eval stockfish: ${err.message}` });
    return;
  }

  // Capture stockfish.js's onmessage handler
  sfOnMessage = self.onmessage;

  if (!sfOnMessage) {
    realPostMessage({ type: MSG_ERROR, message: 'stockfish.js did not set onmessage' });
    return;
  }

  // Replace with our dispatcher
  self.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === MSG_POSITION) {
      analyzePosition(msg.fen);
    } else if (msg.type === MSG_STOP) {
      stopAnalysis();
    } else if (msg.type === MSG_RECONFIGURE) {
      reconfiguring = true;
      if (analyzing) sendStop();
      if (msg.searchDepth != null) SEARCH_DEPTH = msg.searchDepth;
      currentScore = null;
      currentDepth = 0;
      analyzing = false;
      awaitingReady = false;
      pendingFen = null;
      activeFen = null;
      sendUCI('isready');
    }
  };

  // Send initial UCI commands
  sendUCI('uci');
  sendUCI(`setoption name Hash value ${HASH_SIZE_MB}`);
  sendUCI('isready');
}

// Immediately bootstrap on eval
bootstrapStockfish();
