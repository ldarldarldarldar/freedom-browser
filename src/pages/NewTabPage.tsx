import React, { useState, useEffect } from 'react';
import { Search, Globe, Plus, Pencil, X, Settings, ArrowRight, Clock, ShieldCheck, EyeOff, SlidersHorizontal } from 'lucide-react';
import { FreedomMark } from '../components/FreedomLogo';
import { HistoryService } from '../services/historyService';
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

  // Most recent distinct sites for the side panel ("Недавние вкладки")
  const recent = React.useMemo(() => {
    const seen = new Set<string>();
    return HistoryService.getHistory()
      .slice()
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .filter((h) => {
        const d = SearchEngineService.extractDomain(h.url);
        if (!d || h.url.startsWith('freedom://') || seen.has(d)) return false;
        seen.add(d);
        return true;
      })
      .slice(0, 3);
  }, []);

  const features = [
    { icon: ShieldCheck, title: t('newtab.featTrackers'), sub: t('newtab.featTrackersSub') },
    { icon: EyeOff, title: t('newtab.featStealth'), sub: t('newtab.featStealthSub') },
    { icon: SlidersHorizontal, title: t('newtab.featSettings'), sub: t('newtab.featSettingsSub') },
  ];

  const [brandFirst, ...brandRest] = 'Freedom Browser'.split(' ');

  return (
    <div className="relative flex min-h-full text-[var(--fb-text)] select-none z-10">
      {/* Decorative backdrop: original CSS/SVG art (light beam over dark ridges) */}
      <div className="newtab-art pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="newtab-art__beam" />
        <svg className="absolute bottom-0 left-0 w-full h-[46%]" viewBox="0 0 1200 400" preserveAspectRatio="none">
          <path d="M0 250 L140 170 L260 230 L380 120 L520 210 L600 60 L690 200 L820 140 L960 230 L1080 160 L1200 220 V400 H0Z" fill="var(--fb-surface)" opacity="0.55" />
          <path d="M0 310 L180 250 L330 300 L470 240 L600 290 L760 230 L900 300 L1050 250 L1200 290 V400 H0Z" fill="var(--fb-bg)" opacity="0.9" />
        </svg>
      </div>

      <div className="relative flex-1 min-w-0 flex flex-col px-[7%] pt-[9vh] pb-8">
        {/* Hero */}
        <header className="mb-[9vh]">
          <h1 className="text-[clamp(28px,4vw,var(--fb-fs-title))] font-normal tracking-tight leading-tight">
            {brandFirst}{' '}
            <span className="text-[var(--fb-accent-soft)]">{brandRest.join(' ')}</span>
          </h1>
          <p className="mt-1.5 text-[14px] text-[var(--fb-text-2)]">{t('newtab.tagline')}</p>
        </header>

        {/* Search */}
        <form onSubmit={handleSearch} className="w-full max-w-[460px] mx-auto mb-10">
          <div className="flex items-center w-full h-11 px-4 rounded-[var(--fb-radius-pill)] border border-[var(--fb-border-strong)] bg-[color-mix(in_srgb,var(--fb-input)_88%,transparent)] backdrop-blur-md focus-within:border-emerald-500/50 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-colors shadow-[var(--fb-shadow-card)]">
            <Search className="w-4 h-4 text-[var(--fb-text-2)] mr-3 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('newtab.searchPlaceholder', { engine: activeEngine.name })}
              aria-label={t('newtab.searchPlaceholder', { engine: activeEngine.name })}
              className="w-full bg-transparent text-[13px] text-[var(--fb-text)] placeholder-[var(--fb-text-3)] focus:outline-none"
              autoFocus
              spellCheck={false}
            />
            <button
              type="submit"
              title={t('newtab.enter')}
              aria-label={t('newtab.enter')}
              className="ml-2 w-7 h-7 flex items-center justify-center rounded-full text-[var(--fb-text-2)] hover:text-[var(--fb-text)] hover:bg-[var(--fb-surface-hover)] shrink-0"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Favorites (speed dial) */}
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-4 max-w-[560px] mx-auto">
          {favorites.map((fav, index) => {
            const iconUrl = FaviconService.getFaviconSync(fav.url);
            return (
              <div
                key={fav.id}
                role="link"
                tabIndex={0}
                onClick={() => onNavigate(fav.url)}
                onKeyDown={(e) => e.key === 'Enter' && onNavigate(fav.url)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-freedom-favorite', fav.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes('application/x-freedom-favorite')) e.preventDefault();
                }}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData('application/x-freedom-favorite');
                  if (!id) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setFavorites(FavoritesService.moveFavorite(id, index));
                }}
                title={`${fav.title} — ${SearchEngineService.extractDomain(fav.url)}`}
                className="group relative flex flex-col items-center w-16 cursor-pointer"
              >
                <div className="relative w-13 h-13 rounded-[var(--fb-radius-lg)] border border-[var(--fb-border)] bg-[var(--fb-surface)] group-hover:bg-[var(--fb-surface-hover)] group-hover:border-[var(--fb-border-strong)] flex items-center justify-center transition-colors shadow-[var(--fb-shadow-card)]">
                  {iconUrl ? (
                    <img
                      src={iconUrl}
                      alt=""
                      className="w-6 h-6 object-contain"
                      onError={(e) => {
                        e.currentTarget.src = FaviconService.generateMonogramSvg(fav.title);
                      }}
                    />
                  ) : (
                    <Globe className="w-5 h-5 text-[var(--fb-text-3)]" />
                  )}
                  <div className="absolute -top-1.5 -right-1.5 flex gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => handleOpenEditModal(fav, e)}
                      className="p-0.5 rounded bg-[var(--fb-surface-3)] text-[var(--fb-text-2)] hover:text-[var(--fb-text)]"
                      title={t('newtab.editTooltip')}
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteFavorite(fav.id, e)}
                      className="p-0.5 rounded bg-[var(--fb-surface-3)] text-[var(--fb-text-2)] hover:text-[var(--fb-danger)]"
                      title={t('newtab.removeTooltip')}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
                <span className="mt-1.5 text-[11px] text-[var(--fb-text-2)] group-hover:text-[var(--fb-text)] truncate max-w-full">
                  {fav.title}
                </span>
              </div>
            );
          })}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="group flex flex-col items-center w-16"
            title={t('newtab.addFavorite')}
          >
            <span className="w-13 h-13 rounded-[var(--fb-radius-lg)] border border-[var(--fb-border)] bg-[var(--fb-surface)] group-hover:bg-[var(--fb-surface-hover)] flex items-center justify-center transition-colors">
              <Plus className="w-5 h-5 text-[var(--fb-text-2)]" strokeWidth={1.5} />
            </span>
            <span className="mt-1.5 text-[11px] text-[var(--fb-text-2)] group-hover:text-[var(--fb-text)]">{t('newtab.add')}</span>
          </button>
        </div>

        {/* Footer: quote + clock widget */}
        <div className="mt-auto pt-10 flex items-end justify-between gap-6">
          <p className="max-w-[300px] text-[11px] leading-relaxed text-[var(--fb-text-3)]">
            {t('newtab.quote')}
            <span className="block mt-1">—</span>
          </p>
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-[var(--fb-radius-lg)] border border-[var(--fb-border)] bg-[color-mix(in_srgb,var(--fb-surface)_80%,transparent)] backdrop-blur-md">
            <Clock className="w-4.5 h-4.5 text-[var(--fb-text-2)]" strokeWidth={1.5} />
            <div className="leading-tight">
              <div className="text-[13px] tabular-nums">{time || '00:00'}</div>
              <div className="text-[10px] text-[var(--fb-text-3)]">{date}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right info panel (hidden on narrow windows) */}
      <aside className="relative hidden xl:flex flex-col self-start w-[260px] shrink-0 m-3 ml-0 p-4 rounded-[var(--fb-radius-lg)] border border-[var(--fb-border)] bg-[color-mix(in_srgb,var(--fb-surface)_92%,transparent)] backdrop-blur-md">
        <button
          type="button"
          onClick={onOpenSettings}
          title={t('newtab.openSettings')}
          className="flex items-center gap-2.5 -mx-1 px-1 py-1 rounded-[var(--fb-radius-md)] hover:bg-[var(--fb-surface-hover)] text-left"
        >
          <FreedomMark size={16} className="text-[var(--fb-text)]" />
          <span className="text-[13px] font-medium">Freedom</span>
          <Settings className="ml-auto w-3.5 h-3.5 text-[var(--fb-text-3)]" />
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--fb-text-2)]">{t('newtab.aboutTitle')}</p>

        <ul className="mt-5 space-y-4">
          {features.map(({ icon: Icon, title, sub }) => (
            <li key={title} className="flex gap-3">
              <span className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full border border-[var(--fb-border-strong)]">
                <Icon className="w-3.5 h-3.5 text-[var(--fb-text-2)]" strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px]">{title}</span>
                <span className="block text-[10.5px] text-[var(--fb-text-3)]">{sub}</span>
              </span>
            </li>
          ))}
        </ul>

        {recent.length > 0 && (
          <>
            <h2 className="mt-7 mb-2.5 text-[11px] text-[var(--fb-text-2)]">{t('newtab.recent')}</h2>
            <ul className="space-y-1">
              {recent.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(h.url)}
                    className="w-full flex items-center gap-2.5 -mx-1 px-1 py-1 rounded-[var(--fb-radius-md)] hover:bg-[var(--fb-surface-hover)] text-left"
                  >
                    <img
                      src={h.favicon || FaviconService.getFaviconSync(h.url) || FaviconService.generateMonogramSvg(h.title)}
                      alt=""
                      className="w-3.5 h-3.5 shrink-0 rounded-sm"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[12px]">{h.title || h.url}</span>
                      <span className="block truncate text-[10px] text-[var(--fb-text-3)]">
                        {SearchEngineService.extractDomain(h.url)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>

      {/* Add / Edit Favorite Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-[var(--fb-surface)] border border-[var(--fb-border)] rounded-[var(--fb-radius-xl)] p-6 shadow-[var(--fb-shadow-pop)] animate-scale-in text-neutral-200"
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
                  className="w-full px-3 py-2 rounded-[var(--fb-radius-md)] bg-[var(--fb-input)] border border-[var(--fb-border)] text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
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
                  className="w-full px-3 py-2 rounded-[var(--fb-radius-md)] bg-[var(--fb-input)] border border-[var(--fb-border)] text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
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
