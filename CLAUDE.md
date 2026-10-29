# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Chee is a Chrome extension (Manifest v3) for chess.com game review. Once a game has ended it replays the move list with chess.js, runs Stockfish via WebAssembly in a Web Worker on every position, and shows an eval chart plus the player's mistakes in a panel above the move list. During a live game it shows nothing and does not load the engine, so it is never engine assistance.

## Commands

All commands run cross-platform via bash, zsh, or git-bash. On Windows, use WSL, Git Bash, or any shell that has `node` in PATH—no PowerShell wrapper needed.

```bash
npm run build      # Rollup → dist/ (IIFE bundles: content.js, popup.js + static assets)
npm run watch      # Rollup watch mode
npm run lint       # ESLint check
npm run lint:fix   # ESLint auto-fix
npm run clean      # Remove dist/
```

After building, load `dist/` as an unpacked Chrome extension.

## Releasing

Uses `release-it` with `@release-it/conventional-changelog`. Reads Conventional Commits to auto-generate `CHANGELOG.md` and determine the version bump.

```bash
npm run release          # auto patch/minor/major based on commits (feat: → minor, fix: → patch)
npm run release:minor    # force minor bump
npm run release:major    # force major bump
```

What `npm run release` does:
1. Bumps version in `package.json`
2. Runs `scripts/sync-manifest-version.js` to sync version into `static/manifest.json`
3. Runs `npm run build` to rebuild dist/
4. Updates `CHANGELOG.md` from conventional commits
5. Commits and tags (`v1.x.x`)

## CI/CD

Three GitHub Actions workflows (`.github/workflows/`):

1. **`ci.yml`** — triggered on push to `main` and PRs. Runs ESLint on changed files (with inline PR annotations via `add-matcher`) and Vitest test suite.
2. **`release.yml`** — triggered on `v*` tag push. Creates a GitHub Release with changelog body extracted from `CHANGELOG.md`.
3. **`publish.yml`** — triggered when a GitHub Release is published. Builds, zips, uploads zip to the release, and publishes to Chrome Web Store.

Release flow:
```bash
git push origin main        # push commits
npm run release             # bump, changelog, commit, tag
git push origin main --tags # triggers release.yml → publish.yml
```

GitHub Secrets required: `EXTENSION_ID`, `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET`, `CWS_REFRESH_TOKEN`.

## Git Hooks (lefthook)

Hooks are auto-installed via `postinstall`. Configured in `lefthook.yml`:

- **pre-commit** — ESLint on staged `.js`/`.mjs` files
- **commit-msg** — Conventional Commits validation via commitlint
- **pre-push** — runs `npm test`, skips if tests already passed for current HEAD (`.test-passed` marker)

Line endings are enforced as LF on all platforms via `.gitattributes`.

## Architecture

**Two entry points** bundled by Rollup:
- `src/content.js` — injected into chess.com game pages, starts the review coordinator.
- `src/popup.js` — extension popup: theme, search depth, debug toggle, copy debug info. Checkboxes auto-wired via `data-key` attributes to `chrome.storage`.

**Site adapter:**
- `adapters/chesscom.js` — reads SAN moves from `wc-simple-move-list` (piece icons via `data-figurine`), game over (the `.game-result` row), player colour (board `.flipped`), selected ply, clicks moves to jump, marks moves with `data-chee-glyph`, observes `document.body`.

**Core modules:**
- `core/review.js` — pure logic: `buildPositions()` (chess.js replay, checkmate/stalemate scored without the engine), `whiteCp()`, `winChance()` (lichess curve), `findMistakes()` (inaccuracy/mistake/blunder by drop in winning chances, see `SEVERITY_THRESHOLDS`), `uciToSan()`.
- `core/coordinator.js` — `ReviewCoordinator`: locks the panel while the game is live; after it ends, analyses each position in turn (one at a time), caches results in an LRU keyed by `fen|depth`, then reports the player's mistakes.
- `core/engine.js` — Stockfish worker lifecycle (state machine: IDLE→INITIALIZING→READY→ANALYZING, plus ERROR), worker posts one `{fen, depth, score, mate, bestmove}` per finished search (interrupted searches are not reported); auto-recovery with max 2 retry attempts per crashing position; only giving up emits `EVT_ERROR`. `shutdown()` unloads the worker but keeps listeners so `init()` can start it again.
- `core/panel.js` — panel inserted before the sidebar's move list scroll area: header (status, retry on error, minimize), eval chart, mistake list. Clicking a mistake jumps to the position before it; "Best move?" reveals the engine move.
- `core/renderers/chart-renderer.js` — SVG eval chart with HTML cursor and mistake markers; click to jump to a ply.

