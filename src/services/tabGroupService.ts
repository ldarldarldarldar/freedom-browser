// Tab groups: a name, a colour from a fixed palette, collapsed or not. Tabs point at their group with
// BrowserTab.groupId; a group's tabs always stand next to each other in the tab strip, and the group order
// is the order of its tabs. Pure functions over (tabs, groups), so they can be tested without the UI.

export const GROUP_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'] as const;
export type TabGroupColor = (typeof GROUP_COLORS)[number];

/** Strip colours, readable on the dark chrome */
export const GROUP_COLOR_HEX: Record<TabGroupColor, string> = {
  grey: '#9aa0a6',
  blue: '#5b9cf5',
  red: '#f07068',
  yellow: '#f5c542',
  green: '#4fc47f',
  pink: '#f07ab8',
  purple: '#b388f5',
  cyan: '#3fc9d6',
  orange: '#f5a04a',
};

export interface TabGroup {
  id: string;
  title: string;
  color: TabGroupColor;
  collapsed: boolean;
}

/** The part of a tab this module needs */
export interface GroupedTab {
  id: string;
  groupId?: string;
}

export function isGroupColor(value: unknown): value is TabGroupColor {
  return typeof value === 'string' && (GROUP_COLORS as readonly string[]).includes(value);
}

export function newGroupId(): string {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * The colour for a new group: the first one no group uses; when all are taken, the least used one that
 * differs from the groups next to where the new group will stand.
 */
export function nextGroupColor(groups: TabGroup[], neighbourColors: TabGroupColor[] = []): TabGroupColor {
  const used = new Map<TabGroupColor, number>();
  for (const g of groups) used.set(g.color, (used.get(g.color) || 0) + 1);
  const free = GROUP_COLORS.find((c) => !used.has(c));
  if (free) return free;
  const candidates = GROUP_COLORS.filter((c) => !neighbourColors.includes(c));
  const pool = candidates.length ? candidates : [...GROUP_COLORS];
  return pool.reduce((best, c) => ((used.get(c) || 0) < (used.get(best) || 0) ? c : best), pool[0]);
}

/**
 * Keeps the invariants: every group's tabs stand together (at the place of its first tab), a tab never points at
 * a group that does not exist, and a group without tabs is dropped. Returns the same arrays when nothing changed.
 */
export function normalizeGroups<T extends GroupedTab>(tabs: T[], groups: TabGroup[]): { tabs: T[]; groups: TabGroup[] } {
  const known = new Set(groups.map((g) => g.id));
  let changed = false;
  const cleaned = tabs.map((t) => {
    if (t.groupId && !known.has(t.groupId)) {
      changed = true;
      const { groupId: _drop, ...rest } = t;
      return rest as T;
    }
    return t;
  });

  const members = new Map<string, T[]>();
  for (const t of cleaned) {
    if (!t.groupId) continue;
    const list = members.get(t.groupId);
    if (list) list.push(t);
    else members.set(t.groupId, [t]);
  }

  const ordered: T[] = [];
  const placed = new Set<string>();
  for (const t of cleaned) {
    if (!t.groupId) {
      ordered.push(t);
    } else if (!placed.has(t.groupId)) {
      placed.add(t.groupId);
      ordered.push(...members.get(t.groupId)!);
    }
  }
  if (!changed) changed = ordered.some((t, i) => t !== tabs[i]);

  const liveGroups = groups.filter((g) => members.has(g.id));
  const groupsChanged = liveGroups.length !== groups.length;
  return { tabs: changed ? ordered : tabs, groups: groupsChanged ? liveGroups : groups };
}

/** Index range [start, end] of a group's tabs, or null */
export function groupRange(tabs: GroupedTab[], groupId: string): [number, number] | null {
  const start = tabs.findIndex((t) => t.groupId === groupId);
  if (start === -1) return null;
  let end = start;
  while (end + 1 < tabs.length && tabs[end + 1].groupId === groupId) end++;
  return [start, end];
}

function withGroup<T extends GroupedTab>(tab: T, groupId: string | undefined): T {
  if (groupId) return { ...tab, groupId };
  const { groupId: _drop, ...rest } = tab;
  return rest as T;
}

/** Puts `moving` (in their current order) at `index` of the remaining tabs */
function insertAt<T extends GroupedTab>(tabs: T[], ids: Set<string>, index: (rest: T[]) => number, map: (t: T) => T): T[] {
  const moving = tabs.filter((t) => ids.has(t.id)).map(map);
  const rest = tabs.filter((t) => !ids.has(t.id));
  const at = Math.max(0, Math.min(rest.length, index(rest)));
  return [...rest.slice(0, at), ...moving, ...rest.slice(at)];
}

/** New group from the given tabs, placed where the first of them stood */
export function createGroup<T extends GroupedTab>(tabs: T[], groups: TabGroup[], tabIds: string[], title = ''): { tabs: T[]; groups: TabGroup[]; groupId: string } {
  const ids = new Set(tabIds.filter((id) => tabs.some((t) => t.id === id)));
  if (ids.size === 0) return { tabs, groups, groupId: '' };
  const firstIndex = tabs.findIndex((t) => ids.has(t.id));
  const groupId = newGroupId();
  // Tabs before the first chosen one that stay: the new group goes right after them
  const before = tabs.slice(0, firstIndex).filter((t) => !ids.has(t.id));
  // A chosen tab in the middle of another group would split it: start the new group after that group instead
  const host = tabs[firstIndex].groupId;
  let at = before.length;
  if (host) {
    const rest = tabs.filter((t) => !ids.has(t.id));
    const range = groupRange(rest, host);
    if (range && range[0] < at && at <= range[1]) at = range[1] + 1;
  }
  const neighbours: TabGroupColor[] = [];
  const rest = tabs.filter((t) => !ids.has(t.id));
  for (const t of [rest[at - 1], rest[at]]) {
    const g = t?.groupId ? groups.find((x) => x.id === t.groupId) : undefined;
    if (g) neighbours.push(g.color);
  }
  const group: TabGroup = { id: groupId, title, color: nextGroupColor(groups, neighbours), collapsed: false };
  const nextTabs = insertAt(tabs, ids, () => at, (t) => withGroup(t, groupId));
  return { ...normalizeGroups(nextTabs, [...groups, group]), groupId };
}

/** Adds tabs to the end of an existing group */
export function addToGroup<T extends GroupedTab>(tabs: T[], groups: TabGroup[], tabIds: string[], groupId: string): { tabs: T[]; groups: TabGroup[] } {
  if (!groups.some((g) => g.id === groupId)) return { tabs, groups };
  const ids = new Set(tabIds);
  const nextTabs = insertAt(
    tabs,
    ids,
    (rest) => {
      const range = groupRange(rest, groupId);
      return range ? range[1] + 1 : rest.length;
    },
    (t) => withGroup(t, groupId)
  );
  return normalizeGroups(nextTabs, groups);
}

/** Takes tabs out of their groups; each one lands right after the group it left */
export function removeFromGroup<T extends GroupedTab>(tabs: T[], groups: TabGroup[], tabIds: string[]): { tabs: T[]; groups: TabGroup[] } {
  let next = tabs;
  for (const id of tabIds) {
    const tab = next.find((t) => t.id === id);
    if (!tab?.groupId) continue;
    const gid = tab.groupId;
    next = insertAt(
      next,
      new Set([id]),
      (rest) => {
        const range = groupRange(rest, gid);
        return range ? range[1] + 1 : rest.findIndex((t) => t.id === id);
      },
      (t) => withGroup(t, undefined)
    );
  }
  return normalizeGroups(next, groups);
}

/** Ungroup: the tabs stay where they are */
export function ungroup<T extends GroupedTab>(tabs: T[], groups: TabGroup[], groupId: string): { tabs: T[]; groups: TabGroup[] } {
  return normalizeGroups(
    tabs.map((t) => (t.groupId === groupId ? withGroup(t, undefined) : t)),
    groups.filter((g) => g.id !== groupId)
  );
}

export function updateGroup(groups: TabGroup[], groupId: string, patch: Partial<Omit<TabGroup, 'id'>>): TabGroup[] {
  return groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g));
}

