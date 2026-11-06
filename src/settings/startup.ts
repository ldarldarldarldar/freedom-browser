// What opens at startup, in a new tab and behind the Home button (Settings → Main → Startup).
// Pure functions: `npm run test:settings` covers them.
import type { BrowserSettings } from './types';
import { SearchEngineService } from '../services/searchEngineService';

export const NEW_TAB_URL = 'freedom://newtab';
export const BLANK_URL = 'about:blank';

/**
 * The home page typed in Settings as an address a tab can open, or null when it is not an address.
 * Empty means the Freedom New Tab page.
 */
export function parseHomepage(input: string): string | null {
  const trimmed = (input || '').trim();
  if (!trimmed || trimmed === NEW_TAB_URL) return NEW_TAB_URL;
  if (/^about:blank$/i.test(trimmed)) return BLANK_URL;
  if (!SearchEngineService.isLikelyUrl(trimmed) || trimmed.startsWith('freedom://')) return null;
  const url = SearchEngineService.resolveInputToUrl(trimmed, 'startpage');
  return /^(https?|file):\/\//i.test(url) ? url : null;
}

/** The stored home page, re-checked: a bad value from an old profile falls back to the New Tab page */
export function homepageUrl(settings: Pick<BrowserSettings, 'homepage'>): string {
  return parseHomepage(settings.homepage) ?? NEW_TAB_URL;
}

/** What Ctrl+T, the + button and the menus open */
export function newTabUrl(settings: Pick<BrowserSettings, 'newTabBehavior' | 'homepage'>): string {
  switch (settings.newTabBehavior) {
    case 'blank':
      return BLANK_URL;
    case 'homepage':
      return homepageUrl(settings);
    default:
      return NEW_TAB_URL;
  }
}

/** The single tab opened at startup when no tabs are restored */
export function startupUrl(settings: Pick<BrowserSettings, 'startupBehavior' | 'homepage'>): string {
  return settings.startupBehavior === 'homepage' ? homepageUrl(settings) : NEW_TAB_URL;
}

/** "Open the tabs of the last session": tabs are kept on every close and saved while the browser runs */
export const alwaysKeepsTabs = (settings: Pick<BrowserSettings, 'startupBehavior'>) =>
  settings.startupBehavior === 'restore-session';

/** What closing the window with open tabs does: the startup choice wins over the close setting */
export function closeAction(settings: Pick<BrowserSettings, 'startupBehavior' | 'onCloseWithTabs'>): 'ask' | 'save' | 'discard' {
  return alwaysKeepsTabs(settings) ? 'save' : settings.onCloseWithTabs;
}
