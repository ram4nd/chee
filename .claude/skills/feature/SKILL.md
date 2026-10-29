---
name: feature
description: Full flow — plan, implement, lint, test, and review a feature for the Chee Chrome extension
disable-model-invocation: true
argument-hint: "<feature-description>"
---

Implement a complete feature for the Chee Chrome extension: $ARGUMENTS

Execute the full flow below. Use the TodoWrite tool to track progress through all phases. Stop and ask if anything is unclear at any step.

---

## Phase 1: Plan (use Agent tools for parallel exploration)

Launch **parallel** Explore agents to investigate the codebase:
- **Agent 1**: Search for similar existing functionality and related modules
- **Agent 2**: Read files that will need changes (adapter, review logic, core, popup)
- **Agent 3**: Trace how the change flows through `ReviewCoordinator`

Then synthesize findings into a plan:
1. Determine the right architectural approach (adapter, review logic, core, popup); anything showing engine output stays behind the game-over lock
2. Write a numbered implementation checklist using TodoWrite
3. **Present the plan and wait for user approval before proceeding**

**Skip exploration** for pure CSS/UI changes, simple toggles, or bug fixes where the cause is obvious.

---

## Phase 2: Implement

After the plan is approved, implement each step:

1. Follow the plan checklist in order
2. Follow all project conventions:
   - ES6 modules with `.js` extensions
   - Constants in `src/constants.js`
   - Private members prefixed with `_`
   - Debug logging via `createDebug('chee:namespace')`
   - No `console.log`, no magic numbers, no magic strings — use named constants from `src/constants.js`
   - Max 120 char lines
   - Tests use named constant imports, not hardcoded values (`MATE_CP` not `1000`)
   - Write or update the test first and watch it fail
3. Keep changes minimal — only what the plan specifies
4. Mark each TodoWrite item done as you complete it
5. **When debugging**: ask the user for clarification — what they see, what they expected, exact reproduction steps — before diving into code. Guessing wastes time.
6. **When fixing a bug**: immediately update `.claude/skills/review/SKILL.md` and `.claude/skills/feature/SKILL.md` with the lesson learned — don't defer to Phase 6. Capture the pitfall while context is fresh.

---

## Phase 3: Validate

Run validation tools in parallel where possible:

1. `npm run lint` — fix any errors
2. `npm test` — fix any failures
3. `npm run build` — verify the build succeeds

---

## Phase 4: Review (use Agent tools for parallel review)

Launch **parallel** review agents on your own changes:
- **Agent 1 (Architecture)**: Fair-play gate intact (no engine loaded or shown during a live game); adapter/review/core boundaries respected
- **Agent 2 (Conventions)**: Check imports, constants, naming, debug logging
- **Agent 3 (Logic bugs)**: Key checklist:
  - DOM timing: chess.com updates the move-list highlight after the board; the list may still be rendering when the result row appears
  - Engine state machine: IDLE/INITIALIZING/READY/ANALYZING/ERROR; `stop()` drops queued work, `shutdown()` unloads the worker
  - Results matched by `fen`; interrupted searches never reported
  - Failures (engine, unreadable games) shown in the panel, never an endless "Analysing"
  - Race conditions: debounce, results arriving after lock or a move-list change
- **Agent 4 (Performance)**: Key checklist:
  - `sync()` stays cheap on page mutations when nothing changed
  - Engine work: re-analysis when the `fen|depth` cache would suffice?
  - Double-render: chart or list rebuilt more than once per result?
  - Log serialization: objects become `[object Object]` in ring buffer; use JSON.stringify or template literals

Fix any issues found. Re-run validation if fixes were needed.

---

## Phase 5: Verify in Browser

**IMPORTANT**: This is a Chrome extension — code changes only take effect after reload.

1. Remind the user: **"Reload the extension in `chrome://extensions` and refresh the chess page to test"**
2. Ask if the feature works correctly in the browser
3. If bugs are found, fix and re-run Phase 3-4

---

## Phase 6: Documentation & Skill Update

### Check if docs need updating
- New module → update `CLAUDE.md` Architecture section
- New setting → update `CLAUDE.md` and README
- New chess.com selector → update `CLAUDE.md` DOM structure section
- New constants → verify documented in relevant section
- **Only update affected docs**

### Learn and improve skills
Most skill updates should already be done (Phase 2 step 6). Final check:
- Any remaining lessons? → Add to `/review` or `/feature` skill
- New architectural pattern? → Add to `/plan` skill
- Chart/CSS rendering issues? → Add to `/review` skill

---

## Phase 7: Commit

After everything passes:

1. Stage the relevant files (including any doc/skill updates)
2. Create a Conventional Commits message (`feat:`, `fix:`, `refactor:`)
3. If the feature touches multiple concerns, suggest split commits
4. **Ask the user before committing**
