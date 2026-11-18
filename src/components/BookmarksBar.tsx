import React, { useState } from 'react';
import { Bookmark, BookmarkFolder } from '../browser/types';
import { Globe, Folder } from 'lucide-react';
import { useTranslation } from '../i18n';
import { TAB_DRAG_TYPE } from '../services/tabGroupService';

interface BookmarksBarProps {
  bookmarks: Bookmark[];
  /** Folders placed on the bar (imported toolbar folders) show as chips that open the manager */
  folders?: BookmarkFolder[];
  onNavigate: (url: string) => void;
  onOpenBookmarksManager: (folderId?: string) => void;
  /** A tab is being dragged from the tab strip: the bar shows even when empty, to take it */
  isTabDragging?: boolean;
  onDropTab?: (tabId: string) => void;
}

export const BookmarksBar: React.FC<BookmarksBarProps> = ({
  bookmarks,
  folders = [],
  onNavigate,
  onOpenBookmarksManager,
  isTabDragging = false,
  onDropTab,
}) => {
  const { t } = useTranslation();
  const [isOver, setIsOver] = useState(false);
  const barBookmarks = bookmarks.filter((b) => b.folderId === 'bar' || !b.folderId);
  const otherBookmarks = bookmarks.filter((b) => b.folderId === 'other');
  const barFolders = folders.filter((f) => f.parentId === 'bar');

  const isEmpty = barBookmarks.length === 0 && otherBookmarks.length === 0 && barFolders.length === 0;
  const acceptsTab = isTabDragging && Boolean(onDropTab);
  if (isEmpty && !acceptsTab) {
    return null;
  }

  return (
    <div
      id="freedom-bookmarks-bar"
      onDragOver={(e) => {
        if (!onDropTab || !e.dataTransfer.types.includes(TAB_DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (!isOver) setIsOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsOver(false);
      }}
      onDrop={(e) => {
        const tabId = e.dataTransfer.getData(TAB_DRAG_TYPE);
        setIsOver(false);
        if (!tabId || !onDropTab) return;
        e.preventDefault();
        e.stopPropagation();
        onDropTab(tabId);
      }}
      className={`flex items-center gap-1 px-3 py-1 min-h-[30px] bg-[var(--fb-bg)]/90 backdrop-blur-md border-b text-xs text-neutral-300 select-none overflow-x-auto no-scrollbar shrink-0 transition-colors ${
        isOver ? 'border-emerald-500/60 bg-emerald-500/10' : acceptsTab ? 'border-emerald-500/25' : 'border-white/[0.06]'
      }`}
    >
      {acceptsTab && isEmpty && (
        <span className="px-2 text-[11px] text-neutral-400 pointer-events-none">{t('bookmarks.dropTabHere')}</span>
      )}
      {barBookmarks.slice(0, 15).map((bm) => (
        <button
          key={bm.id}
          type="button"
          onClick={() => onNavigate(bm.url)}
          title={`${bm.title}\n${bm.url}`}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-white/[0.07] text-neutral-300 hover:text-white max-w-[170px] truncate transition-colors shrink-0 text-[11px] font-medium"
        >
          {bm.favicon ? (
            <img
              src={bm.favicon}
              alt=""
              className="w-3.5 h-3.5 rounded shrink-0 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <Globe className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          )}
          <span className="truncate">{bm.title}</span>
        </button>
      ))}

      {barFolders.slice(0, 10).map((folder) => (
        <button
          key={folder.id}
          type="button"
          onClick={() => onOpenBookmarksManager(folder.id)}
          title={folder.name}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-white/[0.07] text-neutral-300 hover:text-white max-w-[170px] truncate transition-colors shrink-0 text-[11px] font-medium"
        >
          <Folder className="w-3 h-3 text-amber-300/80 shrink-0" />
          <span className="truncate">{folder.name}</span>
        </button>
      ))}

      {otherBookmarks.length > 0 && (
        <button
          type="button"
          onClick={() => onOpenBookmarksManager('other')}
          title={t('bookmarks.otherBookmarks')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md hover:bg-white/[0.07] text-neutral-400 hover:text-white ml-auto shrink-0 transition-colors text-[11px] font-medium"
        >
          <Folder className="w-3 h-3 text-emerald-400" />
          <span>{t('bookmarks.otherBookmarks')} ({otherBookmarks.length})</span>
        </button>
      )}
    </div>
  );
};
