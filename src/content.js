// Chee - Chess Eval Chart Extension
// Entry point: bootstrap only — loads settings, creates modules, starts the coordinator.

import createDebug, { getLogBuffer } from './lib/debug.js';
import pollUntil from './lib/poll.js';
import { loadSettings } from './lib/settings.js';
import { createAdapter } from './adapters/factory.js';
import { Engine } from './core/engine.js';
import { Panel } from './core/panel.js';
import { BoardState } from './core/board-state.js';
import { AnalysisCoordinator } from './core/coordinator.js';
import { POLL_INTERVAL_MS, BOARD_TIMEOUT_MS, SETTINGS_DEFAULTS } from './constants.js';

const log = createDebug('chee:content');

(async function main() {
  log.info('Content script loaded on', window.location.href);

  const settings = await loadSettings();
  if (settings.debugMode) { localStorage.debug = 'chee:*'; } // eslint-disable-line no-restricted-globals
  log.info('settings:', JSON.stringify(settings));

  const adapter = createAdapter();
  const engine = new Engine();
  const panel = new Panel();
  const boardState = new BoardState();

  const coordinator = new AnalysisCoordinator({
    engine, panel, adapter, settings, boardState,
  });

  window.addEventListener('unload', () => coordinator.destroy());

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    const update = {};
    for (const key of Object.keys(changes)) {
      if (key in SETTINGS_DEFAULTS) update[key] = changes[key].newValue;
    }
    if (Object.keys(update).length) coordinator.applySettings(update);
  });

  log.info('init() called, searching for board...');
  let boardEl;
  try {
    boardEl = await pollUntil(() => adapter.findBoard(), POLL_INTERVAL_MS, BOARD_TIMEOUT_MS);
  } catch (err) {
    log.error(err.message);
    return;
  }

  coordinator.start(boardEl);

  // Alt+C toggles panel visibility
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.code === 'KeyC' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      panel.toggleHidden();
    }
  });

  // Debug info message handler — responds to popup's diagnostic request
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'chee:debug-info') return false;
    sendResponse({
      url: window.location.href,
      adapter: adapter.constructor.name,
      engineState: engine.state,
      engineFen: engine.currentFen,
      boardFound: !!boardEl,
      ply: boardState.ply,
      turn: boardState.turn,
      logs: getLogBuffer(),
    });
    return true;
  });
}());
