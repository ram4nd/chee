// Chee - Chess Review Chart Extension
// Entry point: bootstrap only — loads settings, creates modules, starts the coordinator.

import createDebug, { getLogBuffer } from './lib/debug.js';
import { loadSettings, normalizeSettings } from './lib/settings.js';
import { ChesscomAdapter } from './adapters/chesscom.js';
import { Engine } from './core/engine.js';
import { Panel } from './core/panel.js';
import { ReviewCoordinator } from './core/coordinator.js';
import { SETTINGS_DEFAULTS } from './constants.js';

const log = createDebug('chee:content');

async function main() {
  log.info('Content script loaded on', window.location.href);

  const settings = await loadSettings();
  if (settings.debugMode) { localStorage.debug = 'chee:*'; } // eslint-disable-line no-restricted-globals
  log.info('settings:', JSON.stringify(settings));

  const adapter = new ChesscomAdapter();
  const engine = new Engine();
  const panel = new Panel();
  const coordinator = new ReviewCoordinator({
    engine, panel, adapter, settings,
  });

  // pagehide replaces the deprecated unload; a page kept in the back/forward cache stays alive
  window.addEventListener('pagehide', (e) => { if (!e.persisted) coordinator.destroy(); });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    const update = {};
    for (const key of Object.keys(changes)) {
      if (key in SETTINGS_DEFAULTS) update[key] = changes[key].newValue;
    }
    if (Object.keys(update).length) coordinator.applySettings(normalizeSettings(update));
  });

  coordinator.start();

  // Debug info message handler — responds to popup's diagnostic request
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'chee:debug-info') return false;
    try {
      sendResponse({
        url: window.location.href,
        engineState: engine.state,
        engineFen: engine.currentFen,
        gameOver: adapter.isGameOver(),
        moves: adapter.readMoves().length,
        ply: adapter.detectPly(),
        logs: getLogBuffer(),
      });
    } catch (err) {
      sendResponse({ error: err.message, logs: getLogBuffer() });
    }
    return true;
  });
}

main().catch((err) => log.error('Chee failed to start:', err));
