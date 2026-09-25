import React, { useState, useEffect } from 'react';
import { HistoryItem } from '../browser/types';
import { HistoryService, HistoryGroup } from '../services/historyService';
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
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-neutral-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col text-neutral-200 animate-slide-left">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-neutral-950/80">
        <div className="flex items-center gap-2.5">
          <HistoryIcon className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white tracking-wide">Browsing History</h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
            Ctrl+H
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search and Action Bar */}
      <div className="p-4 border-b border-white/5 space-y-3 bg-neutral-950/40">
        <div className="relative flex items-center bg-neutral-800/80 border border-white/10 rounded-xl px-3 py-2">
          <Search className="w-3.5 h-3.5 text-neutral-400 mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search history..."
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
        <div className="flex items-center justify-between pt-1 text-xs">
          <span className="text-[11px] text-neutral-400 font-mono">
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          </span>
          {history.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(!showClearConfirm)}
                className="text-[11px] text-neutral-400 hover:text-red-400 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear...</span>
              </button>
            </div>
          )}
        </div>

        {/* Clear Options Confirmation Dropdown */}
        {showClearConfirm && (
          <div className="p-3 rounded-xl bg-neutral-950 border border-red-500/20 space-y-2 animate-fade-in text-xs">
            <p className="text-[11px] text-neutral-300 font-medium">Select history range to clear:</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleClearRecent}
                className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] transition-colors"
              >
                Last hour
              </button>
              <button
                type="button"
                onClick={handleClearToday}
                className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="px-2.5 py-1 rounded-lg bg-red-950 hover:bg-red-900 border border-red-500/30 text-red-300 text-[11px] font-medium transition-colors"
              >
                All History
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
                {searchQuery ? 'No matching history found' : 'No browsing history yet'}
              </p>
              <p className="text-xs text-neutral-600 mt-1 max-w-xs">
                {searchQuery
                  ? 'Try searching with another keyword or URL.'
                  : 'Pages you visit during normal browsing will be recorded here.'}
              </p>
            </div>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-2 text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                <Calendar className="w-3 h-3 text-emerald-400" />
                <span>{group.label}</span>
              </div>

              <div className="space-y-1">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item.url)}
                    className="group relative flex items-center justify-between p-2.5 rounded-xl bg-neutral-950/60 hover:bg-neutral-800/80 border border-white/5 hover:border-emerald-500/30 cursor-pointer transition-all"
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
                        <div className="text-xs font-medium text-white truncate group-hover:text-emerald-300 transition-colors">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-mono truncate">
                          {item.url}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {formatTime(item.visitedAt)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteItem(item.id, e)}
                        title="Delete from history"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-neutral-400 hover:text-red-400 hover:bg-white/10 transition-all"
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
