import { useSyncExternalStore } from 'react';
import { RESET_LAYOUT_EVENT } from './useDragOffset';

export type NewTabElementId = 'title' | 'search' | 'links' | 'clock' | 'quote';
export type ClockStyle = 'cube' | 'big';

export const NEW_TAB_ELEMENTS: NewTabElementId[] = ['title', 'search', 'links', 'clock', 'quote'];

interface NewTabElementsState {
  hidden: NewTabElementId[];
  clockStyle: ClockStyle;
}

const STORAGE_KEY = 'freedom_newtab_elements';
const DEFAULT_STATE: NewTabElementsState = { hidden: [], clockStyle: 'cube' };

const read = (): NewTabElementsState => {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!v) return DEFAULT_STATE;
    return {
      hidden: Array.isArray(v.hidden) ? NEW_TAB_ELEMENTS.filter((id) => v.hidden.includes(id)) : [],
      clockStyle: v.clockStyle === 'big' ? 'big' : 'cube',
    };
  } catch {
    return DEFAULT_STATE;
  }
};

// One store for every New Tab page (split view shows several) and the layout edit bar
let state = read();
const listeners = new Set<() => void>();

const commit = (next: NewTabElementsState) => {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const setElementVisible = (id: NewTabElementId, visible: boolean) => {
  const hidden = state.hidden.filter((h) => h !== id);
  commit({ ...state, hidden: visible ? hidden : [...hidden, id] });
};

// Picking a clock style also brings the clock back if it was removed
const setClockStyle = (clockStyle: ClockStyle) => {
  commit({ hidden: state.hidden.filter((h) => h !== 'clock'), clockStyle });
};

window.addEventListener(RESET_LAYOUT_EVENT, () => commit(DEFAULT_STATE));

/** Which New Tab elements are shown and how the clock looks (layout edit mode changes them). */
export function useNewTabElements() {
  const current = useSyncExternalStore(subscribe, () => state);
  return {
    clockStyle: current.clockStyle,
    isVisible: (id: NewTabElementId) => !current.hidden.includes(id),
    setElementVisible,
    setClockStyle,
  };
}
