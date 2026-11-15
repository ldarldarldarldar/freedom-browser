// Tab group rules (src/services/tabGroupService.ts): run with `npm run test:groups`.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GROUP_COLORS,
  TabGroup,
  addToGroup,
  createGroup,
  insertIntoGroup,
  moveGroup,
  moveTab,
  moveTabToGroupStart,
  moveTabToEnd,
  nextGroupColor,
  normalizeGroups,
  removeFromGroup,
  sanitizeSavedGroups,
  ungroup,
} from '../src/services/tabGroupService.ts';

type T = { id: string; groupId?: string };
const tabs = (...ids: string[]): T[] => ids.map((id) => ({ id }));
const order = (list: T[]) => list.map((t) => (t.groupId ? `${t.id}:${t.groupId}` : t.id)).join(' ');
const ids = (list: T[]) => list.map((t) => t.id).join(' ');
const g = (id: string, color: TabGroup['color'] = 'blue'): TabGroup => ({ id, title: id, color, collapsed: false });

test('a new group gathers its tabs where the first one stood', () => {
  const r = createGroup(tabs('a', 'b', 'c', 'd'), [], ['b', 'd'], 'Work');
  assert.equal(ids(r.tabs), 'a b d c');
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0].title, 'Work');
  assert.ok(r.tabs[1].groupId === r.groupId && r.tabs[2].groupId === r.groupId);
  assert.equal(r.tabs[0].groupId, undefined);
  assert.equal(r.tabs[3].groupId, undefined);
});

test('new groups take the next free colour', () => {
  let groups: TabGroup[] = [];
  for (let i = 0; i < GROUP_COLORS.length; i++) {
    const color = nextGroupColor(groups);
    assert.ok(!groups.some((x) => x.color === color));
    groups.push(g(`g${i}`, color));
  }
  // All taken: not the colour of a neighbour
  assert.notEqual(nextGroupColor(groups, ['grey']), 'grey');
});

test('a tab taken from the middle of a group into a new group does not split the old one', () => {
  const start = [{ id: 'a', groupId: 'x' }, { id: 'b', groupId: 'x' }, { id: 'c', groupId: 'x' }, { id: 'd' }];
  const r = createGroup(start, [g('x')], ['b']);
  assert.equal(ids(r.tabs), 'a c b d');
  assert.equal(r.tabs[0].groupId, 'x');
  assert.equal(r.tabs[1].groupId, 'x');
  assert.equal(r.tabs[2].groupId, r.groupId);
});

test('add to group puts tabs at its end, remove puts them right after it', () => {
  let s = createGroup(tabs('a', 'b', 'c', 'd'), [], ['a']);
  const gid = s.groupId;
  s = { ...addToGroup(s.tabs, s.groups, ['d'], gid), groupId: gid };
  assert.equal(order(s.tabs), `a:${gid} d:${gid} b c`);
  const r = removeFromGroup(s.tabs, s.groups, ['a']);
  assert.equal(order(r.tabs), `d:${gid} a b c`);
});

test('the group is dropped with its last tab; other tabs keep no group', () => {
  const s = createGroup(tabs('a', 'b'), [], ['a']);
  const r = normalizeGroups(s.tabs.filter((t) => t.id !== 'a'), s.groups);
  assert.equal(r.groups.length, 0);
  assert.equal(r.tabs[0].groupId, undefined);
});

test('tabs pointing at a missing group lose the group', () => {
  const r = normalizeGroups([{ id: 'a', groupId: 'gone' }, { id: 'b' }], []);
  assert.equal(order(r.tabs), 'a b');
});

test('normalize keeps a group together and returns the same arrays when nothing changes', () => {
  const scattered = [{ id: 'a', groupId: 'x' }, { id: 'b' }, { id: 'c', groupId: 'x' }];
  assert.equal(ids(normalizeGroups(scattered, [g('x')]).tabs), 'a c b');
  const fine = [{ id: 'a', groupId: 'x' }, { id: 'c', groupId: 'x' }, { id: 'b' }];
  const groups = [g('x')];
  const r = normalizeGroups(fine, groups);
  assert.equal(r.tabs, fine);
  assert.equal(r.groups, groups);
});

test('ungroup keeps the tabs in place', () => {
  const start = [{ id: 'a' }, { id: 'b', groupId: 'x' }, { id: 'c', groupId: 'x' }, { id: 'd' }];
  const r = ungroup(start, [g('x')], 'x');
  assert.equal(order(r.tabs), 'a b c d');
  assert.equal(r.groups.length, 0);
});

test('dragging a tab into a group joins it, dragging out leaves it', () => {
  const start = [{ id: 'a' }, { id: 'b', groupId: 'x' }, { id: 'c', groupId: 'x' }, { id: 'd' }];
  const groups = [g('x')];
  assert.equal(order(moveTab(start, groups, 'a', 'b', 'after').tabs), 'b:x a:x c:x d');
  assert.equal(order(moveTab(start, groups, 'd', 'c', 'after').tabs), 'a b:x c:x d:x');
  // Before the first tab of a group = outside, in front of it
  assert.equal(order(moveTab(start, groups, 'd', 'b', 'before').tabs), 'a d b:x c:x');
  assert.equal(order(moveTab(start, groups, 'c', 'd', 'after').tabs), 'a b:x d c');
  assert.equal(order(moveTabToGroupStart(start, groups, 'd', 'x').tabs), 'a d:x b:x c:x');
  assert.equal(order(moveTabToEnd([{ id: 'a' }, { id: 'b', groupId: 'x' }, { id: 'c', groupId: 'x' }], groups, 'b').tabs), 'a c:x b');
});

test('dragging a group moves all of it and never lands inside another group', () => {
  const start = [{ id: 'a', groupId: 'x' }, { id: 'b', groupId: 'x' }, { id: 'c' }, { id: 'd', groupId: 'y' }, { id: 'e', groupId: 'y' }];
  const groups = [g('x'), g('y', 'red')];
  assert.equal(order(moveGroup(start, groups, 'x', 'c', 'after').tabs), 'c a:x b:x d:y e:y');
  assert.equal(order(moveGroup(start, groups, 'x', 'd', 'after').tabs), 'c d:y e:y a:x b:x');
  assert.equal(order(moveGroup(start, groups, 'y', 'b', 'before').tabs), 'd:y e:y a:x b:x c');
});

test('a reopened tab goes back to the end of its group, or to the end when the group is gone', () => {
  const start = [{ id: 'a', groupId: 'x' }, { id: 'b' }];
  assert.equal(order(insertIntoGroup(start, [g('x')], { id: 'n' }, 'x')), 'a:x n:x b');
  assert.equal(order(insertIntoGroup(start, [g('x')], { id: 'n' }, 'gone')), 'a:x b n');
});

test('saved groups are checked on load', () => {
  const r = sanitizeSavedGroups([
    { id: 'x', title: 'Work', color: 'green', collapsed: true },
    { id: 'x', title: 'dup' },
    { id: 'y', color: 'magenta' },
    null,
    { title: 'no id' },
  ]);
  assert.deepEqual(r, [
    { id: 'x', title: 'Work', color: 'green', collapsed: true },
    { id: 'y', title: '', color: 'grey', collapsed: false },
  ]);
  assert.deepEqual(sanitizeSavedGroups('nope'), []);
});
