import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * One panel or pop-up at a time: downloads, bookmarks, history, menus, the tab context menu and so on.
 * Opening one closes the previous one; Esc and a click outside close the current one.
 *
 * A panel's root carries data-panel="<id>", the button that toggles it data-panel-toggle="<id>",
 * so a click on that button toggles instead of closing and reopening.
 */
export type PanelId =
  | 'downloads'
  | 'bookmarks'
  | 'history'
  | 'tabsOverview'
  | 'frc'
  | 'menu'
  | 'extensions'
  | 'security'
  | 'tabContextMenu'
  | 'blockedPopups'
  | 'groupContextMenu'
  | 'tabSortMenu'
  | 'settings'
  | 'about'
  | 'taskManager';

/** Modal dialogs: one at a time like the rest, but they keep their own backdrop and buttons for closing */
const MODALS: ReadonlySet<PanelId> = new Set(['settings', 'about', 'taskManager']);

interface PanelContextValue {
  active: PanelId | null;
  setActive: React.Dispatch<React.SetStateAction<PanelId | null>>;
}

const PanelContext = createContext<PanelContextValue | null>(null);

export type PanelSetter = (open: boolean | ((wasOpen: boolean) => boolean)) => void;

export function panelSetter(id: PanelId, setActive: PanelContextValue['setActive']): PanelSetter {
  return (open) =>
    setActive((prev) => {
      const next = typeof open === 'function' ? open(prev === id) : open;
      if (next) return id;
      return prev === id ? null : prev;
    });
}

export function usePanelManager() {
  const [active, setActive] = useState<PanelId | null>(null);

  // Esc and a click outside close the current panel (modals handle their own closing)
  useEffect(() => {
    if (!active) return;
    const insideCurrent = (target: EventTarget | null) => {
      const el = target instanceof Element ? target : null;
      if (!el) return false;
      return Boolean(el.closest(`[data-panel="${active}"], [data-panel-toggle="${active}"]`));
    };
    const close = () => setActive((prev) => (prev === active ? null : prev));
    const closeOnClick = (e: MouseEvent) => {
      document.removeEventListener('dragstart', cancelClickClose, true);
      if (!insideCurrent(e.target)) close();
    };
    const cancelClickClose = () => document.removeEventListener('click', closeOnClick, true);
    const onMouseDown = (e: MouseEvent) => {
      if (MODALS.has(active) || insideCurrent(e.target)) return;
      // A tab grabbed to drop it into the open panel (bookmarks) must not close it: close on the click instead,
      // which does not come when the mouse was dragged
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('[draggable="true"]')) {
        document.addEventListener('click', closeOnClick, { once: true, capture: true });
        document.addEventListener('dragstart', cancelClickClose, { once: true, capture: true });
        return;
      }
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      setActive((prev) => (prev === active ? null : prev));
    };
    // A click into a page moves focus to its <webview>: the UI document sees only a blur
    const onBlur = () => {
      window.setTimeout(() => {
        if (MODALS.has(active)) return;
        if (document.activeElement?.tagName === 'WEBVIEW') setActive((prev) => (prev === active ? null : prev));
      }, 0);
    };
    document.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('click', closeOnClick, true);
      document.removeEventListener('dragstart', cancelClickClose, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
    };
  }, [active]);

  return useMemo(() => ({ active, setActive }), [active]);
}

export const PanelProvider: React.FC<{ value: PanelContextValue; children: React.ReactNode }> = ({ value, children }) => (
  <PanelContext.Provider value={value}>{children}</PanelContext.Provider>
);

/** [isOpen, setOpen] for one panel; setOpen(true) closes whatever else was open */
export function usePanel(id: PanelId): [boolean, PanelSetter] {
  const ctx = useContext(PanelContext);
  const [localActive, setLocalActive] = useState<PanelId | null>(null);
  const active = ctx ? ctx.active : localActive;
  const setActive = ctx ? ctx.setActive : setLocalActive;
  const setOpen = useCallback(panelSetter(id, setActive), [id, setActive]);
  return [active === id, setOpen];
}
