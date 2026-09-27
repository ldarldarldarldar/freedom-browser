export interface NewTabFavorite {
  id: string;
  title: string;
  url: string;
  createdAt: number;
}

const FAVORITES_STORAGE_KEY = 'freedom_browser_newtab_favorites';

export class FavoritesService {
  /**
   * Retrieve all New Tab favorites from persistent storage.
   * Default is an empty array (0 favorites) on fresh install.
   */
  public static getFavorites(): NewTabFavorite[] {
    try {
      const data = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to load newtab favorites:', e);
      return [];
    }
  }

  /**
   * Add a new favorite site to New Tab.
   */
  public static addFavorite(title: string, rawUrl: string): NewTabFavorite {
    const favorites = this.getFavorites();
    let url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('freedom://')) {
      url = 'https://' + url;
    }
    const cleanTitle = title.trim() || url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    const newFav: NewTabFavorite = {
      id: `fav-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: cleanTitle,
      url,
      createdAt: Date.now(),
    };
    favorites.push(newFav);
    this.save(favorites);
    return newFav;
  }

  /**
   * Update an existing favorite site's title and URL.
   */
  public static updateFavorite(id: string, newTitle: string, rawUrl: string): boolean {
    const favorites = this.getFavorites();
    const index = favorites.findIndex((f) => f.id === id);
    if (index === -1) return false;

    let url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('freedom://')) {
      url = 'https://' + url;
    }
    const cleanTitle = newTitle.trim() || url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    favorites[index] = {
      ...favorites[index],
      title: cleanTitle,
      url,
    };
    this.save(favorites);
    return true;
  }

  /**
   * Remove a favorite site by its ID.
   */
  public static removeFavorite(id: string): boolean {
    const favorites = this.getFavorites();
    const filtered = favorites.filter((f) => f.id !== id);
    if (filtered.length === favorites.length) return false;
    this.save(filtered);
    return true;
  }

  private static save(favorites: NewTabFavorite[]): void {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch (e) {
      console.warn('Failed to save newtab favorites:', e);
    }
  }
}
