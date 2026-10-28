// ─── Chess ────────────────────────────────────────────────────
export const BOARD_SIZE = 8;
export const LAST_RANK = 7; // BOARD_SIZE - 1, used for rank flipping
export const FILES = 'abcdefgh';
export const FEN_NONE = '-'; // FEN placeholder for empty castling/en passant

// Piece characters
export const WHITE_KING = 'K';
export const WHITE_QUEEN = 'Q';
export const WHITE_ROOK = 'R';
export const WHITE_BISHOP = 'B';
export const WHITE_KNIGHT = 'N';
export const WHITE_PAWN = 'P';
export const BLACK_KING = 'k';
export const BLACK_QUEEN = 'q';
export const BLACK_ROOK = 'r';
export const BLACK_BISHOP = 'b';
export const BLACK_KNIGHT = 'n';
export const BLACK_PAWN = 'p';

// Turn
export const TURN_WHITE = 'w';
export const TURN_BLACK = 'b';

// Castling positions (file indices)
export const KING_START_FILE = 4;
export const KINGSIDE_ROOK_FILE = 7;
export const QUEENSIDE_ROOK_FILE = 0;

// Board array row indices (rank 1 = row 7, rank 8 = row 0)
export const WHITE_BACK_ROW = 7;
export const BLACK_BACK_ROW = 0;

// ─── Timing ──────────────────────────────────────────────────
export const DEBOUNCE_MS = 100;
export const POLL_INTERVAL_MS = 500;
export const BOARD_TIMEOUT_MS = 60000;
export const MAX_PIECE_ATTEMPTS = 60;

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
export const MSG_RECONFIGURE = 'reconfigure';

// ─── Engine config ───────────────────────────────────────────
export const SEARCH_DEPTH = 22;
export const SETTINGS_DEFAULTS = {
  searchDepth: SEARCH_DEPTH,
  theme: 'site',
  panelMinimized: false,
  panelHidden: false,
  panelLeft: null,
  panelTop: null,
  panelWidth: null,
  debugMode: false,
};

// ─── Panel / eval display ────────────────────────────────────
export const PANEL_ID = 'chee-analysis-panel';
export const NUM_LINES = 1; // MultiPV: the chart only needs the top line
export const CENTIPAWN_DIVISOR = 100;
export const MATE_PREFIX = 'M';
export const MATE_NEG_PREFIX = '-M';

// ─── DOM exploration limits ──────────────────────────────────
export const MAX_EXPLORE_CHILDREN = 30;
export const MAX_EXPLORE_DEPTH = 3;
export const MAX_EXPLORE_DEPTH_LAYOUT = 4;
export const MAX_LOG_SAMPLES = 3;
export const MAX_ATTR_DISPLAY_LEN = 40;
export const MAX_CLASS_DISPLAY_LEN = 80;
export const MIN_PIECE_CONTAINER_COUNT = 2;

// ─── chess.com square class ──────────────────────────────────
export const SQUARE_PREFIX = 'square-';
export const SQUARE_CLASS_MIN_LEN = 9; // 'square-' (7) + 2 digits
