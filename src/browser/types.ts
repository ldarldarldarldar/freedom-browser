export interface BrowserTab {
  id: string;
  title: string;
  url: string;
  displayUrl: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isSuspended: boolean;
  lastActive: number;
  isCrashed: boolean;
  crashReason?: string;
  history: string[];
  historyIndex: number;
  zoomLevel: number;
  isAudioPlaying?: boolean;
  isMuted?: boolean;
  security: 'secure' | 'insecure' | 'internal';
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  addedAt: number;
}

export interface HistoryItem {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
  visitCount: number;
}

export interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  filepath: string;
  totalBytes: number;
  receivedBytes: number;
  state: 'progressing' | 'completed' | 'paused' | 'cancelled' | 'interrupted';
  startTime: number;
  speedBps: number;
}

export interface DiagnosticLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  category: 'KERNEL' | 'RENDERER' | 'NETWORK' | 'MEMORY' | 'SECURITY';
  message: string;
}
