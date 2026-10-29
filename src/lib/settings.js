import { minBy } from 'lodash-es';
import { SETTINGS_DEFAULTS, SEARCH_DEPTHS } from '../constants.js';

// Restores defaults for removed keys and snaps the depth to one the popup offers
export function normalizeSettings(values) {
  const result = { ...values };
  for (const key of Object.keys(result)) {
    if (result[key] === undefined) result[key] = SETTINGS_DEFAULTS[key];
  }
  if ('searchDepth' in result) {
    result.searchDepth = minBy(SEARCH_DEPTHS, (d) => Math.abs(d - result.searchDepth));
  }
  return result;
}

export async function loadSettings() {
  try {
    return normalizeSettings(await chrome.storage.sync.get(SETTINGS_DEFAULTS));
  } catch {
    return { ...SETTINGS_DEFAULTS };
  }
}
