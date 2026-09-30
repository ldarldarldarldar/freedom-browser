import React, { useState, useEffect } from 'react';
import { Search, Code2, Shield, Zap, Globe, Plus, Pencil, X, Settings } from 'lucide-react';
import { FreedomLogo } from '../components/FreedomLogo';
import { SearchEngineId, ThemePalette } from '../settings/types';
import { SearchEngineService } from '../services/searchEngineService';
import { SEARCH_ENGINES } from '../settings/defaults';
import { FaviconService } from '../services/faviconService';
import { FavoritesService, NewTabFavorite } from '../services/favoritesService';
import { useTranslation } from '../i18n';

interface NewTabPageProps {
  onNavigate: (url: string) => void;
  defaultSearchEngine: SearchEngineId;
  palette?: ThemePalette;
  isPerformanceMode?: boolean;
  onOpenSettings?: () => void;
  showSettingsIcon?: boolean;
  showFreedomIcon?: boolean;
}

export const NewTabPage: React.FC<NewTabPageProps> = ({
  onNavigate,
  defaultSearchEngine,
  palette,
  isPerformanceMode = false,
  onOpenSettings,
}) => {
  const { t, language } = useTranslation();
  const [query, setQuery] = useState('');
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');

  // 0 favorites by default; separate persistent storage from bookmarks
  const [favorites, setFavorites] = useState<NewTabFavorite[]>(() => FavoritesService.getFavorites());

  // Modal state for adding or editing a favorite
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFavorite, setEditingFavorite] = useState<NewTabFavorite | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [urlInput, setUrlInput] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
      setDate(
        now.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      );
    };
    updateTime();
    // In performance mode, update clock every 30s instead of 1s to eliminate idle CPU timer wakeups
    const timerInterval = isPerformanceMode ? 30000 : 1000;
    const timer = setInterval(updateTime, timerInterval);
    return () => clearInterval(timer);
  }, [isPerformanceMode, language]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const targetUrl = SearchEngineService.resolveInputToUrl(query, defaultSearchEngine);
    onNavigate(targetUrl);
  };

  const handleOpenAddModal = () => {
    setEditingFavorite(null);
    setTitleInput('');
    setUrlInput('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (fav: NewTabFavorite, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFavorite(fav);
    setTitleInput(fav.title);
    setUrlInput(fav.url);
    setIsModalOpen(true);
  };

  const handleDeleteFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    FavoritesService.removeFavorite(id);
    setFavorites(FavoritesService.getFavorites());
  };

  const handleSaveFavorite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    if (editingFavorite) {
      FavoritesService.updateFavorite(editingFavorite.id, titleInput, urlInput);
    } else {
      FavoritesService.addFavorite(titleInput, urlInput);
    }

    setFavorites(FavoritesService.getFavorites());
    setIsModalOpen(false);
  };

  const activeEngine = SEARCH_ENGINES.find((e) => e.id === defaultSearchEngine) || SEARCH_ENGINES[0];

  const cardBg = palette?.quickAccessCardBg || 'rgba(23, 23, 23, 0.4)';
  const iconBg = palette?.quickAccessIconBg || 'rgba(38, 38, 38, 0.8)';
  const accent = palette?.accentColor || '#10b981';

  return (
    <div className="relative flex flex-col items-center justify-center min-h-full px-4 py-8 text-neutral-200 select-none z-10">
      {/* Settings Shortcut Button on New Tab (permanently visible and functional in the top-right corner) */}
      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          title={t('newtab.openSettings')}
          aria-label={t('newtab.openSettings')}
          className="absolute top-5 right-6 p-2.5 rounded-xl bg-neutral-900/60 hover:bg-neutral-800/80 border border-white/10 hover:border-emerald-500/40 text-neutral-400 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 group z-20"
        >
          <Settings className="w-4 h-4 transition-transform duration-200 group-hover:rotate-45 text-neutral-300 group-hover:text-white" />
        </button>
      )}

      {/* Minimal Digital Clock */}
      <div className="mb-6 text-center">
        <div className="text-5xl md:text-6xl font-extralight tracking-tight text-neutral-100 font-mono">
          {time || '00:00'}
        </div>
        <div
          className="text-xs tracking-widest uppercase mt-1 font-medium"
          style={{ color: accent }}
        >
          {date}
        </div>
      </div>

      {/* Freedom Brand Header - clicking logo/icon opens Settings */}
      <div className="flex flex-col items-center mb-8">
        <button
          type="button"
          onClick={onOpenSettings}
          title={t('newtab.openSettings')}
          aria-label={t('newtab.openSettings')}
          className="group flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-2xl p-2 transition-all cursor-pointer hover:scale-105 active:scale-95"
        >
          <FreedomLogo size={64} className="mb-3 transition-transform group-hover:brightness-110" />
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>FREEDOM</span>
          </h1>
        </button>
        <p className="text-xs text-neutral-400 mt-1 font-mono flex items-center gap-3">
          <span className="flex items-center gap-1" style={{ color: accent }}>
            <Shield className="w-3 h-3" /> {t('newtab.brandFreedom')}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1" style={{ color: accent }}>
            <Code2 className="w-3 h-3" /> {t('newtab.brandProgramming')}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1" style={{ color: accent }}>
            <Zap className="w-3 h-3" /> {t('newtab.brandSpeed')}
          </span>
        </p>
      </div>

      {/* Central Clean Search Bar */}
      <form onSubmit={handleSearch} className="w-full max-w-xl mb-10">
        <div
          className="relative flex items-center w-full bg-neutral-900/90 hover:bg-neutral-900 border border-white/15 rounded-2xl px-4 py-3 transition-all duration-200 shadow-xl"
          style={{
            borderColor: palette?.borderColor || undefined,
            backgroundColor: palette?.inputBg || undefined,
          }}
        >
          <Search className="w-4 h-4 text-neutral-400 mr-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('newtab.searchPlaceholder', { engine: activeEngine.name })}
            className="w-full bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none"
            autoFocus
            spellCheck={false}
          />
          <button
            type="submit"
            className="ml-2 px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0"
            style={{
              backgroundColor: palette?.buttonBg || 'rgba(6, 78, 59, 0.8)',
              borderColor: palette?.borderColor || 'rgba(16, 185, 129, 0.3)',
              borderWidth: 1,
              color: accent,
            }}
          >
            {t('newtab.enter')}
          </button>
        </div>
      </form>

      {/* New Tab Favorites Section */}
      <div className="w-full max-w-xl">
        <div className={`flex items-center justify-between px-1 ${favorites.length > 0 ? 'mb-4' : ''}`}>
          <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
            {t('newtab.favorites')}
          </span>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="p-1.5 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 border border-white/10 hover:border-emerald-500/40 text-neutral-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center"
            title={t('newtab.addFavorite')}
            aria-label={t('newtab.addFavorite')}
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
          </button>
        </div>

        {favorites.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {favorites.map((fav) => {
              const iconUrl = FaviconService.getFaviconSync(fav.url);
              const domain = SearchEngineService.extractDomain(fav.url);

              return (
                <div
                  key={fav.id}
                  onClick={() => onNavigate(fav.url)}
                  className="group relative flex flex-col items-center p-3.5 rounded-2xl border border-white/5 hover:border-emerald-500/40 transition-all duration-150 cursor-pointer overflow-hidden shadow-sm hover:shadow-lg active:scale-98"
                  style={{ backgroundColor: cardBg }}
                >
                  {/* Hover Action Buttons: Edit and Remove */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button
                      type="button"
                      onClick={(e) => handleOpenEditModal(fav, e)}
                      className="p-1 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-white/10 shadow-sm transition-all"
                      title={t('newtab.editTooltip')}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteFavorite(fav.id, e)}
                      className="p-1 rounded-lg bg-neutral-900/90 hover:bg-rose-950/90 text-neutral-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 shadow-sm transition-all"
                      title={t('newtab.removeTooltip')}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Real Website Favicon Container */}
                  <div
                    className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center mb-2.5 p-2 shadow-inner group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: iconBg }}
                  >
                    {iconUrl ? (
                      <img
                        src={iconUrl}
                        alt=""
                        className="w-6 h-6 object-contain rounded-sm"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.src = FaviconService.generateMonogramSvg(fav.title);
                        }}
                      />
                    ) : (
                      <Globe className="w-5 h-5 text-neutral-400" />
                    )}
                  </div>

                  {/* Title & Domain */}
                  <span className="text-xs text-neutral-200 group-hover:text-emerald-300 font-medium truncate max-w-full text-center">
                    {fav.title}
                  </span>
                  <span className="text-[10px] text-neutral-500 font-mono mt-0.5 truncate max-w-full">
                    {domain}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Favorite Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-neutral-900 border border-white/15 rounded-2xl p-6 shadow-2xl animate-scale-in text-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
              <h3 className="text-base font-semibold text-white">
                {editingFavorite ? t('newtab.editFavorite') : t('newtab.addNewFavorite')}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFavorite} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  {t('newtab.siteName')}
                </label>
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder={t('newtab.siteNamePlaceholder')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-emerald-500/70"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  {t('newtab.webUrl')}
                </label>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder={t('newtab.webUrlPlaceholder')}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-emerald-500/70"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {t('newtab.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer"
                >
                  {editingFavorite ? t('newtab.saveChanges') : t('newtab.addToFavorites')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