**Shared utilities** (`lib/`):
- `lib/dom.js` — DOM helpers: `el()`, `svgEl()`, `indexOfNode()`
- `lib/emitter.js` — simple event emitter mixin
- `lib/debug.js` — `createDebug('chee:namespace')` wrapper. Always-on ring buffer (`getLogBuffer()`) stores last 200 log entries regardless of debug mode. `refreshDebugFlag()` re-parses `localStorage.debug` for same-tab updates.
- `lib/format.js` — `formatCp()`, `formatScore()`
- `lib/lru.js` — LRU cache for eval results
- `lib/themes.js` — Catppuccin theme application
- `lib/settings.js` — Chrome storage load (falls back to defaults) and `normalizeSettings()` (restores defaults for removed keys, snaps depth to `SEARCH_DEPTHS`)

**Flow:** MutationObserver on the page → 100ms debounce → if no result row: lock (engine stopped, marks cleared) → else read moves → positions → analyse missing ones → chart fills in → mistakes listed, chart markers and move-list glyphs added.

## Key Conventions

- **ES6 modules** with explicit `.js` extensions in all imports (ESLint-enforced)
- **lodash-es** for utilities (tree-shakeable named imports)
- **Constants** centralized in `src/constants.js` — always use named constants instead of hardcoded values. This includes chess logic (`TURN_WHITE`/`TURN_BLACK` not `'w'`/`'b'`), display strings (`MATE_PREFIX` not `'M'`), DOM IDs, colors, thresholds, and any value used in more than one place. When adding new functionality, define constants first.
- **Private members** prefixed with `_` (e.g., `this._observer`)
- **Debug logging**: `createDebug('chee:namespace')` — enable with `localStorage.debug = 'chee:*'`
- **No console.log** — ESLint `no-console: 'error'`
- **Max line length**: 120 chars
- **Function call formatting**: when a function call has multiple arguments that don't fit on one line, put each argument on its own line with a trailing comma (ESLint `function-paren-newline` + `function-call-argument-newline`)
- **Import formatting**: multi-item imports must use line breaks inside braces (ESLint `object-curly-newline`). Write `import {\n  a, b, c,\n} from '...'` not `import { a, b, c } from '...'`
- **Commit style**: Conventional Commits (`feat:`, `fix:`, `refactor:`)
- **No co-author** lines in commits
- **Data-driven popup**: checkbox toggles use `data-key` attributes auto-wired to `chrome.storage` — adding a toggle requires only HTML
- **Real-time settings**: `coordinator.applySettings()` applies changes live, no page reload

## Static Assets (not bundled)

`static/stockfish-worker.js`, `stockfish.js`, `stockfish.wasm` are loaded at runtime via `chrome.runtime.getURL()`. Rollup copies them to `dist/` via the copy plugin.

## Common Pitfalls & Fixes

### Never show analysis during a live game

The only unlock signal is chess.com's result row (`wc-simple-move-list .game-result`). Fail closed: no move list or no result means locked. The engine is only loaded while a finished game is being reviewed; locking calls `engine.shutdown()`, so no worker exists during a live game. Games that cannot be replayed from the standard start (variants, unreadable move text) are refused with an error instead of reviewing part of the game. Engine failures show an error with a Retry button.

### chess.com DOM structure (as of 2026)

- Move list: `wc-simple-move-list` → `.main-line-row` → `.node.main-line-ply` (`.white-move` / `.black-move`; variations lack `.main-line-ply`) → `span.node-highlight-content` (`.selected` on active move). Piece letters are icons: `<span data-figurine="N">`.
- Result: `.main-line-row.result-row > .game-result` (`1-0`, `0-1`, `½-½`) once the game ends
- Sidebar scroll area wrapping the move list: `.play-controller-scrollable` (play pages), `.game-tab-scrollable` (finished game pages)
- Board: `wc-chess-board`, `.flipped` when the player is black
- Start position: `button[aria-label="First Move"]` (used to jump to ply 0)

### Debug logging

- Use `log()` for verbose trace, `log.info()` for milestones, `log.warn()` for degraded states, `log.error()` for failures
- **Never use printf format strings** (`%s`, `%d`) — the debug library prepends a `[namespace]` tag as the first `console.log` argument, which shifts format strings to position 2 where they print literally. Use comma-separated args with inline objects instead.
- Debug toggle in popup sets `localStorage.debug = 'chee:*'`; Chrome DevTools can filter by level (info/warn/error)

## Eval Chart

SVG area chart plotting white-perspective eval at each ply. White area fills from bottom up to the score line (more white = white winning). Dark background = black's territory. Orange cursor line marks current ply. Scores are drawn clamped to ±500cp (`CHART_MAX_CP`); mate is stored as ±`MATE_CP` (1000) and other scores are capped at ±999, so only mate shows as "M". Fills in as positions are analysed. Hover shows move number and score; click jumps the board to that ply. Coloured dots mark the player's mistakes.

## Theme System

Catppuccin color palette (Latte, Frappé, Macchiato, Mocha) plus a "Match Site" option (chess.com colours). Applied via CSS custom properties (`--chee-base`, `--chee-text`, etc.) on the panel element.
