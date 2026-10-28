import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { SETTINGS_DEFAULTS } from '../../src/constants.js';

describe('loadSettings', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('calls chrome.storage.sync.get with SETTINGS_DEFAULTS and resolves', async () => {
    const mockGet = vi.fn((defaults, cb) => {
      cb({ ...defaults, searchDepth: 15 });
    });
    vi.stubGlobal('chrome', {
      storage: { sync: { get: mockGet } },
    });

    const { loadSettings } = await import('../../src/lib/settings.js');
    const settings = await loadSettings();

    expect(mockGet).toHaveBeenCalledWith(SETTINGS_DEFAULTS, expect.any(Function));
    expect(settings.searchDepth).toBe(15);
    expect(settings.theme).toBe('site');
  });

  it('resolves with defaults when chrome returns unchanged values', async () => {
    const mockGet = vi.fn((defaults, cb) => { cb(defaults); });
    vi.stubGlobal('chrome', {
      storage: { sync: { get: mockGet } },
    });

    const { loadSettings } = await import('../../src/lib/settings.js');
    const settings = await loadSettings();

    expect(settings.searchDepth).toBe(SETTINGS_DEFAULTS.searchDepth);
  });
});
