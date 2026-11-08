import { Bookmark, BookmarkFolder } from '../browser/types';

const BOOKMARKS_STORAGE_KEY = 'freedom_browser_bookmarks_v1';
const BOOKMARK_FOLDERS_STORAGE_KEY = 'freedom_browser_bookmark_folders_v1';

export const DEFAULT_BOOKMARK_FOLDERS: BookmarkFolder[] = [
  { id: 'bar', name: 'Bookmarks Bar', createdAt: 0 },
  { id: 'other', name: 'Other Bookmarks', createdAt: 0 },
];

export class BookmarkService {
  private static cachedBookmarks: Bookmark[] | null = null;
  private static cachedFolders: BookmarkFolder[] | null = null;

  public static getFolders(): BookmarkFolder[] {
    if (this.cachedFolders) return this.cachedFolders;
    try {
      const data = localStorage.getItem(BOOKMARK_FOLDERS_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.cachedFolders = parsed.filter(
            (f) => f && typeof f.id === 'string' && typeof f.name === 'string'
          );
          return this.cachedFolders;
        }
      }
    } catch (e) {
      console.warn('Failed to parse bookmark folders:', e);
    }
    this.cachedFolders = [...DEFAULT_BOOKMARK_FOLDERS];
    return this.cachedFolders;
  }

  public static saveFolders(folders: BookmarkFolder[]): void {
    try {
      this.cachedFolders = folders;
      localStorage.setItem(BOOKMARK_FOLDERS_STORAGE_KEY, JSON.stringify(folders));
    } catch (e) {
      console.warn('Failed to persist bookmark folders:', e);
    }
  }

  public static createFolder(name: string, parentId?: string): BookmarkFolder {
    const folders = this.getFolders();
    const newFolder: BookmarkFolder = {
      id: 'fld-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      name: name.trim() || 'New Folder',
      parentId,
      createdAt: Date.now(),
    };
    const updated = [...folders, newFolder];
    this.saveFolders(updated);
    return newFolder;
  }

  public static deleteFolder(folderId: string): void {
    if (folderId === 'bar' || folderId === 'other') return; // Cannot delete system folders
    // Subfolders go too (imported trees nest)
    const all = this.getFolders();
    const removed = new Set([folderId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of all) {
        if (f.parentId && removed.has(f.parentId) && !removed.has(f.id)) {
          removed.add(f.id);
          grew = true;
        }
      }
    }
    this.saveFolders(all.filter((f) => !removed.has(f.id)));

    // Reassign orphan bookmarks in these folders to 'other'
    const bookmarks = this.getBookmarks().map((b) =>
      removed.has(b.folderId) ? { ...b, folderId: 'other' } : b
    );
    this.saveBookmarks(bookmarks);
  }

  public static getBookmarks(): Bookmark[] {
    if (this.cachedBookmarks) return this.cachedBookmarks;
    try {
      const data = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.cachedBookmarks = parsed.filter(
            (b) => b && typeof b.id === 'string' && typeof b.url === 'string'
          );
          return this.cachedBookmarks;
        }
      }
    } catch (e) {
      console.warn('Failed to parse bookmarks:', e);
    }
    this.cachedBookmarks = [];
    return [];
  }

  public static saveBookmarks(items: Bookmark[]): void {
    try {
      this.cachedBookmarks = items;
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to persist bookmarks:', e);
    }
  }

  public static isBookmarked(url: string): boolean {
    if (!url || url.startsWith('freedom://')) return false;
    const bookmarks = this.getBookmarks();
    return bookmarks.some((b) => b.url === url);
  }

  public static getBookmarkByUrl(url: string): Bookmark | undefined {
    if (!url) return undefined;
    return this.getBookmarks().find((b) => b.url === url);
  }

  public static addBookmark(
    title: string,
    url: string,
    favicon?: string,
    folderId: string = 'bar'
  ): Bookmark | null {
    if (!url || url.startsWith('freedom://newtab')) return null;

    const bookmarks = this.getBookmarks();
    const existingIndex = bookmarks.findIndex((b) => b.url === url);

    const cleanTitle = (title && title.trim()) ? title.trim() : url;
    if (existingIndex >= 0) {
      // Update existing
      bookmarks[existingIndex].title = cleanTitle;
      bookmarks[existingIndex].folderId = folderId;
      if (favicon) bookmarks[existingIndex].favicon = favicon;
      this.saveBookmarks([...bookmarks]);
      return bookmarks[existingIndex];
    }

    const newBookmark: Bookmark = {
      id: 'bm-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      title: cleanTitle,
      url,
      favicon,
      folderId,
      addedAt: Date.now(),
    };

    this.saveBookmarks([newBookmark, ...bookmarks]);
    return newBookmark;
  }

  public static removeBookmark(id: string): Bookmark[] {
    const bookmarks = this.getBookmarks().filter((b) => b.id !== id);
    this.saveBookmarks(bookmarks);
    return bookmarks;
  }

  public static removeBookmarkByUrl(url: string): Bookmark[] {
    const bookmarks = this.getBookmarks().filter((b) => b.url !== url);
    this.saveBookmarks(bookmarks);
    return bookmarks;
  }

  public static toggleBookmark(
    title: string,
    url: string,
    favicon?: string,
    folderId: string = 'bar'
  ): { bookmarked: boolean; bookmark?: Bookmark } {
    if (this.isBookmarked(url)) {
      this.removeBookmarkByUrl(url);
      return { bookmarked: false };
    } else {
      const created = this.addBookmark(title, url, favicon, folderId);
      return { bookmarked: true, bookmark: created || undefined };
    }
  }

  public static updateBookmark(
    id: string,
    updates: { title?: string; url?: string; folderId?: string }
  ): Bookmark[] {
    const bookmarks = this.getBookmarks().map((b) => {
      if (b.id === id) {
        return {
          ...b,
          title: updates.title !== undefined ? updates.title.trim() : b.title,
          url: updates.url !== undefined ? updates.url.trim() : b.url,
          folderId: updates.folderId !== undefined ? updates.folderId : b.folderId,
        };
      }
      return b;
    });
    this.saveBookmarks(bookmarks);
    return bookmarks;
  }

  /** "Parent / Child" for nested folders (the system folders are not part of the path) */
  public static folderPath(folderId: string, folders: BookmarkFolder[] = this.getFolders()): string {
    const byId = new Map(folders.map((f) => [f.id, f]));
    const names: string[] = [];
    const seen = new Set<string>();
    let current = byId.get(folderId);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      names.unshift(current.name);
      if (!current.parentId || current.parentId === 'bar' || current.parentId === 'other') break;
      current = byId.get(current.parentId);
    }
    return names.join(' / ');
  }

  /**
   * Merges a tree from electron/bookmarks-io.cjs. Bar items go to the bookmarks bar, the rest to Other;
   * folders keep their nesting, folders with the same name and place are reused, known addresses are skipped.
   */
  public static importTree(tree: { bar: ImportedBookmarkNode[]; other: ImportedBookmarkNode[] }): {
    added: number;
    skipped: number;
    folders: number;
  } {
    const folders = [...this.getFolders()];
    const existing = this.getBookmarks();
    const known = new Set(existing.map((b) => b.url));
    const added: Bookmark[] = [];
    let skipped = 0;
    let newFolders = 0;
    let seq = 0;
    const now = Date.now();
    const uid = (prefix: string) => `${prefix}-${now}-${(seq++).toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const folderFor = (title: string, parentId: string | undefined): string => {
      const name = title.trim() || 'Folder';
      const found = folders.find((f) => f.name === name && (f.parentId || undefined) === parentId && f.id !== 'bar' && f.id !== 'other');
      if (found) return found.id;
      const folder: BookmarkFolder = { id: uid('fld'), name, parentId, createdAt: now };
      folders.push(folder);
      newFolders++;
      return folder.id;
    };

    const walk = (nodes: ImportedBookmarkNode[], folderId: string, parentForFolders: string | undefined) => {
      for (const node of nodes) {
        if (node.type === 'folder') {
          const id = folderFor(node.title, parentForFolders);
          walk(node.children, id, id);
        } else {
          if (!node.url || known.has(node.url)) {
            skipped++;
            continue;
          }
          known.add(node.url);
          added.push({
            id: uid('bm'),
            title: (node.title || node.url).trim(),
            url: node.url,
            favicon: node.favicon,
            folderId,
            addedAt: node.addedAt || now,
          });
        }
      }
    };
    walk(tree.bar || [], 'bar', 'bar');
    walk(tree.other || [], 'other', undefined);

    if (newFolders) this.saveFolders(folders);
    if (added.length) this.saveBookmarks([...existing, ...added]);
    return { added: added.length, skipped, folders: newFolders };
  }

  public static search(query: string): Bookmark[] {
    const bookmarks = this.getBookmarks();
    if (!query || !query.trim()) return bookmarks;
    const q = query.toLowerCase().trim();
    return bookmarks.filter(
      (b) => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)
    );
  }
}
