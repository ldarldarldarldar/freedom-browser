import React from 'react';

export type SplitLayoutType =
  | '2-vertical'
  | '2-horizontal'
  | '3-columns'
  | '3-left-main'
  | '3-top-main'
  | '4-grid'
  | '4-columns';

export interface SplitPane {
  id: string; // 'pane-1', 'pane-2', etc.
  tabId: string;
}

export interface PaneBox {
  top: string;
  left: string;
  width: string;
  height: string;
}

export interface DividerDescriptor {
  id: string;
  orientation: 'vertical' | 'horizontal';
  positionPercent: number;
  style: React.CSSProperties;
  index: number;
}

export interface SplitViewState {
  enabled: boolean;
  panes: SplitPane[];
  activePaneId: string;
  layout: SplitLayoutType;
  dividerPositions: number[];
  // Backward compatibility fields
  leftTabId?: string | null;
  rightTabId?: string | null;
  activePane?: 'left' | 'right';
  dividerPosition?: number;
}

const SPLIT_VIEW_STORAGE_KEY = 'freedom_browser_split_view_v2';
const LEGACY_STORAGE_KEY = 'freedom_browser_split_view';

export const DEFAULT_SPLIT_VIEW_STATE: SplitViewState = {
  enabled: false,
  panes: [],
  activePaneId: 'pane-1',
  layout: '2-vertical',
  dividerPositions: [50],
  leftTabId: null,
  rightTabId: null,
  activePane: 'left',
  dividerPosition: 50,
};

export class SplitViewService {
  /**
   * Get default divider percentages for a given layout
   */
  static getDefaultDividers(layout: SplitLayoutType): number[] {
    switch (layout) {
      case '2-vertical':
      case '2-horizontal':
        return [50];
      case '3-columns':
        return [33.33, 66.67];
      case '3-left-main':
      case '3-top-main':
        return [50, 50];
      case '4-grid':
        return [50, 50];
      case '4-columns':
        return [25, 50, 75];
      default:
        return [50];
    }
  }

  /**
   * Get standard default layout for a given number of panes
   */
  static getDefaultLayoutForCount(count: number): SplitLayoutType {
    if (count <= 2) return '2-vertical';
    if (count === 3) return '3-left-main';
    return '4-grid';
  }

  /**
   * Get available layouts for a given number of panes
   */
  static getAvailableLayouts(count: number): SplitLayoutType[] {
    if (count <= 2) {
      return ['2-vertical', '2-horizontal'];
    }
    if (count === 3) {
      return ['3-left-main', '3-top-main', '3-columns'];
    }
    return ['4-grid', '4-columns'];
  }

  /**
   * Load split view state from storage with fallback & legacy migration
   */
  static loadState(): SplitViewState {
    try {
      const stored = localStorage.getItem(SPLIT_VIEW_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const panes: SplitPane[] = Array.isArray(parsed.panes)
          ? parsed.panes.filter((p: any) => p && typeof p.id === 'string' && typeof p.tabId === 'string')
          : [];

        const count = Math.max(2, Math.min(4, panes.length || 2));
        const layout: SplitLayoutType = parsed.layout || this.getDefaultLayoutForCount(count);
        const dividerPositions = Array.isArray(parsed.dividerPositions) && parsed.dividerPositions.length > 0
          ? parsed.dividerPositions
          : this.getDefaultDividers(layout);

        const activePaneId = parsed.activePaneId || (panes[0]?.id ?? 'pane-1');

        return {
          enabled: Boolean(parsed.enabled && panes.length >= 2),
          panes,
          activePaneId,
          layout,
          dividerPositions,
          leftTabId: panes[0]?.tabId || null,
          rightTabId: panes[1]?.tabId || null,
          activePane: activePaneId === panes[1]?.id ? 'right' : 'left',
          dividerPosition: dividerPositions[0] || 50,
        };
      }

      // Check legacy v1 state for migration
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed.leftTabId && parsed.rightTabId) {
          const panes: SplitPane[] = [
            { id: 'pane-1', tabId: parsed.leftTabId },
            { id: 'pane-2', tabId: parsed.rightTabId },
          ];
          const divPos = typeof parsed.dividerPosition === 'number' ? parsed.dividerPosition : 50;
          return {
            enabled: Boolean(parsed.enabled),
            panes,
            activePaneId: parsed.activePane === 'right' ? 'pane-2' : 'pane-1',
            layout: '2-vertical',
            dividerPositions: [divPos],
            leftTabId: parsed.leftTabId,
            rightTabId: parsed.rightTabId,
            activePane: parsed.activePane === 'right' ? 'right' : 'left',
            dividerPosition: divPos,
          };
        }
      }

