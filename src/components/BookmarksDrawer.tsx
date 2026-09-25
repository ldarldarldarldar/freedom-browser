import React, { useState, useEffect } from 'react';
import { Bookmark, BookmarkFolder } from '../browser/types';
import { BookmarkService } from '../services/bookmarkService';
import {
  Bookmark as BookmarkIcon,
  X,
  Search,
  Folder,
  FolderPlus,
  Trash2,
  Edit2,
  Globe,
  ExternalLink,
  ChevronRight,
  Plus,
} from 'lucide-react';

interface BookmarksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (url: string) => void;
}

export const BookmarksDrawer: React.FC<BookmarksDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [folders, setFolders] = useState<BookmarkFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Editing state
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editFolderId, setEditFolderId] = useState('bar');

  // Creating folder state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const loadData = () => {
    setBookmarks(BookmarkService.getBookmarks());
    setFolders(BookmarkService.getFolders());
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setSearchQuery('');
      setEditingBookmark(null);
      setIsCreatingFolder(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredBookmarks = bookmarks.filter((b) => {
    if (selectedFolderId !== 'all' && b.folderId !== selectedFolderId) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q);
    }
    return true;
  });

  const handleDeleteBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = BookmarkService.removeBookmark(id);
    setBookmarks(updated);
  };

  const handleStartEdit = (b: Bookmark, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingBookmark(b);
    setEditTitle(b.title);
    setEditUrl(b.url);
    setEditFolderId(b.folderId || 'bar');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBookmark) return;
    const updated = BookmarkService.updateBookmark(editingBookmark.id, {
      title: editTitle,
      url: editUrl,
      folderId: editFolderId,
    });
    setBookmarks(updated);
    setEditingBookmark(null);
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    BookmarkService.createFolder(newFolderName.trim());
    setFolders(BookmarkService.getFolders());
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  const handleDeleteFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    BookmarkService.deleteFolder(folderId);
    setFolders(BookmarkService.getFolders());
    setBookmarks(BookmarkService.getBookmarks());
    if (selectedFolderId === folderId) {
      setSelectedFolderId('all');
    }
  };

  const handleItemClick = (url: string) => {
    onNavigate(url);
    onClose();
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-neutral-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col text-neutral-200 animate-slide-left">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-neutral-950/80">
        <div className="flex items-center gap-2.5">
          <BookmarkIcon className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white tracking-wide">Bookmarks Manager</h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
            Ctrl+D
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

      {/* Search Bar */}
      <div className="p-4 border-b border-white/5 space-y-3 bg-neutral-950/40">
        <div className="relative flex items-center bg-neutral-800/80 border border-white/10 rounded-xl px-3 py-2">
          <Search className="w-3.5 h-3.5 text-neutral-400 mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bookmarks..."
            className="w-full bg-transparent text-xs text-white placeholder-neutral-500 focus:outline-none"
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

        {/* Folders Navigation Bar */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 text-xs no-scrollbar">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedFolderId('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                selectedFolderId === 'all'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                  : 'bg-neutral-800/60 text-neutral-400 hover:text-white'
              }`}
            >
              All
            </button>
            {folders.map((f) => (
              <div key={f.id} className="relative group/fld flex items-center">
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors ${
                    selectedFolderId === f.id
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                      : 'bg-neutral-800/60 text-neutral-400 hover:text-white'
                  }`}
                >
                  <Folder className="w-3 h-3" />
                  <span>{f.name}</span>
                </button>
                {f.id !== 'bar' && f.id !== 'other' && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteFolder(f.id, e)}
                    title="Delete folder"
                    className="ml-0.5 p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-red-400"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsCreatingFolder(!isCreatingFolder)}
            title="Create new folder"
            className="p-1.5 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-emerald-400 shrink-0 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* New Folder Inline Form */}
        {isCreatingFolder && (
          <form onSubmit={handleCreateFolder} className="flex gap-2 items-center pt-1 animate-fade-in">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-950 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium"
            >
              Add
            </button>
          </form>
        )}
      </div>

      {/* Edit Bookmark Modal / Drawer Overlay */}
      {editingBookmark && (
        <div className="p-4 bg-neutral-950 border-b border-white/10 space-y-3 animate-fade-in text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">Edit Bookmark</span>
            <button
              type="button"
              onClick={() => setEditingBookmark(null)}
              className="text-neutral-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <form onSubmit={handleSaveEdit} className="space-y-2">
            <div>
              <label className="text-[10px] text-neutral-400 uppercase font-mono">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 rounded-lg bg-neutral-900 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-400 uppercase font-mono">URL</label>
              <input
                type="url"
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 rounded-lg bg-neutral-900 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-400 uppercase font-mono">Folder</label>
              <select
                value={editFolderId}
                onChange={(e) => setEditFolderId(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 rounded-lg bg-neutral-900 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingBookmark(null)}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bookmarks List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredBookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-neutral-500 space-y-3">
            <BookmarkIcon className="w-10 h-10 stroke-[1.5] text-neutral-600" />
            <div>
              <p className="text-sm font-medium text-neutral-400">No bookmarks yet</p>
              <p className="text-xs text-neutral-600 mt-1 max-w-xs">
                Press <kbd className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono text-[10px]">Ctrl+D</kbd> on any web page to bookmark it.
              </p>
            </div>
          </div>
        ) : (
          filteredBookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              onClick={() => handleItemClick(bookmark.url)}
              className="group relative flex items-center justify-between p-2.5 rounded-xl bg-neutral-950/60 hover:bg-neutral-800/80 border border-white/5 hover:border-emerald-500/30 cursor-pointer transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                {bookmark.favicon ? (
                  <img
                    src={bookmark.favicon}
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
                    {bookmark.title}
                  </div>
                  <div className="text-[11px] text-neutral-400 font-mono truncate">
                    {bookmark.url}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleStartEdit(bookmark, e)}
                  title="Edit bookmark"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteBookmark(bookmark.id, e)}
                  title="Delete bookmark"
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-neutral-400 hover:text-red-400 hover:bg-white/10 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
