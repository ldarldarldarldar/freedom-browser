import React, { useState, useEffect } from 'react';
import { Search, Code2, Shield, Zap, Globe } from 'lucide-react';
import { FreedomLogo } from '../components/FreedomLogo';
import { SearchEngineId, ThemePalette } from '../settings/types';
import { SearchEngineService } from '../services/searchEngineService';
import { SEARCH_ENGINES } from '../settings/defaults';
import { FaviconService } from '../services/faviconService';

interface Shortcut {
  title: string;
  url: string;
  category: string;
}

const QUICK_SHORTCUTS: Shortcut[] = [
  { title: 'DuckDuckGo', url: 'https://duckduckgo.com', category: 'Privacy Search' },
  { title: 'GitHub', url: 'https://github.com', category: 'Code Repository' },
  { title: 'YouTube', url: 'https://youtube.com', category: 'Video Streaming' },
  { title: 'ChatGPT', url: 'https://chatgpt.com', category: 'AI Assistant' },
  { title: 'Wikipedia', url: 'https://wikipedia.org', category: 'Encyclopedia' },
  { title: 'Reddit', url: 'https://reddit.com', category: 'Discussions' },
  { title: 'Rust Lang', url: 'https://www.rust-lang.org', category: 'Systems Language' },
  { title: 'Discord Web', url: 'https://discord.com/app', category: 'Communities' },
];

interface NewTabPageProps {
  onNavigate: (url: string) => void;
  defaultSearchEngine: SearchEngineId;
  palette?: ThemePalette;
  isPerformanceMode?: boolean;
  onOpenSettings?: () => void;
}

export const NewTabPage: React.FC<NewTabPageProps> = ({
  onNavigate,
  defaultSearchEngine,
  palette,
  isPerformanceMode = false,
  onOpenSettings,
}) => {
  const [query, setQuery] = useState('');
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [icons] = useState<Record<string, string>>(() => {
    const loaded: Record<string, string> = {};
    for (const item of QUICK_SHORTCUTS) {
      loaded[item.url] = FaviconService.getFaviconSync(item.url);
    }
    return loaded;
  });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
      setDate(
        now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      );
    };
    updateTime();
    // In performance mode, update clock every 30s instead of 1s to eliminate idle CPU timer wakeups
    const timerInterval = isPerformanceMode ? 30000 : 1000;
    const timer = setInterval(updateTime, timerInterval);
    return () => clearInterval(timer);
  }, [isPerformanceMode]);


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const targetUrl = SearchEngineService.resolveInputToUrl(query, defaultSearchEngine);
    onNavigate(targetUrl);
  };

  const activeEngine = SEARCH_ENGINES.find((e) => e.id === defaultSearchEngine) || SEARCH_ENGINES[0];

  const cardBg = palette?.quickAccessCardBg || 'rgba(23, 23, 23, 0.4)';
  const iconBg = palette?.quickAccessIconBg || 'rgba(38, 38, 38, 0.8)';
  const accent = palette?.accentColor || '#10b981';

  return (
    <div className="relative flex flex-col items-center justify-center min-h-full px-4 py-8 text-neutral-200 select-none z-10">
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
          title="Open Settings"
          aria-label="Open Settings"
          className="group flex flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-2xl p-2 transition-all cursor-pointer hover:scale-105 active:scale-95"
        >
          <FreedomLogo size={64} className="mb-3 transition-transform group-hover:brightness-110" />
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>FREEDOM</span>
          </h1>
        </button>
        <p className="text-xs text-neutral-400 mt-1 font-mono flex items-center gap-3">
          <span className="flex items-center gap-1" style={{ color: accent }}>
            <Shield className="w-3 h-3" /> Freedom
          </span>
          <span>•</span>
          <span className="flex items-center gap-1" style={{ color: accent }}>
            <Code2 className="w-3 h-3" /> Programming
          </span>
          <span>•</span>
          <span className="flex items-center gap-1" style={{ color: accent }}>
            <Zap className="w-3 h-3" /> Speed
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
            placeholder={`Search the web or type a URL (${activeEngine.name})...`}
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
            Enter
          </button>
        </div>
      </form>

      {/* Quick Shortcuts Grid with Real Website Favicons */}
      <div className="w-full max-w-xl">
        <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-500 mb-3 text-center flex items-center justify-center gap-2">
          <span>Quick Access</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {QUICK_SHORTCUTS.map((shortcut) => {
            const iconUrl = icons[shortcut.url] || FaviconService.getFaviconSync(shortcut.url);

            return (
              <button
                key={shortcut.url}
                type="button"
                onClick={() => onNavigate(shortcut.url)}
                className="group flex flex-col items-center p-3 rounded-xl border border-white/5 transition-all duration-150 relative overflow-hidden"
                style={{
                  backgroundColor: cardBg,
                }}
              >
                {/* Real Website Favicon Container */}
                <div
                  className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center mb-2 p-2 shadow-inner group-hover:scale-105 transition-transform"
                  style={{
                    backgroundColor: iconBg,
                  }}
                >
                  {iconUrl ? (
                    <img
                      src={iconUrl}
                      alt={shortcut.title}
                      className="w-6 h-6 object-contain"
                      loading="lazy"
                      onError={(e) => {
                        // If image load fails, replace with monogram
                        const target = e.currentTarget;
                        target.src = FaviconService.generateMonogramSvg(shortcut.title);
                      }}
                    />
                  ) : (
                    <Globe className="w-5 h-5 text-neutral-400" />
                  )}
                </div>
                <span className="text-xs text-neutral-200 group-hover:text-emerald-300 font-medium truncate max-w-full text-center">
                  {shortcut.title}
                </span>
                <span className="text-[9px] text-neutral-500 font-mono mt-0.5 truncate max-w-full">
                  {shortcut.category}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
