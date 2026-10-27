import React from 'react';
import { Bookmark } from '../browser/types';
import { Globe, Folder } from 'lucide-react';
import { useTranslation } from '../i18n';

interface BookmarksBarProps {
  bookmarks: Bookmark[];
  onNavigate: (url: string) => void;
  onOpenBookmarksManager: () => void;
}

export const BookmarksBar: React.FC<BookmarksBarProps> = ({
  bookmarks,
  onNavigate,
  onOpenBookmarksManager,
}) => {
  const { t } = useTranslation();
  const barBookmarks = bookmarks.filter((b) => b.folderId === 'bar' || !b.folderId);
  const otherBookmarks = bookmarks.filter((b) => b.folderId === 'other');

  if (barBookmarks.length === 0 && otherBookmarks.length === 0) {
    return null;
  }

  return (
    <div
      id="freedom-bookmarks-bar"
      className="flex items-center gap-1 px-3 py-1 bg-[var(--fb-bg)]/90 backdrop-blur-md border-b border-white/[0.06] text-xs text-neutral-300 select-none overflow-x-auto no-scrollbar shrink-0"
    >
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

      {otherBookmarks.length > 0 && (
        <button
          type="button"
          onClick={onOpenBookmarksManager}
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
