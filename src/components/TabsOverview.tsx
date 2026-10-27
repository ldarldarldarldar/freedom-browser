import React, { useEffect } from 'react';
import { X, Plus, Globe, ArrowUpDown } from 'lucide-react';
import { BrowserTab } from '../browser/types';
import { FreedomMark } from './FreedomLogo';
import { useTranslation } from '../i18n';

interface TabsOverviewProps {
  tabs: BrowserTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onSort?: () => void;
  onClose: () => void;
}

const hostOf = (url: string) => {
  if (url === 'freedom://newtab') return 'about:blank';
  try {
    return new URL(url).hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
};

/** Grid of open tabs ("Вкладки" panel in the reference). */
export const TabsOverview: React.FC<TabsOverviewProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onSort,
  onClose,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      id="tabs-overview"
      role="dialog"
      aria-label={t('tabsOverview.title')}
      className="absolute inset-0 z-40 flex flex-col bg-[var(--fb-bg)] animate-fade-in"
    >
      <div className="flex items-center justify-between h-11 px-5 border-b border-[var(--fb-border)]">
        <h2 className="text-[13px] font-medium text-[var(--fb-text)]">{t('tabsOverview.title')}</h2>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-[var(--fb-radius-sm)] text-[var(--fb-text-2)] hover:text-[var(--fb-text)] hover:bg-[var(--fb-surface-hover)]"
          title="Esc"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isNew = tab.url === 'freedom://newtab';
            const title = isNew ? t('tab.newTab') : tab.title || tab.url;
            return (
              <div key={tab.id} className="flex flex-col gap-1.5 min-w-0">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    onSelectTab(tab.id);
                    onClose();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onSelectTab(tab.id);
                      onClose();
                    }
                  }}
                  className={`group flex flex-col h-32 rounded-[var(--fb-radius-lg)] overflow-hidden cursor-pointer border transition-colors ${
                    isActive
                      ? 'border-[color-mix(in_srgb,var(--fb-accent)_55%,transparent)] bg-[var(--fb-surface-hover)]'
                      : 'border-[var(--fb-border)] bg-[var(--fb-surface)] hover:bg-[var(--fb-surface-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2 h-8 px-2.5 shrink-0">
                    {tab.favicon && !isNew ? (
                      <img src={tab.favicon} alt="" className="w-3.5 h-3.5 rounded-sm" />
                    ) : isNew ? (
                      <FreedomMark size={13} className="text-[var(--fb-text-2)]" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 text-[var(--fb-text-3)]" />
                    )}
                    <span className="flex-1 truncate text-[12px] text-[var(--fb-text)]">{title}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(tab.id);
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded text-[var(--fb-text-3)] hover:text-[var(--fb-text)] hover:bg-[var(--fb-surface-3)]"
                      title={t('tab.close')}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex-1 mx-1.5 mb-1.5 rounded-[var(--fb-radius-md)] bg-[var(--fb-bg)] flex items-center justify-center">
                    {isNew ? (
                      <Plus className="w-6 h-6 text-[var(--fb-text-3)]" strokeWidth={1.5} />
                    ) : tab.favicon ? (
                      <img src={tab.favicon} alt="" className="w-8 h-8 opacity-80" />
                    ) : (
                      <Globe className="w-7 h-7 text-[var(--fb-text-3)]" strokeWidth={1.5} />
                    )}
                  </div>
                </div>
                <span className="px-1 truncate text-[11px] text-[var(--fb-text-3)]">{hostOf(tab.url)}</span>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => {
              onNewTab();
              onClose();
            }}
            className="flex flex-col items-center justify-center gap-2 h-32 rounded-[var(--fb-radius-lg)] border border-dashed border-[var(--fb-border-strong)] text-[var(--fb-text-2)] hover:text-[var(--fb-text)] hover:bg-[var(--fb-surface)] transition-colors"
          >
            <Plus className="w-5 h-5" strokeWidth={1.5} />
            <span className="text-[12px]">{t('tab.newTab')}</span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between h-10 px-5 border-t border-[var(--fb-border)] text-[11px] text-[var(--fb-text-3)]">
        <span>{t('tabsOverview.count', { count: tabs.length })}</span>
        {onSort && (
          <button
            type="button"
            onClick={onSort}
            className="flex items-center gap-1.5 px-2 h-7 rounded-[var(--fb-radius-sm)] hover:text-[var(--fb-text)] hover:bg-[var(--fb-surface)]"
          >
            {t('tabsOverview.sort')}
            <ArrowUpDown className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
