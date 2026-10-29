// ─── Chess ────────────────────────────────────────────────────
export const TURN_WHITE = 'w';
export const TURN_BLACK = 'b';

// ─── Timing ──────────────────────────────────────────────────
export const DEBOUNCE_MS = 100;

// ─── Engine resources ────────────────────────────────────────
export const WORKER_FILE = 'stockfish-worker.js';
export const STOCKFISH_JS_FILE = 'stockfish.js';
export const STOCKFISH_WASM_FILE = 'stockfish.wasm';

// ─── Event / message names ───────────────────────────────────
export const EVT_READY = 'ready';
export const EVT_EVAL = 'eval';
export const EVT_ERROR = 'error';

// ─── Worker message types ────────────────────────────────────
export const MSG_SETUP = '__setup';
export const MSG_READY = EVT_READY;
export const MSG_EVAL = EVT_EVAL;
export const MSG_ERROR = EVT_ERROR;
export const MSG_POSITION = 'position';
export const MSG_STOP = 'stop';

// ─── Engine config ───────────────────────────────────────────
export const SEARCH_DEPTH = 15;
// Depths offered in the popup; stored values are snapped to the nearest one
export const SEARCH_DEPTHS = [12, 15, 18, 20];
export const SETTINGS_DEFAULTS = {
  searchDepth: SEARCH_DEPTH,
  theme: 'site',
  panelMinimized: false,
  debugMode: false,
};

// ─── Panel / eval display ────────────────────────────────────
export const PANEL_ID = 'chee-analysis-panel';
export const CENTIPAWN_DIVISOR = 100;
export const MATE_PREFIX = 'M';
export const MATE_NEG_PREFIX = '-M';

// ─── Review ──────────────────────────────────────────────────
// Mate is scored as ±MATE_CP; other scores are capped just below it (like lichess) so only mates reach it
export const MATE_CP = 1000;
export const SEVERITY_INACCURACY = 'inaccuracy';
export const SEVERITY_MISTAKE = 'mistake';
export const SEVERITY_BLUNDER = 'blunder';
// Minimum drop in the mover's winning chances (percentage points) per severity, worst first
export const SEVERITY_THRESHOLDS = [
  {
    severity: SEVERITY_BLUNDER, drop: 30, glyph: '??', plural: 'blunders',
  },
  {
    severity: SEVERITY_MISTAKE, drop: 20, glyph: '?', plural: 'mistakes',
  },
  {
    severity: SEVERITY_INACCURACY, drop: 10, glyph: '?!', plural: 'inaccuracies',
  },
];
