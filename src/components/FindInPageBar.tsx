import React, { useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, X, Search } from 'lucide-react';

interface FindInPageBarProps {
  isOpen: boolean;
  onClose: () => void;
  onFind: (text: string, forward?: boolean, findNext?: boolean) => void;
  activeMatchOrdinal: number;
  numberOfMatches: number;
  searchText: string;
  setSearchText: (text: string) => void;
}

export const FindInPageBar: React.FC<FindInPageBarProps> = ({
  isOpen,
  onClose,
  onFind,
  activeMatchOrdinal,
  numberOfMatches,
  searchText,
  setSearchText,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onFind(searchText, false, true); // Previous
      } else {
        onFind(searchText, true, true); // Next
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchText(val);
    onFind(val, true, false);
  };

  return (
    <div
      id="freedom-find-in-page-bar"
      className="absolute top-2 right-4 z-40 flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900/95 backdrop-blur-md border border-emerald-500/30 rounded-xl shadow-2xl text-neutral-200 text-xs animate-fade-in"
      role="search"
      aria-label="Find in page"
    >
      <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={searchText}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Find in page..."
        className="w-40 sm:w-52 bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none"
        spellCheck={false}
      />

      {/* Match Count Badge */}
      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-neutral-400 bg-neutral-800 shrink-0">
        {searchText.trim().length === 0
          ? '0/0'
          : numberOfMatches > 0
          ? `${activeMatchOrdinal}/${numberOfMatches}`
          : '0/0'}
      </span>

      <div className="flex items-center gap-0.5 border-l border-white/10 pl-1 shrink-0">
        {/* Previous */}
        <button
          type="button"
          onClick={() => onFind(searchText, false, true)}
          disabled={!searchText || numberOfMatches === 0}
          title="Previous match (Shift+Enter)"
          className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>

        {/* Next */}
        <button
          type="button"
          onClick={() => onFind(searchText, true, true)}
          disabled={!searchText || numberOfMatches === 0}
          title="Next match (Enter)"
          className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          title="Close (Esc)"
          className="p-1 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
