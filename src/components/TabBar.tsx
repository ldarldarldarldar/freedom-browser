import React from 'react';
import { Plus, X, Globe, Moon, Volume2, VolumeX, ShieldCheck, RotateCcw } from 'lucide-react';
import { BrowserTab } from '../browser/types';

interface TabBarProps {
  tabs: BrowserTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onDuplicateTab?: (id: string) => void;
  onToggleMuteTab?: (id: string) => void;
  headerColorClass?: string;
  onRestoreClosedTab?: () => void;
  closedTabsCount?: number;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onToggleMuteTab,
  headerColorClass = 'bg-[#090b10]',
  onRestoreClosedTab,
  closedTabsCount = 0,
}) => {
  return (
    <div
      id="browser-tab-bar"
      className={`flex items-center h-10 px-2 select-none border-b border-white/5 relative z-20 ${headerColorClass} overflow-x-auto no-scrollbar`}
      onDoubleClick={(e) => {
        // Double-clicking empty space creates a new tab
        if ((e.target as HTMLElement).id === 'browser-tab-bar' || (e.target as HTMLElement).id === 'tab-bar-empty-area') {
          onNewTab();
        }
      }}
    >
      <div className="flex items-center flex-1 min-w-0 max-w-full space-x-1">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;

          return (
            <div
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => onSelectTab(tab.id)}
              onAuxClick={(e) => {
                // Middle click to close tab
                if (e.button === 1) {
                  e.preventDefault();
                  onCloseTab(tab.id);
                }
              }}
              title={`${tab.title} (${tab.url})${tab.isSuspended ? ' - Suspended to save RAM' : ''}`}
              className={`group relative flex items-center h-7.5 px-3 rounded-lg text-xs transition-all duration-150 cursor-pointer min-w-[120px] max-w-[220px] flex-1 border ${
                isActive
                  ? 'bg-neutral-900/90 text-white border-white/10 shadow-sm'
                  : 'bg-transparent text-neutral-400 hover:text-neutral-200 hover:bg-white/5 border-transparent'
              }`}
            >
              {/* Active Tab Accent Line */}
              {isActive && (
                <div className="absolute top-0 left-2 right-2 h-[2px] bg-emerald-400 rounded-full" />
              )}

              {/* Favicon or Loading Spinner */}
              <div className="mr-2 shrink-0 flex items-center">
                {tab.isLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                ) : tab.isSuspended ? (
                  <Moon className="w-3.5 h-3.5 text-neutral-500" title="Tab Suspended (RAM Freed)" />
                ) : tab.favicon ? (
                  <img
                    src={tab.favicon}
                    alt=""
                    className="w-3.5 h-3.5 rounded-sm object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : tab.url.startsWith('freedom://') ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-neutral-400" />
                )}
              </div>

              {/* Title */}
              <span className={`truncate flex-1 font-medium ${tab.isSuspended ? 'opacity-60 italic' : ''}`}>
                {tab.title || (tab.url.startsWith('freedom://') ? 'Freedom Tab' : tab.url)}
              </span>

              {/* Audio Indicator if active */}
              {tab.isAudioPlaying && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMuteTab?.(tab.id);
                  }}
                  className="mr-1.5 p-0.5 text-emerald-400 hover:text-white rounded"
                  title={tab.isMuted ? 'Unmute tab' : 'Mute tab'}
                >
                  {tab.isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </button>
              )}

              {/* Close Tab Button */}
              <button
                id={`tab-close-${tab.id}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                className={`p-1 rounded-md ml-1 transition-all ${
                  isActive
                    ? 'opacity-70 hover:opacity-100 hover:bg-white/10 text-neutral-300 hover:text-white'
                    : 'opacity-0 group-hover:opacity-100 hover:bg-white/10 text-neutral-400 hover:text-white'
                }`}
                title="Close tab (Ctrl+W)"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {/* New Tab "+" Button */}
        <button
          id="btn-new-tab"
          type="button"
          onClick={onNewTab}
          className="flex items-center justify-center w-7 h-7 ml-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 active:scale-95 transition-all"
          title="New tab (Ctrl+T)"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Restore Recently Closed Tab Button */}
        {onRestoreClosedTab && closedTabsCount > 0 && (
          <button
            id="btn-restore-closed-tab"
            type="button"
            onClick={onRestoreClosedTab}
            className="flex items-center justify-center w-7 h-7 ml-0.5 rounded-lg text-neutral-400 hover:text-emerald-400 hover:bg-white/5 active:scale-95 transition-all"
            title={`Restore closed tab (Ctrl+Shift+T) - ${closedTabsCount} available`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Empty space for double clicking */}
        <div id="tab-bar-empty-area" className="flex-1 h-full cursor-default" />
      </div>
    </div>
  );
};
