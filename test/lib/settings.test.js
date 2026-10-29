import {
  describe, it, expect, vi, beforeEach,
} from 'vitest';
import { SETTINGS_DEFAULTS, SEARCH_DEPTHS } from '../../src/constants.js';

describe('settings', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function load(stored) {
    const get = vi.fn((defaults) => Promise.resolve({ ...defaults, ...stored }));
    vi.stubGlobal('chrome', { storage: { sync: { get } } });
    const mod = await import('../../src/lib/settings.js');
    return { ...mod, get };
  }

  it('reads stored settings over the defaults', async () => {
    const { loadSettings, get } = await load({ searchDepth: 18 });
    const settings = await loadSettings();
    expect(get).toHaveBeenCalledWith(SETTINGS_DEFAULTS);
    expect(settings.searchDepth).toBe(18);
    expect(settings.theme).toBe('site');
  });

  it('moves a depth the popup no longer offers to the nearest one', async () => {
    const { loadSettings } = await load({ searchDepth: 22 });
    expect((await loadSettings()).searchDepth).toBe(20);
    expect(SEARCH_DEPTHS).toContain(20);
  });

  it('falls back to the defaults when storage fails', async () => {
    vi.stubGlobal('chrome', { storage: { sync: { get: () => Promise.reject(new Error('gone')) } } });
    const { loadSettings } = await import('../../src/lib/settings.js');
    expect(await loadSettings()).toEqual(SETTINGS_DEFAULTS);
  });

  it('normalises changed values, restoring defaults for removed keys', async () => {
    const { normalizeSettings } = await load({});
    expect(normalizeSettings({ searchDepth: undefined, theme: undefined })).toEqual({
      searchDepth: SETTINGS_DEFAULTS.searchDepth,
      theme: SETTINGS_DEFAULTS.theme,
    });
    expect(normalizeSettings({ searchDepth: 13 })).toEqual({ searchDepth: 12 });
  });
});
