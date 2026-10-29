---
name: plan
description: Plan a feature implementation for the Chee Chrome extension
disable-model-invocation: true
argument-hint: "<feature-description>"
---

Plan the implementation of: $ARGUMENTS

## Step 1: Assess Scope

Before exploring code, determine if this even needs a plan:
- **Pure CSS/UI change** (font sizes, colors, layout) → skip exploration, just list files and changes
- **Simple toggle/setting** → add to popup.html + `SETTINGS_DEFAULTS` in constants.js, done
- **Design question** ("should I...?") → give a recommendation with tradeoffs, don't plan
- **Bug report** → diagnose first, plan only if fix is non-trivial
- **Multi-file feature** → proceed to Step 2

## Step 2: Explore Existing Code

Use the Agent tool with `subagent_type: "Explore"` to run **parallel** exploration searches:

- **Agent 1**: Search for similar existing functionality, find related modules
- **Agent 2**: Read the specific files that will need changes
- **Agent 3**: Trace how the change flows through the coordinator

Understand the data flow: MutationObserver on the page → `ReviewCoordinator.sync()` → adapter reads moves and game-over state → `review.js` replays moves → engine analyses each position → `findMistakes()` → panel and move-list glyphs.

## Step 3: Determine Architecture Approach

### Fair-play gate first
Anything that shows engine output must stay behind the game-over lock in `ReviewCoordinator.sync()`. Nothing may run or display analysis during a live game; locking calls `engine.shutdown()`.

### Adapter change?
chess.com DOM reading (moves, result row, orientation, jumping to a ply, mount point, move-list marks) → `adapters/chesscom.js`. Check the live DOM in the browser first; selectors are documented in CLAUDE.md.

### Review logic?
Grading, scoring, replay → `core/review.js`. Keep it pure (chess.js plus math, no DOM or engine) so it stays unit-testable.

### Core module change?
Engine/worker/panel/chart/coordinator → keep module boundaries clean; the coordinator orchestrates only.

### Popup/settings?
Toggle → `data-key` in `popup.html` + default in `constants.js` (auto-wired). Depth choices live in `SEARCH_DEPTHS`; `normalizeSettings()` snaps stored values to them.

### Engine protocol change?
Changes in `static/stockfish-worker.js` + `engine.js`. The worker posts one result per finished search (`{fen, depth, score, mate, bestmove}`) and never for a stopped one; the coordinator matches results by `fen`. Keep both guarantees.

## Step 4: Write the Plan

1. **Files to create/modify** and what changes
2. **Implementation order**: dependencies between steps
3. **Constants/settings**: new constants, storage keys, defaults
4. **Testing**: tests to write first (test-first), edge cases
5. **Performance**: does this add engine work per position, DOM reads per mutation, or redundant redraws?

Keep minimal: only what's needed.

## Step 5: Present for Approval

Use TodoWrite to create a checklist. Present clearly so the user can approve, modify, or reject before implementation.
