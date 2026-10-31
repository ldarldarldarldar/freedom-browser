import { useSyncExternalStore } from 'react';
import { RESET_LAYOUT_EVENT } from './useDragOffset';

export type NewTabElementId = 'title' | 'search' | 'links' | 'clock' | 'quote';
export type ClockStyle = 'cube' | 'big';
/** Everything with its own size: the New Tab elements plus the browser's side menu and address bar */
export type ScalableElementId = NewTabElementId | 'sidebar' | 'toolbar';

export const MIN_ELEMENT_SCALE = 0.5;
export const MAX_ELEMENT_SCALE = 2.5;
const SCALE_STEP = 0.1;

export const NEW_TAB_ELEMENTS: NewTabElementId[] = ['title', 'search', 'links', 'clock', 'quote'];

interface NewTabElementsState {
  hidden: NewTabElementId[];
  clockStyle: ClockStyle;
  scales: Partial<Record<ScalableElementId, number>>;
}

const STORAGE_KEY = 'freedom_newtab_elements';
const DEFAULT_STATE: NewTabElementsState = { hidden: [], clockStyle: 'cube', scales: {} };

const clampScale = (value: number) => Math.round(Math.min(MAX_ELEMENT_SCALE, Math.max(MIN_ELEMENT_SCALE, value)) * 100) / 100;

const readScales = (raw: unknown): NewTabElementsState['scales'] => {
  const scales: NewTabElementsState['scales'] = {};
  if (raw && typeof raw === 'object') {
    for (const [id, value] of Object.entries(raw)) {
      if ([...NEW_TAB_ELEMENTS, 'sidebar', 'toolbar'].includes(id) && typeof value === 'number' && Number.isFinite(value)) {
        scales[id as ScalableElementId] = clampScale(value);
      }
    }
  }
  return scales;
};

const read = (): NewTabElementsState => {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!v) return DEFAULT_STATE;
    return {
      hidden: Array.isArray(v.hidden) ? NEW_TAB_ELEMENTS.filter((id) => v.hidden.includes(id)) : [],
      clockStyle: v.clockStyle === 'big' ? 'big' : 'cube',
      scales: readScales(v.scales),
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
  commit({ ...state, hidden: state.hidden.filter((h) => h !== 'clock'), clockStyle });
};

const setElementScale = (id: ScalableElementId, scale: number) => {
  commit({ ...state, scales: { ...state.scales, [id]: clampScale(scale) } });
};

const stepElementScale = (id: ScalableElementId, direction: 1 | -1) => {
  setElementScale(id, (state.scales[id] ?? 1) + direction * SCALE_STEP);
};

window.addEventListener(RESET_LAYOUT_EVENT, () => commit(DEFAULT_STATE));

/** Which New Tab elements are shown, their sizes and how the clock looks (layout edit mode changes them). */
export function useNewTabElements() {
  const current = useSyncExternalStore(subscribe, () => state);
  return {
    clockStyle: current.clockStyle,
    isVisible: (id: NewTabElementId) => !current.hidden.includes(id),
    setElementVisible,
    setClockStyle,
    getScale: (id: ScalableElementId) => current.scales[id] ?? 1,
    setElementScale,
    stepElementScale,
  };
}