/**
 * Drag and drop of one tab onto another tab. Dropped among a group's tabs it joins that group; dropped before the
 * first tab of a group or next to an ungrouped tab it is ungrouped.
 */
export function moveTab<T extends GroupedTab>(tabs: T[], groups: TabGroup[], tabId: string, targetId: string, side: 'before' | 'after'): { tabs: T[]; groups: TabGroup[] } {
  if (tabId === targetId) return { tabs, groups };
  const target = tabs.find((t) => t.id === targetId);
  if (!target || !tabs.some((t) => t.id === tabId)) return { tabs, groups };
  let groupId = target.groupId;
  if (groupId && side === 'before') {
    const range = groupRange(tabs.filter((t) => t.id !== tabId), groupId);
    const rest = tabs.filter((t) => t.id !== tabId);
    if (range && rest[range[0]].id === targetId) groupId = undefined;
  }
  const nextTabs = insertAt(
    tabs,
    new Set([tabId]),
    (rest) => {
      const i = rest.findIndex((t) => t.id === targetId);
      return side === 'before' ? i : i + 1;
    },
    (t) => withGroup(t, groupId)
  );
  return normalizeGroups(nextTabs, groups);
}

/** Drop of a tab on a group's header: it joins the group as its first tab */
export function moveTabToGroupStart<T extends GroupedTab>(tabs: T[], groups: TabGroup[], tabId: string, groupId: string): { tabs: T[]; groups: TabGroup[] } {
  if (!groups.some((g) => g.id === groupId)) return { tabs, groups };
  const nextTabs = insertAt(
    tabs,
    new Set([tabId]),
    (rest) => {
      const range = groupRange(rest, groupId);
      return range ? range[0] : rest.length;
    },
    (t) => withGroup(t, groupId)
  );
  return normalizeGroups(nextTabs, groups);
}

