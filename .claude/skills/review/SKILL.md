---
name: review
description: Review code changes for architectural consistency, convention adherence, and logic bugs
disable-model-invocation: true
argument-hint: "[file-or-scope]"
---

Review code changes for the Chee Chrome extension. If `$ARGUMENTS` is provided, focus on those files or scope. Otherwise, review all uncommitted changes.

## Step 1: Gather Changes

- If a file/scope argument is given, read those files
- Otherwise, run `git diff` and `git diff --cached` to see all changes
- Read every changed file in full to understand context

## Step 2: Parallel Architecture & Logic Analysis

Use the Agent tool to launch **parallel** review agents simultaneously:

### Agent 1: Architecture review (`subagent_type: "Explore"`)
- **Fair-play gate**: no engine output and no loaded engine during a live game. The only unlock signal is the chess.com result row; missing DOM must mean locked
- **Adapter**: chess.com DOM logic lives in `adapters/chesscom.js`, not in core
- **Module boundaries**: `review.js` = pure grading logic, `engine.js` + worker = Stockfish only, `panel.js` / `chart-renderer.js` = DOM only, `coordinator.js` = orchestration only
- **Entry points**: `content.js` = content script, `popup.js` = popup UI with `data-key` auto-wiring

### Agent 2: Convention & security review (`subagent_type: "Explore"`)
- ES6 modules with explicit `.js` extensions
- lodash-es named imports (tree-shakeable)
- Constants from `src/constants.js`: no magic numbers or strings
- Private members prefixed with `_`
- Debug logging via `createDebug('chee:namespace')`: no `console.log`, no printf format strings
- Max line length 120 chars
- No XSS vectors (innerHTML with page content), no new eval()
- Tests import constants rather than hardcoding values

### Agent 3: Logic bug analysis (`subagent_type: "Explore"`)
- **DOM timing**: chess.com updates the move-list highlight after the board; the result row can appear before the list finishes rendering
- **Replay**: moves that chess.js cannot replay must refuse the review, never review part of a game
- **Engine state machine**: IDLE/INITIALIZING/READY/ANALYZING/ERROR; `stop()` drops queued positions, `shutdown()` unloads the worker but keeps listeners, only giving up emits `EVT_ERROR`
- **Stale results**: evals are matched by `fen`; stopped searches are never reported by the worker
- **Errors reach the user**: engine failures and unreadable games show a panel error, not an endless "Analysing"
- **Race conditions**: MutationObserver → 100ms debounce → `sync()`. Results arriving after a lock or a move-list change?
- **Memory leaks**: observers, listeners, timers, workers cleaned up?
- **Settings**: `normalizeSettings()` applied to stored and changed values; `localStorage.debug` changes need `refreshDebugFlag()` in the same page

### Agent 4: Performance review (`subagent_type: "Explore"`)
- **Per-mutation work**: `sync()` runs on page mutations; it must stay cheap when nothing changed (moves key compare)
- **Engine work**: re-analysis when the `fen|depth` cache would suffice?
- **Double-render**: chart or list rebuilt more than once per result?
- **Log serialization**: objects passed to `log()` are stored via `String()`; use `JSON.stringify()` or template literals

## Step 3: Synthesize Results

Collect results from all agents and produce a structured review:

1. **Architecture issues**: fair-play gate, module boundaries
2. **Convention issues**: style, imports, constants, naming
3. **Logic bugs**: runtime errors, race conditions, incorrect assumptions
4. **Performance issues**: redundant work, unnecessary redraws, engine waste
5. **Security issues**: if any
6. **Verdict**: LGTM or list of required changes with specific file:line references
