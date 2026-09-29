export interface SplitViewState {
  enabled: boolean;
  leftTabId: string | null;
  rightTabId: string | null;
  activePane: 'left' | 'right';
  dividerPosition: number; // percentage (20 to 80, default 50)
}

const SPLIT_VIEW_STORAGE_KEY = 'freedom_browser_split_view';

export const DEFAULT_SPLIT_VIEW_STATE: SplitViewState = {
  enabled: false,
  leftTabId: null,
  rightTabId: null,
  activePane: 'left',
  dividerPosition: 50,
};

export class SplitViewService {
  static loadState(): SplitViewState {
    try {
      const stored = localStorage.getItem(SPLIT_VIEW_STORAGE_KEY);
      if (!stored) return DEFAULT_SPLIT_VIEW_STATE;
      const parsed = JSON.parse(stored);
      return {
        enabled: Boolean(parsed.enabled),
        leftTabId: parsed.leftTabId || null,
        rightTabId: parsed.rightTabId || null,
        activePane: parsed.activePane === 'right' ? 'right' : 'left',
        dividerPosition: typeof parsed.dividerPosition === 'number'
          ? Math.max(20, Math.min(80, parsed.dividerPosition))
          : 50,
      };
    } catch {
      return DEFAULT_SPLIT_VIEW_STATE;
    }
  }

  static saveState(state: SplitViewState): void {
    try {
      localStorage.setItem(SPLIT_VIEW_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save SplitViewState to localStorage:', e);
    }
  }

  static validateState(state: SplitViewState, existingTabIds: string[]): SplitViewState {
    if (!state.enabled) return state;

    const leftExists = state.leftTabId && existingTabIds.includes(state.leftTabId);
    const rightExists = state.rightTabId && existingTabIds.includes(state.rightTabId);

    // If either tab no longer exists or they are the same tab, fall back gracefully
    if (!leftExists || !rightExists || state.leftTabId === state.rightTabId) {
      return {
        ...state,
        enabled: false,
        leftTabId: leftExists ? state.leftTabId : (existingTabIds[0] || null),
        rightTabId: null,
      };
    }

    return state;
  }
}