/**
 * Moves a whole group before or after a tab. A target inside another group means before/after that whole group,
 * so groups never end up inside each other.
 */
export function moveGroup<T extends GroupedTab>(tabs: T[], groups: TabGroup[], groupId: string, targetId: string, side: 'before' | 'after'): { tabs: T[]; groups: TabGroup[] } {
  const target = tabs.find((t) => t.id === targetId);
  if (!target || target.groupId === groupId) return { tabs, groups };
  const ids = new Set(tabs.filter((t) => t.groupId === groupId).map((t) => t.id));
  if (ids.size === 0) return { tabs, groups };
  const nextTabs = insertAt(
    tabs,
    ids,
    (rest) => {
      if (target.groupId) {
        const range = groupRange(rest, target.groupId)!;
        return side === 'before' ? range[0] : range[1] + 1;
      }
      const i = rest.findIndex((t) => t.id === targetId);
      return side === 'before' ? i : i + 1;
    },
    (t) => t
  );
  return normalizeGroups(nextTabs, groups);
}

/** Where a tab opened "in a group" goes: right after the group's last tab */
export function insertIntoGroup<T extends GroupedTab>(tabs: T[], groups: TabGroup[], tab: T, groupId: string): T[] {
  if (!groups.some((g) => g.id === groupId)) return [...tabs, withGroup(tab, undefined)];
  const range = groupRange(tabs, groupId);
  const at = range ? range[1] + 1 : tabs.length;
  return [...tabs.slice(0, at), withGroup(tab, groupId), ...tabs.slice(at)];
}

/** Groups as saved in the session: only those that still have tabs to restore */
export function sanitizeSavedGroups(raw: unknown): TabGroup[] {
  if (!Array.isArray(raw)) return [];
  const out: TabGroup[] = [];
  const seen = new Set<string>();
  for (const g of raw) {
    if (!g || typeof g.id !== 'string' || !g.id || seen.has(g.id)) continue;
    seen.add(g.id);
    out.push({
      id: g.id,
      title: typeof g.title === 'string' ? g.title.slice(0, 200) : '',
      color: isGroupColor(g.color) ? g.color : 'grey',
      collapsed: Boolean(g.collapsed),
    });
  }
  return out;
}

/** Drop of a tab on the empty end of the strip: last, without a group */
export function moveTabToEnd<T extends GroupedTab>(tabs: T[], groups: TabGroup[], tabId: string): { tabs: T[]; groups: TabGroup[] } {
  if (!tabs.some((t) => t.id === tabId)) return { tabs, groups };
  return normalizeGroups(insertAt(tabs, new Set([tabId]), (rest) => rest.length, (t) => withGroup(t, undefined)), groups);
}
