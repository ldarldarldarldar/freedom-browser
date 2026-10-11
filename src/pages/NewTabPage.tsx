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
          className="absolute top-5 right-6 p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-neutral-400 hover:text-white transition-colors cursor-pointer active:scale-95 group z-20"
        >
          <Settings className="w-4 h-4 transition-transform duration-200 group-hover:rotate-45 text-neutral-400 group-hover:text-white" />
        </button>
      )}

      {/* Minimal Digital Clock & Date */}
      <div className="mb-7 text-center">
        <div className="text-6xl md:text-7xl font-extralight tracking-tight text-white font-mono">
          {time || '00:00'}
        </div>
        <div className="text-xs tracking-[0.25em] uppercase mt-2 font-mono text-neutral-400 font-medium">
          {date}
        </div>
      </div>

      {/* Freedom Brand Header */}
      <div className="flex flex-col items-center mb-8">
        <button
          type="button"
          onClick={onOpenSettings}
          title={t('newtab.openSettings')}
          aria-label={t('newtab.openSettings')}
          className="group flex flex-col items-center focus:outline-none rounded-2xl p-2 transition-all cursor-pointer hover:scale-102 active:scale-98"
        >
          <FreedomLogo size={60} className="mb-2.5 transition-transform group-hover:brightness-110" />
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>FREEDOM</span>
          </h1>
        </button>

        <div className="inline-flex items-center gap-3 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-[11px] font-mono text-neutral-400 mt-1">
          <span className="flex items-center gap-1 text-emerald-400">
            <Shield className="w-3 h-3" /> {t('newtab.brandFreedom')}
          </span>
          <span className="text-neutral-700">•</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <Code2 className="w-3 h-3" /> {t('newtab.brandProgramming')}
          </span>
          <span className="text-neutral-700">•</span>
          <span className="flex items-center gap-1 text-emerald-400">
            <Zap className="w-3 h-3" /> {t('newtab.brandSpeed')}
          </span>
        </div>
      </div>

      {/* Central Command-Style Search Bar */}
      <form onSubmit={handleSearch} className="w-full max-w-2xl mb-9">
        <div
          className="relative flex items-center w-full h-13 bg-white/[0.035] hover:bg-white/[0.055] focus-within:bg-[#0f1118] border border-white/12 focus-within:border-emerald-500/50 focus-within:ring-4 focus-within:ring-emerald-500/15 rounded-2xl px-4 transition-all duration-200 shadow-xl"
          style={{
            borderColor: palette?.borderColor || undefined,
            backgroundColor: palette?.inputBg || undefined,
          }}
        >
          <Search className="w-4.5 h-4.5 text-neutral-400 mr-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('newtab.searchPlaceholder', { engine: activeEngine.name })}
            className="w-full bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none font-normal"
            autoFocus
            spellCheck={false}
          />

          <button
            type="submit"
            className="ml-2 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white/[0.08] hover:bg-white/[0.12] text-neutral-200 hover:text-white border border-white/[0.08] transition-colors cursor-pointer shrink-0"
          >
            {t('newtab.enter')}
          </button>
        </div>
      </form>

      {/* New Tab Favorites Section */}
      <div className="w-full max-w-2xl">
        <div className={`flex items-center justify-between px-1 ${favorites.length > 0 ? 'mb-3.5' : 'mb-2'}`}>
          <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 font-semibold">
            {t('newtab.favorites')}
          </span>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-neutral-400 hover:text-white transition-all cursor-pointer active:scale-95 flex items-center justify-center"
            title={t('newtab.addFavorite')}
            aria-label={t('newtab.addFavorite')}
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
          </button>
        </div>

        {favorites.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3">
            {favorites.map((fav) => {
              const iconUrl = FaviconService.getFaviconSync(fav.url);
              const domain = SearchEngineService.extractDomain(fav.url);

              return (
                <div
                  key={fav.id}
                  onClick={() => onNavigate(fav.url)}
                  className="group relative flex flex-col items-center p-3.5 rounded-2xl border border-white/[0.06] hover:border-white/15 bg-white/[0.025] hover:bg-white/[0.06] transition-all duration-200 cursor-pointer overflow-hidden shadow-xs hover:shadow-xl active:scale-98"
                  style={{ backgroundColor: cardBg }}
                >
                  {/* Hover Action Buttons: Edit and Remove */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <button
                      type="button"
                      onClick={(e) => handleOpenEditModal(fav, e)}
                      className="p-1 rounded-md bg-neutral-900/95 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-white/10 shadow-xs transition-colors"
                      title={t('newtab.editTooltip')}
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteFavorite(fav.id, e)}
                      className="p-1 rounded-md bg-neutral-900/95 hover:bg-rose-950/80 text-neutral-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 shadow-xs transition-colors"
                      title={t('newtab.removeTooltip')}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>

                  {/* Website Favicon Container */}
                  <div
                    className="w-11 h-11 rounded-xl border border-white/[0.08] flex items-center justify-center mb-2.5 p-2 shadow-xs group-hover:scale-105 group-hover:border-emerald-500/30 transition-all"
                    style={{ backgroundColor: iconBg }}
                  >
                    {iconUrl ? (
                      <img
                        src={iconUrl}
                        alt=""
                        className="w-6 h-6 object-contain rounded-xs"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.src = FaviconService.generateMonogramSvg(fav.title);
                        }}
                      />
                    ) : (
                      <Globe className="w-5 h-5 text-neutral-500" />
                    )}
                  </div>

                  {/* Title & Domain */}
                  <span className="text-xs text-neutral-200 group-hover:text-white font-medium truncate max-w-full text-center tracking-tight">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-neutral-900/98 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-2xl animate-scale-in text-neutral-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/[0.08]">
              <h3 className="text-sm font-semibold text-white tracking-tight">
                {editingFavorite ? t('newtab.editFavorite') : t('newtab.addNewFavorite')}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
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
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950/80 border border-white/10 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
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
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950/80 border border-white/10 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  {t('newtab.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 shadow-xs transition-colors cursor-pointer"
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
