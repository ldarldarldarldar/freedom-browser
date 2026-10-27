import React from 'react';
import { House, PanelsTopLeft, Bookmark, History, Download, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslation } from '../i18n';

export type SidebarSection = 'home' | 'tabs' | 'bookmarks' | 'history' | 'downloads' | null;

interface SidebarProps {
  active: SidebarSection;
  collapsed: boolean;
  tabsCount: number;
  activeDownloads: number;
  onHome: () => void;
  onTabs: () => void;
  onBookmarks: () => void;
  onHistory: () => void;
  onDownloads: () => void;
  onSettings: () => void;
  onToggleCollapsed: () => void;
}

/** Left navigation rail from the reference layout (full or icon-only). */
export const Sidebar: React.FC<SidebarProps> = ({
  active,
  collapsed,
  tabsCount,
  activeDownloads,
  onHome,
  onTabs,
  onBookmarks,
  onHistory,
  onDownloads,
  onSettings,
  onToggleCollapsed,
}) => {
  const { t } = useTranslation();

  const items: { id: Exclude<SidebarSection, null>; icon: React.ElementType; label: string; onClick: () => void; badge?: number }[] = [
    { id: 'home', icon: House, label: t('sidebar.home'), onClick: onHome },
    { id: 'tabs', icon: PanelsTopLeft, label: t('sidebar.tabs'), onClick: onTabs, badge: tabsCount },
    { id: 'bookmarks', icon: Bookmark, label: t('sidebar.bookmarks'), onClick: onBookmarks },
    { id: 'history', icon: History, label: t('sidebar.history'), onClick: onHistory },
    { id: 'downloads', icon: Download, label: t('sidebar.downloads'), onClick: onDownloads, badge: activeDownloads || undefined },
  ];

  const iconBtn =
    'flex items-center justify-center w-8 h-8 rounded-[var(--fb-radius-md)] text-[var(--fb-text-3)] hover:text-[var(--fb-text)] hover:bg-[var(--fb-surface-hover)] transition-colors';

  return (
    <nav
      id="browser-sidebar"
      aria-label="Sidebar"
      className="relative z-20 flex flex-col shrink-0 py-2 border-r border-[var(--fb-border)] bg-[var(--fb-sidebar)] select-none transition-[width] duration-150"
      style={{ width: collapsed ? 'var(--fb-sidebar-w-collapsed)' : 'var(--fb-sidebar-w)' }}
    >
      <ul className={`flex flex-col gap-0.5 ${collapsed ? 'items-center px-1' : 'px-1.5'}`}>
        {items.map(({ id, icon: Icon, label, onClick, badge }) => {
          const isActive = active === id;
          return (
            <li key={id} className={collapsed ? '' : 'w-full'}>
              <button
                id={`sidebar-${id}`}
                type="button"
                onClick={onClick}
                title={label}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex items-center h-8 rounded-[var(--fb-radius-md)] text-[12px] transition-colors ${
                  collapsed ? 'w-8 justify-center' : 'w-full gap-2.5 px-2.5'
                } ${
                  isActive
                    ? 'bg-[var(--fb-surface-hover)] text-[var(--fb-text)] font-medium shadow-[inset_0_0_0_1px_var(--fb-border)]'
                    : 'text-[var(--fb-text-2)] hover:text-[var(--fb-text)] hover:bg-[var(--fb-surface)]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                {!collapsed && <span className="truncate flex-1 text-left">{label}</span>}
                {badge !== undefined && badge > 0 && (
                  <span
                    className={
                      collapsed
                        ? 'absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[var(--fb-accent)]'
                        : 'text-[10px] tabular-nums text-[var(--fb-text-3)]'
                    }
                  >
                    {collapsed ? '' : badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className={`mt-auto flex flex-col gap-1 ${collapsed ? 'items-center' : 'px-2.5'}`}>
        <button
          id="sidebar-collapse"
          type="button"
          onClick={onToggleCollapsed}
          className={iconBtn}
          title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" strokeWidth={1.75} /> : <PanelLeftClose className="w-4 h-4" strokeWidth={1.75} />}
        </button>
        <button id="sidebar-settings" type="button" onClick={onSettings} className={iconBtn} title={t('nav.settings')}>
          <Settings className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>
    </nav>
  );
};
