import React, { useState, useEffect } from 'react';
import { HistoryItem } from '../browser/types';
import { HistoryService, HistoryGroup } from '../services/historyService';
import { useTranslation } from '../i18n';
import {
  History as HistoryIcon,
  X,
  Search,
  Trash2,
  ExternalLink,
  Globe,
  Clock,
  Calendar,
} from 'lucide-react';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (url: string) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHistory(HistoryService.getHistory());
      setSearchQuery('');
      setShowClearConfirm(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = searchQuery.trim()
    ? HistoryService.search(searchQuery)
    : history;

  const groups: HistoryGroup[] = HistoryService.groupByDate(filtered);

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = HistoryService.deleteEntry(id);
    setHistory(updated);
  };

  const handleClearToday = () => {
    const updated = HistoryService.clearToday();
    setHistory(updated);
    setShowClearConfirm(false);
  };

  const handleClearRecent = () => {
    const updated = HistoryService.clearRecent(1);
    setHistory(updated);
    setShowClearConfirm(false);
  };

  const handleClearAll = () => {
    const updated = HistoryService.clearAll();
    setHistory(updated);
    setShowClearConfirm(false);
  };

  const handleItemClick = (url: string) => {
    onNavigate(url);
    onClose();
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm sm:max-w-md bg-[#11131a]/98 backdrop-blur-3xl border-l border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col text-neutral-200 animate-slide-left">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-[#0c0d13]/80">
        <div className="flex items-center gap-2.5">
          <HistoryIcon className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white tracking-wide">{t('history.title')}</h2>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.06] text-neutral-400">
            Ctrl+H
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search and Action Bar */}
      <div className="p-4 border-b border-white/[0.06] space-y-3 bg-neutral-950/30">
        <div className="relative flex items-center bg-white/[0.04] border border-white/10 focus-within:border-emerald-500/40 focus-within:ring-1 focus-within:ring-emerald-500/20 rounded-lg px-3 py-1.5 transition-all">
          <Search className="w-3.5 h-3.5 text-neutral-400 mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('history.searchPlaceholder')}
            className="w-full bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-neutral-400 hover:text-white text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Clear Actions */}
        <div className="flex items-center justify-between pt-0.5 text-xs">
          <span className="text-[11px] text-neutral-500 font-mono">
            {filtered.length} {filtered.length === 1 ? t('history.entry') : t('history.entries')}
          </span>
          {history.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(!showClearConfirm)}
                className="text-[11px] text-neutral-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>{t('history.clear')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Clear Options Confirmation Dropdown */}
        {showClearConfirm && (
          <div className="p-3 rounded-lg bg-neutral-950/90 border border-white/10 space-y-2 animate-fade-in text-xs">
            <p className="text-[11px] text-neutral-300 font-medium">{t('history.selectRange')}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleClearRecent}
                className="px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/10 text-neutral-200 text-[11px] transition-colors"
              >
                {t('history.lastHour')}
              </button>
              <button
                type="button"
                onClick={handleClearToday}
                className="px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/10 text-neutral-200 text-[11px] transition-colors"
              >
                {t('history.today')}
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2.5 py-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-medium transition-colors"
              >
                {t('history.allHistory')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* History Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-neutral-500 space-y-3">
            <Clock className="w-10 h-10 stroke-[1.5] text-neutral-600" />
            <div>
              <p className="text-sm font-medium text-neutral-400">
                {searchQuery ? t('history.noMatches') : t('history.noHistory')}
              </p>
              <p className="text-xs text-neutral-600 mt-1 max-w-xs">
                {searchQuery
                  ? t('history.noMatchesTip')
                  : t('history.noHistoryTip')}
              </p>
            </div>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-1 py-1 text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-medium">
                <Calendar className="w-3 h-3 text-emerald-400" />
                <span>{group.label}</span>
              </div>

              <div className="space-y-1">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item.url)}
                    className="group relative flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/10 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                      {item.favicon ? (
                        <img
                          src={item.favicon}
                          alt=""
                          className="w-4 h-4 rounded shrink-0 object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Globe className="w-4 h-4 text-neutral-500 shrink-0" />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-neutral-200 group-hover:text-white truncate transition-colors">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-neutral-500 font-mono truncate">
                          {item.url}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-neutral-500 font-mono">
                        {formatTime(item.visitedAt)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteItem(item.id, e)}
                        title={t('history.deleteEntry')}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
