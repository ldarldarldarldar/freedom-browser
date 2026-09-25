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
    const folders = this.getFolders().filter((f) => f.id !== folderId);
    this.saveFolders(folders);

    // Reassign orphan bookmarks in this folder to 'other'
    const bookmarks = this.getBookmarks().map((b) =>
      b.folderId === folderId ? { ...b, folderId: 'other' } : b
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

  public static search(query: string): Bookmark[] {
    const bookmarks = this.getBookmarks();
    if (!query || !query.trim()) return bookmarks;
    const q = query.toLowerCase().trim();
    return bookmarks.filter(
      (b) => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)
    );
  }
}
