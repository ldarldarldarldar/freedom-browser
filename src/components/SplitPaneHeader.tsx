import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, X, Globe, ShieldCheck } from 'lucide-react';
import { BrowserTab } from '../browser/types';
import { SearchEngineId } from '../settings/types';
import { SearchEngineService } from '../services/searchEngineService';
import { useTranslation } from '../i18n';

interface SplitPaneHeaderProps {
  pane: 'left' | 'right';
  tab: BrowserTab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onBack: (tabId: string) => void;
  onForward: (tabId: string) => void;
  onReload: (tabId: string) => void;
  onNavigate: (tabId: string, url: string) => void;
  defaultSearchEngine: SearchEngineId;
}

export const SplitPaneHeader: React.FC<SplitPaneHeaderProps> = ({
  pane,
  tab,
  isActive,
  onSelect,
  onClose,
  onBack,
  onForward,
  onReload,
  onNavigate,
  defaultSearchEngine,
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState(
    tab.url === 'freedom://newtab' ? '' : tab.url
  );
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setInputValue(tab.url === 'freedom://newtab' ? '' : tab.url);
    }
  }, [tab.url, isFocused]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const resolved = SearchEngineService.resolveInputToUrl(inputValue, defaultSearchEngine);
    onNavigate(tab.id, resolved);
  };

  return (
    <div
      onClick={onSelect}
      className={`h-9 w-full flex items-center px-2 select-none border-b transition-colors z-20 shrink-0 ${
        isActive
          ? 'bg-neutral-900 border-emerald-500/40 shadow-sm'
          : 'bg-neutral-950 border-white/10 opacity-80 hover:opacity-100'
      }`}
    >
      {/* Navigation Controls: Back, Forward, Reload */}
      <div className="flex items-center space-x-0.5 shrink-0 mr-1.5">
        <button
          type="button"
          disabled={!tab.canGoBack}
          onClick={(e) => {
            e.stopPropagation();
            onBack(tab.id);
          }}
          className="p-1 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-neutral-300 hover:text-white transition-colors"
          title={t('nav.back')}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={!tab.canGoForward}
          onClick={(e) => {
            e.stopPropagation();
            onForward(tab.id);
          }}
          className="p-1 rounded-md hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none text-neutral-300 hover:text-white transition-colors"
          title={t('nav.forward')}
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReload(tab.id);
          }}
          className="p-1 rounded-md hover:bg-white/10 text-neutral-300 hover:text-white transition-colors"
          title={t('nav.reload')}
        >
          <RotateCcw
            className={`w-3.5 h-3.5 ${
              tab.isLoading ? 'animate-spin text-emerald-400' : ''
            }`}
          />
        </button>
      </div>

      {/* Pane Address Form */}
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className={`flex-1 min-w-0 flex items-center bg-black/40 hover:bg-black/60 border rounded-lg px-2 py-0.5 text-xs text-neutral-200 transition-all ${
          isFocused ? 'border-emerald-500/60 ring-1 ring-emerald-500/20' : 'border-white/10'
        }`}
      >
        <div className="mr-1.5 shrink-0 flex items-center">
          {tab.url.startsWith('freedom://') ? (
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
          ) : tab.favicon ? (
            <img
              src={tab.favicon}
              alt=""
              className="w-3 h-3 object-contain rounded-xs"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <Globe className="w-3 h-3 text-neutral-400" />
          )}
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            onSelect();
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={t('split.searchPlaceholder')}
          className="w-full bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none truncate font-sans"
          spellCheck={false}
          autoComplete="off"
        />
      </form>

      {/* Active Pane indicator & Close button */}
      <div className="flex items-center space-x-1.5 shrink-0 ml-2">
        {isActive ? (
          <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {t('split.active')}
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="text-[10px] font-mono text-neutral-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
            title={t('split.focusTooltip')}
          >
            {t('split.focus')}
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="p-1 rounded-md text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          title={t('split.closePane', { pane: pane === 'left' ? t('split.leftPane') : t('split.rightPane') })}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
