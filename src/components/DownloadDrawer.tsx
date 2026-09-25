import React from 'react';
import {
  X,
  Download,
  Folder,
  FolderOpen,
  File,
  CheckCircle,
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  ExternalLink,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { DownloadItem } from '../browser/types';

interface DownloadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  downloads: DownloadItem[];
  onCancelDownload: (id: string) => void;
  onClearHistory: () => void;
  onOpenFile: (item: DownloadItem) => void;
  onShowInFolder?: (item: DownloadItem) => void;
  onOpenFolder: () => void;
  onRemoveItem?: (id: string) => void;
}

export const DownloadDrawer: React.FC<DownloadDrawerProps> = ({
  isOpen,
  onClose,
  downloads,
  onCancelDownload,
  onClearHistory,
  onOpenFile,
  onShowInFolder,
  onOpenFolder,
  onRemoveItem,
}) => {
  if (!isOpen) return null;

  const formatSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${bytes} B`;
  };

  const formatSpeed = (bps: number) => {
    if (!bps || bps <= 0) return '';
    if (bps >= 1024 * 1024) {
      return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    return `${(bps / 1024).toFixed(0)} KB/s`;
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
      return <ImageIcon className="w-4 h-4 text-sky-400 shrink-0" />;
    }
    if (['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv'].includes(ext)) {
      return <VideoIcon className="w-4 h-4 text-purple-400 shrink-0" />;
    }
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext)) {
      return <Music className="w-4 h-4 text-pink-400 shrink-0" />;
    }
    if (['zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar'].includes(ext)) {
      return <FileArchive className="w-4 h-4 text-amber-400 shrink-0" />;
    }
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'c', 'cpp', 'html', 'css', 'json', 'sh'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) {
      return <FileText className="w-4 h-4 text-blue-400 shrink-0" />;
    }
    return <File className="w-4 h-4 text-neutral-400 shrink-0" />;
  };

  return (
    <div
      id="freedom-downloads-drawer"
      className="absolute top-12 right-3 w-[400px] max-h-[75vh] bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden text-neutral-200 animate-fade-in"
      style={{
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(255, 255, 255, 0.05)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-950/70 border-b border-white/5 select-none">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Download className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white tracking-wide">Downloads</h3>
            <span className="text-[10px] text-neutral-400">
              {downloads.filter((d) => d.state === 'completed').length} completed
              {downloads.filter((d) => d.state === 'progressing').length > 0 &&
                ` • ${downloads.filter((d) => d.state === 'progressing').length} active`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenFolder}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Open System Downloads Folder"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Downloads List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[420px]">
        {downloads.length === 0 ? (
          <div className="text-center py-10 text-neutral-500 text-xs">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-neutral-800/40 border border-white/5 flex items-center justify-center">
              <Download className="w-5 h-5 text-neutral-500 opacity-60" />
            </div>
            <p className="font-medium text-neutral-300 mb-0.5">No Downloads Yet</p>
            <p className="text-[11px] text-neutral-500">Files you download will appear here.</p>
          </div>
        ) : (
          downloads.map((item) => {
            const percent =
              item.totalBytes > 0
                ? Math.min(100, Math.round((item.receivedBytes / item.totalBytes) * 100))
                : 100;
            const speed = formatSpeed(item.speedBps);

            return (
              <div
                key={item.id}
                className="group p-3 rounded-xl bg-neutral-950/40 hover:bg-neutral-800/50 border border-white/5 hover:border-white/10 transition-all text-xs"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="p-2 rounded-lg bg-neutral-900 border border-white/5 mt-0.5 shrink-0">
                      {getFileIcon(item.filename)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="font-medium text-white truncate max-w-[210px] text-xs cursor-pointer hover:text-emerald-300 transition-colors"
                        title={item.filename}
                        onClick={() => {
                          if (item.state === 'completed') {
                            onOpenFile(item);
                          }
                        }}
                      >
                        {item.filename}
                      </div>

                      <div className="text-[11px] text-neutral-400 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>
                          {formatSize(item.receivedBytes)}
                          {item.totalBytes > 0 && ` / ${formatSize(item.totalBytes)}`}
                        </span>

                        <span>•</span>

                        {item.state === 'completed' && (
                          <span className="text-emerald-400 font-medium flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 inline" /> Completed
                          </span>
                        )}

                        {item.state === 'progressing' && (
                          <span className="text-sky-400 font-medium">
                            {percent}% {speed && `(${speed})`}
                          </span>
                        )}

                        {item.state === 'cancelled' && (
                          <span className="text-neutral-500">Cancelled</span>
                        )}

                        {item.state === 'interrupted' && (
                          <span className="text-red-400 flex items-center gap-0.5">
                            <AlertCircle className="w-3 h-3 inline" /> Failed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      {item.state === 'completed' && (
                        <>
                          <button
                            type="button"
                            onClick={() => onOpenFile(item)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                            title="Open file"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          {onShowInFolder && (
                            <button
                              type="button"
                              onClick={() => onShowInFolder(item)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                              title="Show in folder"
                            >
                              <Folder className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}

                      {item.state === 'progressing' && (
                        <button
                          type="button"
                          onClick={() => onCancelDownload(item.id)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Cancel download"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Remove from list (does NOT delete file on disk) */}
                      {item.state !== 'progressing' && onRemoveItem && (
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-white/10 transition-all"
                          title="Remove from list (keeps file on disk)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                </div>

                {/* Progress bar */}
                {item.state === 'progressing' && (
                  <div className="w-full bg-neutral-800/80 h-1.5 rounded-full overflow-hidden mt-2.5">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-200"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {downloads.length > 0 && (
        <div className="p-2.5 bg-neutral-950/60 border-t border-white/5 flex items-center justify-between text-[11px] select-none">
          <button
            type="button"
            onClick={onOpenFolder}
            className="text-neutral-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/5 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open folder</span>
          </button>

          <button
            type="button"
            onClick={onClearHistory}
            className="text-neutral-400 hover:text-red-400 flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear list</span>
          </button>
        </div>
      )}
    </div>
  );
};
