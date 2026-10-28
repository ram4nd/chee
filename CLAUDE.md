# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Chee is a Chrome extension (Manifest v3) that provides real-time Stockfish analysis on chess.com and lichess.org. It reads the board DOM, generates a FEN, runs Stockfish via WebAssembly in a Web Worker, and renders an eval chart panel beside the board.

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
- `src/content.js` — injected into chess pages, orchestrates board reading → FEN → engine → chart panel.
- `src/popup.js` — extension popup: theme, search depth, debug toggle, copy debug info. Checkboxes auto-wired via `data-key` attributes to `chrome.storage`.

**Adapter pattern** for multi-site support:
- `adapters/base.js` — abstract `BoardAdapter` interface (findBoard, readPieces, detectTurn, etc.)
- `adapters/chesscom.js` — chess.com: piece classes like `wp`, `br`; square classes like `square-45`
- `adapters/lichess.js` — lichess: chessground DOM, `piece` elements with `translate()` transforms, turn detection via move list (`l4x kwdb` elements)
- `adapters/factory.js` — hostname-based auto-detection, returns the right adapter

**Core modules:**
- `core/engine.js` — Stockfish worker lifecycle (state machine: IDLE→INITIALIZING→READY→ANALYZING), UCI protocol, auto-recovery with max 2 retry attempts per crashing position. Runs with MultiPV 1 (`NUM_LINES`).
- `core/panel.js` — panel DOM (header with hide/minimize, eval chart, resize handle), drag/resize/position tracking
- `core/renderers/chart-renderer.js` — SVG eval chart
- `core/renderers/header-renderer.js` — panel header (drag handle + controls)
- `core/coordinator.js` — mediates between engine, panel, and adapter; eval LRU cache keyed by `fen|depth`; highlight-based turn detection fallback.
- `core/board-state.js` — value object: board array, ply, FEN, turn; diff-based turn detection
- `core/fen.js` — FEN generation

**Shared utilities** (`lib/`):
- `lib/dom.js` — DOM helpers: `el()`, `svgEl()`, `indexOfNode()`
- `lib/emitter.js` — simple event emitter mixin
- `lib/debug.js` — `createDebug('chee:namespace')` wrapper. Always-on ring buffer (`getLogBuffer()`) stores last 200 log entries regardless of debug mode. `refreshDebugFlag()` re-parses `localStorage.debug` for same-tab updates.
- `lib/format.js` — shared eval formatters: `advantageCls()`, `formatMate()`, `formatCp()`
- `lib/lru.js` — LRU cache for eval results
- `lib/themes.js` — Catppuccin theme application
- `lib/settings.js` — Chrome storage load/save
- `lib/poll.js` — `pollUntil()` async polling helper

**Flow:** MutationObserver detects board change → 100ms debounce → adapter reads pieces + turn → FEN built → engine analyzes → chart records the score at the current ply.

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

### DOM-based detection is fragile — prefer board diff

Chess sites update DOM elements (clocks, move lists, highlights) at unpredictable times relative to piece positions. This causes:

- **Turn detection wrong**: `detectTurn()` reads clock/move-list DOM, but these may not have updated when the MutationObserver fires on piece movement. Fix: `detectTurnFromDiff()` in `core/board-state.js` compares previous board array to current — if a white piece arrived, it's black's turn. Falls back to highlight-based detection (check piece color at the `to` square of the last move highlight), then to adapter `detectTurn()` for initial position or large jumps (>4 squares changed).
- **Move count wrong**: Adapter counts all moves in the DOM move list, but during game review the user may be at an earlier position. Fix: find the selected/active move node first, count up to that index. Selector varies by site (chess.com: `.node-highlight-content.selected`; lichess: `kwdb.a1t` / `.tview2 move.active`).

**Rule of thumb for new adapters**: implement `readPieces()`, `isFlipped()`, and `detectPly()` accurately. Turn detection is handled by `BoardState.detectTurnFromDiff()` — adapter-level `detectTurn()` is only a fallback. `detectPly()` sets the chart's x position for each score.

### chess.com DOM structure (as of 2025)

- Move list: `wc-simple-move-list` → `.main-line-row` → `.node.white-move` / `.node.black-move` → `span.node-highlight-content` (`.selected` on active move)
- Clocks: `.clock-component.clock-white` / `.clock-component.clock-black`, active has `.clock-player-turn`
- Highlights: `.highlight.square-XY` (XY = file+rank, 1-indexed)
- Pieces: `.piece` with two-char color+type class (`wp`, `br`) and `square-XY` class

### lichess DOM structure (as of 2025)

- Move list: `l4x kwdb` elements (`.a1t` = active) or `.tview2 move` (`.active` = active)
- Board: `cg-board` inside `.cg-wrap` (`.orientation-black` when flipped)
- Pieces: `piece` elements with color class (`white`/`black`) + type class (`king`, `pawn`, etc.), positioned via `translate(Xpx, Ypx)`
- Highlights: `square.last-move` positioned via `translate()`

### Debug logging

- Use `log()` for verbose trace, `log.info()` for milestones, `log.warn()` for degraded states, `log.error()` for failures
- **Never use printf format strings** (`%s`, `%d`) — the debug library prepends a `[namespace]` tag as the first `console.log` argument, which shifts format strings to position 2 where they print literally. Use comma-separated args with inline objects instead.
- Debug toggle in popup sets `localStorage.debug = 'chee:*'`; Chrome DevTools can filter by level (info/warn/error)

## Eval Chart

SVG area chart plotting white-perspective eval at each ply. White area fills from bottom up to the score line (more white = white winning). Dark background = black's territory. Orange cursor line marks current ply. Scores clamped to ±500cp, mate = ±500. Updates live as engine depth increases, persists through navigation. Hover shows a tooltip with move number and score.

## Theme System

Catppuccin color palette (Latte, Frappé, Macchiato, Mocha) plus a "Match Site" option. Applied via CSS custom properties (`--chee-base`, `--chee-text`, etc.) on the panel element.
