import React, { useState, useEffect } from 'react';
import { VenetianMask, Search, Globe, Plus, Pencil, X, Settings, ArrowRight, Clock, ShieldCheck, EyeOff, SlidersHorizontal } from 'lucide-react';
import { FreedomMark } from '../components/FreedomLogo';
import { HistoryService } from '../services/historyService';
import { SearchEngineId, ThemePalette } from '../settings/types';
import { NewTabWallpaper } from '../components/NewTabWallpaper';
import { useDragOffset, RESET_LAYOUT_EVENT } from '../hooks/useDragOffset';
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
  isPrivate?: boolean;
  /** Layout edit mode: title, search bar, quick links and clock can be dragged */
  isEditingLayout?: boolean;
}

export const NewTabPage: React.FC<NewTabPageProps> = ({
  onNavigate,
  defaultSearchEngine,
  isPerformanceMode = false,
  isPrivate = false,
  isEditingLayout = false,
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

  // ---- Draggable clock widget ----
  const CLOCK_POS_KEY = 'freedom_newtab_clock_pos';
  const pageRef = React.useRef<HTMLDivElement | null>(null);
  const clockRef = React.useRef<HTMLDivElement | null>(null);
  const dragOffset = React.useRef<{ dx: number; dy: number } | null>(null);
  const [isDraggingClock, setIsDraggingClock] = useState(false);
  const [clockPos, setClockPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(CLOCK_POS_KEY) || 'null');
      return v && typeof v.x === 'number' && typeof v.y === 'number' ? v : null;
    } catch {
      return null;
    }
  });

  const saveClockPos = (pos: { x: number; y: number } | null) => {
    setClockPos(pos);
    try {
      if (pos) localStorage.setItem(CLOCK_POS_KEY, JSON.stringify(pos));
      else localStorage.removeItem(CLOCK_POS_KEY);
    } catch {}
  };

  // Converts a top-left pixel point to % of the page, keeping the widget fully inside it
  const clampToPage = (left: number, top: number) => {
    const page = pageRef.current;
    const clock = clockRef.current;
    if (!page || !clock) return null;
    const pw = page.clientWidth;
    const ph = page.clientHeight;
    const x = Math.min(Math.max(0, left), Math.max(0, pw - clock.offsetWidth));
    const y = Math.min(Math.max(0, top), Math.max(0, ph - clock.offsetHeight));
    return { x: (x / pw) * 100, y: (y / ph) * 100 };
  };

  const handleClockPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !clockRef.current) return;
    const rect = clockRef.current.getBoundingClientRect();
    dragOffset.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    clockRef.current.setPointerCapture(e.pointerId);
    setIsDraggingClock(true);
  };

  const handleClockPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOffset.current || !pageRef.current) return;
    const pageRect = pageRef.current.getBoundingClientRect();
    const pos = clampToPage(e.clientX - pageRect.left - dragOffset.current.dx, e.clientY - pageRect.top - dragOffset.current.dy);
    if (pos) setClockPos(pos);
  };

  const handleClockPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOffset.current) return;
    dragOffset.current = null;
    setIsDraggingClock(false);
    clockRef.current?.releasePointerCapture?.(e.pointerId);
    if (clockPos) saveClockPos(clockPos);
  };

  const handleClockKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    const deltas: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = deltas[e.key];
    if (!d || !pageRef.current || !clockRef.current) return;
    e.preventDefault();
    const page = pageRef.current;
    const cur = clockPos ?? {
      x: (clockRef.current.offsetLeft / page.clientWidth) * 100,
      y: (clockRef.current.offsetTop / page.clientHeight) * 100,
    };
    const pos = clampToPage(((cur.x + d[0]) / 100) * page.clientWidth, ((cur.y + d[1]) / 100) * page.clientHeight);
    if (pos) saveClockPos(pos);
  };

  useEffect(() => {
    const onReset = () => saveClockPos(null);
    window.addEventListener(RESET_LAYOUT_EVENT, onReset);
    return () => window.removeEventListener(RESET_LAYOUT_EVENT, onReset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draggable New Tab blocks (translate offsets kept inside the wallpaper area)
  const titleDrag = useDragOffset('freedom_newtab_offset_title', pageRef, isEditingLayout);
  const searchDrag = useDragOffset('freedom_newtab_offset_search', pageRef, isEditingLayout);
  const linksDrag = useDragOffset('freedom_newtab_offset_links', pageRef, isEditingLayout);
  const grab = (dragging: boolean) => (isEditingLayout ? (dragging ? 'relative z-30 cursor-grabbing' : 'cursor-grab') : '');

  const [brandFirst, ...brandRest] = 'Freedom Browser'.split(' ');

  return (
    <div ref={pageRef} className="relative flex min-h-full text-[var(--fb-text)] select-none z-10">
      {/* Decorative backdrop: theme accent glow (app-level star canvas shows through) */}
      <NewTabWallpaper className="pointer-events-none" />

      <div className="relative flex-1 min-w-0 flex flex-col px-[7%] pt-[9vh] pb-8">
        {isPrivate && (
          <div id="incognito-banner" className="mb-6 max-w-[560px] flex gap-3 p-3.5 rounded-[var(--fb-radius-lg)] border border-[var(--fb-border-strong)] bg-[var(--fb-surface)]">
            <VenetianMask className="w-5 h-5 shrink-0 text-[var(--fb-text)]" strokeWidth={1.75} />
            <div>
              <div className="text-[13px] font-medium">{t('incognito.title')}</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--fb-text-2)]">{t('incognito.desc')}</p>
            </div>
          </div>
        )}

        {/* Hero (draggable within the wallpaper) */}
        <header
          id="newtab-title"
          ref={titleDrag.ref}
          {...titleDrag.handlers}
          style={titleDrag.style}
          title={isEditingLayout ? t('layout.dragHint') : undefined}
          className={`mb-[9vh] self-start w-fit touch-none ${grab(titleDrag.isDragging)}`}
        >
          <h1 className="text-[clamp(28px,4vw,var(--fb-fs-title))] font-normal tracking-tight leading-tight">
            {brandFirst}{' '}
            <span className="text-[var(--fb-accent-soft)]">{brandRest.join(' ')}</span>
          </h1>
          <p className="mt-1.5 text-[14px] text-[var(--fb-text-2)]">{t('newtab.tagline')}</p>
        </header>

        {/* Search */}
        <div
          id="newtab-search"
          ref={searchDrag.ref}
          {...searchDrag.handlers}
          style={searchDrag.style}
          className={`w-full max-w-[460px] mx-auto mb-10 touch-none ${grab(searchDrag.isDragging)}`}
        >
        <form onSubmit={handleSearch} className="w-full">
          <div className="flex items-center w-full h-11 px-4 rounded-[var(--fb-radius-pill)] border border-[var(--fb-border-strong)] bg-[var(--fb-input)] focus-within:border-emerald-500/50 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-colors shadow-[var(--fb-shadow-card)]">
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

        </div>

        {/* Favorites (speed dial) + Add button: drag the group by the Add button or the gaps */}
        <div
          id="newtab-links"
          ref={linksDrag.ref}
          {...linksDrag.handlers}
          style={linksDrag.style}
          className={`flex flex-wrap justify-center gap-x-5 gap-y-4 max-w-[560px] mx-auto touch-none ${isEditingLayout && linksDrag.isDragging ? 'relative z-30 cursor-grabbing' : ''}`}
        >
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
            id="newtab-add"
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
            <span className="block mt-1">— {t('newtab.quoteAuthor')}</span>
          </p>
        </div>
      </div>

      {/* Clock & date widget: in layout edit mode drag it anywhere over the wallpaper (position saved in % of the page) */}
      <div
        ref={clockRef}
        id="newtab-clock"
        {...(isEditingLayout
          ? {
              role: 'button',
              tabIndex: 0,
              'aria-label': t('clock.dragHint'),
              title: t('clock.dragHint'),
              'data-layout-editable': '',
              onPointerDown: handleClockPointerDown,
              onPointerMove: handleClockPointerMove,
              onPointerUp: handleClockPointerUp,
              onPointerCancel: handleClockPointerUp,
              onDoubleClick: () => saveClockPos(null),
              onKeyDown: handleClockKeyDown,
            }
          : {})}
        className={`absolute z-20 flex items-center gap-2.5 px-3.5 py-2 rounded-[var(--fb-radius-lg)] border border-[var(--fb-border)] bg-[color-mix(in_srgb,var(--fb-surface)_80%,transparent)] backdrop-blur-md touch-none ${
          isEditingLayout ? (isDraggingClock ? 'cursor-grabbing shadow-[var(--fb-shadow-pop)]' : 'cursor-grab') : ''
        }`}
        style={
          clockPos
            ? { left: `${clockPos.x}%`, top: `${clockPos.y}%` }
            : { right: '7%', bottom: '32px' }
        }
      >
        <Clock className="w-4.5 h-4.5 text-[var(--fb-text-2)] pointer-events-none" strokeWidth={1.5} />
        <div className="leading-tight pointer-events-none">
          <div className="text-[13px] tabular-nums">{time || '00:00'}</div>
          <div className="text-[10px] text-[var(--fb-text-3)]">{date}</div>
        </div>
      </div>

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