      return DEFAULT_SPLIT_VIEW_STATE;
    } catch {
      return DEFAULT_SPLIT_VIEW_STATE;
    }
  }

  /**
   * Save split view state to storage
   */
  static saveState(state: SplitViewState): void {
    try {
      localStorage.setItem(SPLIT_VIEW_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save SplitViewState to localStorage:', e);
    }
  }

  /**
   * Validate state against current active tabs in the browser
   */
  static validateState(state: SplitViewState, existingTabIds: string[]): SplitViewState {
    if (!state.enabled || existingTabIds.length === 0) {
      return {
        ...state,
        enabled: false,
      };
    }

    // Keep only panes that reference an existing tab
    const validPanes: SplitPane[] = [];
    const usedTabIds = new Set<string>();

    for (const pane of state.panes) {
      if (existingTabIds.includes(pane.tabId) && !usedTabIds.has(pane.tabId)) {
        validPanes.push(pane);
        usedTabIds.add(pane.tabId);
      }
    }

    // If fewer than 2 panes exist, populate with unused existing tabs if possible
    if (validPanes.length < 2) {
      for (const tabId of existingTabIds) {
        if (!usedTabIds.has(tabId) && validPanes.length < 2) {
          validPanes.push({
            id: `pane-${validPanes.length + 1}`,
            tabId,
          });
          usedTabIds.add(tabId);
        }
      }
    }

    // If still less than 2 distinct tabs exist in the browser, exit split view safely
    if (validPanes.length < 2) {
      return {
        ...state,
        enabled: false,
        panes: validPanes,
        leftTabId: validPanes[0]?.tabId || null,
        rightTabId: null,
      };
    }

    // Ensure layout is valid for current pane count
    const count = validPanes.length;
    let layout = state.layout;
    const available = this.getAvailableLayouts(count);
    if (!available.includes(layout)) {
      layout = this.getDefaultLayoutForCount(count);
    }

    let dividerPositions = state.dividerPositions;
    const defaultDividers = this.getDefaultDividers(layout);
    if (dividerPositions.length !== defaultDividers.length) {
      dividerPositions = defaultDividers;
    }

    const activePaneId = validPanes.some((p) => p.id === state.activePaneId)
      ? state.activePaneId
      : validPanes[0].id;

    return {
      enabled: true,
      panes: validPanes,
      activePaneId,
      layout,
      dividerPositions,
      leftTabId: validPanes[0]?.tabId || null,
      rightTabId: validPanes[1]?.tabId || null,
      activePane: activePaneId === validPanes[1]?.id ? 'right' : 'left',
      dividerPosition: dividerPositions[0] || 50,
    };
  }

  /**
   * Layout Geometry Engine: Calculate precise CSS bounds for each pane and draggable divider handles
   */
  static calculateLayout(
    layout: SplitLayoutType,
    paneCount: number,
    dividerPositions: number[]
  ): { boxes: PaneBox[]; dividers: DividerDescriptor[] } {
    const boxes: PaneBox[] = [];
    const dividers: DividerDescriptor[] = [];

    if (layout === '2-horizontal') {
      const pos = Math.max(15, Math.min(85, dividerPositions[0] ?? 50));
      boxes.push({ top: '0%', left: '0%', width: '100%', height: `${pos}%` });
      boxes.push({ top: `${pos}%`, left: '0%', width: '100%', height: `${100 - pos}%` });
      dividers.push({
        id: 'div-horiz-1',
        orientation: 'horizontal',
        positionPercent: pos,
        style: {
          position: 'absolute',
          left: 0,
          right: 0,
          top: `calc(${pos}% - 4px)`,
          height: 8,
          zIndex: 40,
        },
        index: 0,
      });
      return { boxes, dividers };
    }

    if (layout === '2-vertical' || paneCount <= 2) {
      const pos = Math.max(15, Math.min(85, dividerPositions[0] ?? 50));
      boxes.push({ top: '0%', left: '0%', width: `${pos}%`, height: '100%' });
      boxes.push({ top: '0%', left: `${pos}%`, width: `${100 - pos}%`, height: '100%' });
      dividers.push({
        id: 'div-vert-1',
        orientation: 'vertical',
        positionPercent: pos,
        style: {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `calc(${pos}% - 4px)`,
          width: 8,
          zIndex: 40,
        },
        index: 0,
      });
      return { boxes, dividers };
    }

    if (layout === '3-columns') {
      let p1 = Math.max(15, Math.min(70, dividerPositions[0] ?? 33.33));
      let p2 = Math.max(p1 + 10, Math.min(85, dividerPositions[1] ?? 66.67));

      boxes.push({ top: '0%', left: '0%', width: `${p1}%`, height: '100%' });
      boxes.push({ top: '0%', left: `${p1}%`, width: `${p2 - p1}%`, height: '100%' });
      boxes.push({ top: '0%', left: `${p2}%`, width: `${100 - p2}%`, height: '100%' });

      dividers.push({
        id: 'div-col-1',
        orientation: 'vertical',
        positionPercent: p1,
        style: {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `calc(${p1}% - 4px)`,
          width: 8,
          zIndex: 40,
        },
        index: 0,
      });
      dividers.push({
        id: 'div-col-2',
        orientation: 'vertical',
        positionPercent: p2,
        style: {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `calc(${p2}% - 4px)`,
          width: 8,
          zIndex: 40,
        },
        index: 1,
      });
      return { boxes, dividers };
    }

    if (layout === '3-left-main') {
      const pX = Math.max(20, Math.min(80, dividerPositions[0] ?? 50));
      const pY = Math.max(15, Math.min(85, dividerPositions[1] ?? 50));

      boxes.push({ top: '0%', left: '0%', width: `${pX}%`, height: '100%' });
      boxes.push({ top: '0%', left: `${pX}%`, width: `${100 - pX}%`, height: `${pY}%` });
      boxes.push({ top: `${pY}%`, left: `${pX}%`, width: `${100 - pX}%`, height: `${100 - pY}%` });

      dividers.push({
        id: 'div-lm-vert',
        orientation: 'vertical',
        positionPercent: pX,
        style: {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `calc(${pX}% - 4px)`,
          width: 8,
          zIndex: 40,
        },
        index: 0,
      });
      dividers.push({
        id: 'div-lm-horiz',
        orientation: 'horizontal',
        positionPercent: pY,
        style: {
          position: 'absolute',
          left: `${pX}%`,
          right: 0,
          top: `calc(${pY}% - 4px)`,
          height: 8,
          zIndex: 40,
        },
        index: 1,
      });
      return { boxes, dividers };
    }

    if (layout === '3-top-main') {
      const pY = Math.max(20, Math.min(80, dividerPositions[0] ?? 50));
      const pX = Math.max(15, Math.min(85, dividerPositions[1] ?? 50));

      boxes.push({ top: '0%', left: '0%', width: '100%', height: `${pY}%` });
      boxes.push({ top: `${pY}%`, left: '0%', width: `${pX}%`, height: `${100 - pY}%` });
      boxes.push({ top: `${pY}%`, left: `${pX}%`, width: `${100 - pX}%`, height: `${100 - pY}%` });

      dividers.push({
        id: 'div-tm-horiz',
        orientation: 'horizontal',
        positionPercent: pY,
        style: {
          position: 'absolute',
          left: 0,
          right: 0,
          top: `calc(${pY}% - 4px)`,
          height: 8,
          zIndex: 40,
        },
        index: 0,
      });
      dividers.push({
        id: 'div-tm-vert',
        orientation: 'vertical',
        positionPercent: pX,
        style: {
          position: 'absolute',
          top: `${pY}%`,
          bottom: 0,
          left: `calc(${pX}% - 4px)`,
          width: 8,
          zIndex: 40,
        },
        index: 1,
      });
      return { boxes, dividers };
    }

    if (layout === '4-grid') {
      const pX = Math.max(20, Math.min(80, dividerPositions[0] ?? 50));
      const pY = Math.max(20, Math.min(80, dividerPositions[1] ?? 50));

      boxes.push({ top: '0%', left: '0%', width: `${pX}%`, height: `${pY}%` });
      boxes.push({ top: '0%', left: `${pX}%`, width: `${100 - pX}%`, height: `${pY}%` });
      boxes.push({ top: `${pY}%`, left: '0%', width: `${pX}%`, height: `${100 - pY}%` });
      boxes.push({ top: `${pY}%`, left: `${pX}%`, width: `${100 - pX}%`, height: `${100 - pY}%` });

      dividers.push({
        id: 'div-grid-vert',
        orientation: 'vertical',
        positionPercent: pX,
        style: {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `calc(${pX}% - 4px)`,
          width: 8,
          zIndex: 40,
        },
        index: 0,
      });
      dividers.push({
        id: 'div-grid-horiz',
        orientation: 'horizontal',
        positionPercent: pY,
        style: {
          position: 'absolute',
          left: 0,
          right: 0,
          top: `calc(${pY}% - 4px)`,
          height: 8,
          zIndex: 40,
        },
        index: 1,
      });
      return { boxes, dividers };
    }

    if (layout === '4-columns') {
      let d0 = Math.max(10, Math.min(40, dividerPositions[0] ?? 25));
      let d1 = Math.max(d0 + 10, Math.min(65, dividerPositions[1] ?? 50));
      let d2 = Math.max(d1 + 10, Math.min(90, dividerPositions[2] ?? 75));

      boxes.push({ top: '0%', left: '0%', width: `${d0}%`, height: '100%' });
      boxes.push({ top: '0%', left: `${d0}%`, width: `${d1 - d0}%`, height: '100%' });
      boxes.push({ top: '0%', left: `${d1}%`, width: `${d2 - d1}%`, height: '100%' });
      boxes.push({ top: '0%', left: `${d2}%`, width: `${100 - d2}%`, height: '100%' });

      dividers.push({
        id: 'div-4col-1',
        orientation: 'vertical',
        positionPercent: d0,
        style: {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `calc(${d0}% - 4px)`,
          width: 8,
          zIndex: 40,
        },
        index: 0,
      });
      dividers.push({
        id: 'div-4col-2',
        orientation: 'vertical',
        positionPercent: d1,
        style: {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `calc(${d1}% - 4px)`,
          width: 8,
          zIndex: 40,
        },
        index: 1,
      });
      dividers.push({
        id: 'div-4col-3',
        orientation: 'vertical',
        positionPercent: d2,
        style: {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `calc(${d2}% - 4px)`,
          width: 8,
          zIndex: 40,
        },
        index: 2,
      });
      return { boxes, dividers };
    }

    return { boxes, dividers };
  }

  /**
   * Safely compute updated divider positions avoiding overlap or collapse
   */
  static updateDividerPosition(
    layout: SplitLayoutType,
    prevPositions: number[],
    dividerIndex: number,
    percent: number
  ): number[] {
    const next = [...prevPositions];
    const clamped = Math.round(percent * 10) / 10;

    if (layout === '3-columns') {
      if (dividerIndex === 0) {
        next[0] = Math.max(15, Math.min((next[1] ?? 66.67) - 10, clamped));
      } else {
        next[1] = Math.max((next[0] ?? 33.33) + 10, Math.min(85, clamped));
      }
      return next;
    }

    if (layout === '4-columns') {
      if (dividerIndex === 0) {
        next[0] = Math.max(10, Math.min((next[1] ?? 50) - 5, clamped));
      } else if (dividerIndex === 1) {
        next[1] = Math.max((next[0] ?? 25) + 5, Math.min((next[2] ?? 75) - 5, clamped));
      } else {
        next[2] = Math.max((next[1] ?? 50) + 5, Math.min(90, clamped));
      }
      return next;
    }

    if (layout === '3-left-main') {
      if (dividerIndex === 0) {
        next[0] = Math.max(20, Math.min(80, clamped));
      } else {
        next[1] = Math.max(15, Math.min(85, clamped));
      }
      return next;
    }

    if (layout === '3-top-main') {
      if (dividerIndex === 0) {
        next[0] = Math.max(20, Math.min(80, clamped));
      } else {
        next[1] = Math.max(15, Math.min(85, clamped));
      }
      return next;
    }

    if (layout === '4-grid') {
      if (dividerIndex === 0) {
        next[0] = Math.max(20, Math.min(80, clamped));
      } else {
        next[1] = Math.max(20, Math.min(80, clamped));
      }
      return next;
    }

    // 2-vertical or 2-horizontal
    next[0] = Math.max(15, Math.min(85, clamped));
    return next;
  }
}
