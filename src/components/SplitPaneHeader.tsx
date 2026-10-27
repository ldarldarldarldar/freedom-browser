import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  X,
  Globe,
  ShieldCheck,
  Layers,
  Plus,
  Check,
  Search,
} from 'lucide-react';
import { BrowserTab } from '../browser/types';
import { SearchEngineId } from '../settings/types';
import { SearchEngineService } from '../services/searchEngineService';
import { SplitPane } from '../services/splitViewService';
import { useTranslation } from '../i18n';

interface SplitPaneHeaderProps {
  paneIndex: number;
  paneId: string;
  tab: BrowserTab;
  allTabs: BrowserTab[];
  allPanes: SplitPane[];
  isActive: boolean;
  canClose: boolean;
  onSelect: () => void;
  onClose: () => void;
  onBack: (tabId: string) => void;
  onForward: (tabId: string) => void;
  onReload: (tabId: string) => void;
  onNavigate: (tabId: string, url: string) => void;
  onSwitchTab: (paneId: string, targetTabId: string) => void;
  onNewTabInPane: (paneId: string) => void;
  defaultSearchEngine: SearchEngineId;
}

export const SplitPaneHeader: React.FC<SplitPaneHeaderProps> = ({
  paneIndex,
  paneId,
  tab,
  allTabs,
  allPanes,
  isActive,
  canClose,
  onSelect,
  onClose,
  onBack,
  onForward,
  onReload,
  onNavigate,
  onSwitchTab,
  onNewTabInPane,
  defaultSearchEngine,
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState(
    tab.url === 'freedom://newtab' ? '' : tab.url
  );
  const [isFocused, setIsFocused] = useState(false);
  const [isTabMenuOpen, setIsTabMenuOpen] = useState(false);
  const [tabFilter, setTabFilter] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isFocused) {
      setInputValue(tab.url === 'freedom://newtab' ? '' : tab.url);
    }
  }, [tab.url, isFocused]);

  // Close tab switch menu when clicking outside
  useEffect(() => {
    if (!isTabMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsTabMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTabMenuOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const resolved = SearchEngineService.resolveInputToUrl(inputValue, defaultSearchEngine);
    onNavigate(tab.id, resolved);
  };

  const filteredTabs = allTabs.filter((tItem) => {
    if (!tabFilter.trim()) return true;
    const q = tabFilter.toLowerCase();
    return (
      (tItem.title && tItem.title.toLowerCase().includes(q)) ||
      (tItem.url && tItem.url.toLowerCase().includes(q))
    );
  });

  return (
    <div
      onClick={onSelect}
      className={`h-9 w-full flex items-center px-2.5 select-none border-b transition-all z-30 shrink-0 relative ${
        isActive
          ? 'bg-[var(--fb-surface)] border-[var(--fb-border)] text-white'
          : 'bg-[var(--fb-bg)] border-[var(--fb-border)] text-neutral-400 hover:text-neutral-200'
      }`}
    >
      {/* Navigation Controls: Back, Forward, Reload */}
      <div className="flex items-center gap-0.5 shrink-0 mr-1.5">
        <button
          type="button"
          disabled={!tab.canGoBack}
          onClick={(e) => {
            e.stopPropagation();
            onBack(tab.id);
          }}
          className="p-1 rounded-md hover:bg-white/[0.08] disabled:opacity-25 disabled:pointer-events-none text-neutral-400 hover:text-white transition-colors"
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
          className="p-1 rounded-md hover:bg-white/[0.08] disabled:opacity-25 disabled:pointer-events-none text-neutral-400 hover:text-white transition-colors"
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
          className="p-1 rounded-md hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-colors"
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
        className={`flex-1 min-w-0 flex items-center h-7 px-2.5 rounded-lg border text-xs text-neutral-200 transition-all ${
          isFocused
            ? 'bg-[var(--fb-bg)] border-emerald-500/40 ring-1 ring-emerald-500/20 text-white'
            : 'bg-white/[0.035] hover:bg-white/[0.06] border-white/[0.08]'
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

      {/* Pane Actions: Tab Selector & Close */}
      <div className="flex items-center space-x-0.5 shrink-0 ml-1.5 relative">
        {/* Tab Selector Button */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsTabMenuOpen((prev) => !prev);
              setTabFilter('');
              onSelect();
            }}
            className={`p-1 rounded-md text-xs transition-colors flex items-center gap-1 ${
              isTabMenuOpen
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.08]'
            }`}
            title={t('split.switchTab')}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          {/* Tab Selector Popover Menu */}
          {isTabMenuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1.5 w-64 max-h-80 bg-neutral-900/98 border border-white/10 rounded-xl shadow-2xl p-1 z-50 flex flex-col text-xs text-neutral-200 animate-fade-in backdrop-blur-xl"
            >
              <div className="px-2.5 py-1.5 border-b border-white/[0.08] flex items-center justify-between">
                <span className="font-semibold text-white tracking-wide">
                  {t('split.selectTabForPane')}
                </span>
                <span className="text-[10px] font-mono text-neutral-400">
                  {allTabs.length} {t('split.tabsCount')}
                </span>
              </div>

              {/* Filter input */}
              {allTabs.length > 4 && (
                <div className="px-2 pt-2 pb-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-black/40 border border-white/10 rounded-lg">
                    <Search className="w-3 h-3 text-neutral-400 shrink-0" />
                    <input
                      type="text"
                      value={tabFilter}
                      onChange={(e) => setTabFilter(e.target.value)}
                      placeholder={t('tabBar.searchTabs')}
                      className="w-full bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Tabs List */}
              <div className="overflow-y-auto no-scrollbar max-h-52 px-1 py-1 space-y-0.5">
                {filteredTabs.map((tItem) => {
                  const isCurrentInThisPane = tItem.id === tab.id;
                  const otherPane = allPanes.find(
                    (p) => p.tabId === tItem.id && p.id !== paneId
                  );
                  const isNewTabItem = tItem.url === 'freedom://newtab';
                  const title = isNewTabItem
                    ? 'New Tab'
                    : tItem.title || tItem.url;

                  return (
                    <button
                      key={tItem.id}
                      type="button"
                      onClick={() => {
                        setIsTabMenuOpen(false);
                        onSwitchTab(paneId, tItem.id);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center gap-2 transition-colors group cursor-pointer ${
                        isCurrentInThisPane
                          ? 'bg-emerald-500/20 text-white font-medium border border-emerald-500/30'
                          : 'hover:bg-white/10 text-neutral-300 hover:text-white'
                      }`}
                    >
                      <div className="shrink-0 flex items-center">
                        {tItem.url.startsWith('freedom://') ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        ) : tItem.favicon ? (
                          <img
                            src={tItem.favicon}
                            alt=""
                            className="w-3.5 h-3.5 object-contain rounded-xs"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="truncate text-xs">{title}</div>
                        <div className="truncate text-[10px] text-neutral-500 font-mono">
                          {tItem.url}
                        </div>
                      </div>

                      {isCurrentInThisPane && (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )}

                      {otherPane && !isCurrentInThisPane && (
                        <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-white/10 shrink-0">
                          {otherPane.id.replace('pane-', 'P')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Action: Open New Tab in Pane */}
              <div className="pt-1.5 px-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setIsTabMenuOpen(false);
                    onNewTabInPane(paneId);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-center gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('split.newTabInPane')}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Close Pane Button */}
        {canClose && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 rounded-md text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title={t('split.closePaneTooltip')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
