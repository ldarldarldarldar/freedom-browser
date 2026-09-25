export type ProcessType = 
  | 'browser-core'
  | 'renderer-tab'
  | 'gpu-compositor'
  | 'network-service'
  | 'extension-sandbox'
  | 'utility';

export type ProcessStatus = 'active' | 'throttled' | 'suspended' | 'crashed';

export interface ProcessMetric {
  id: string; // process ID or tab id
  pid: number;
  tabId?: string;
  title: string;
  url?: string;
  processType: ProcessType;
  ramUsageBytes: number; // in bytes (Private memory / PSS)
  ramUsageMb: number; // in MB
  workingSetBytes?: number; // Total mapped working set including shared libraries
  workingSetMb?: number;
  privateBytes?: number; // Exclusively owned private memory
  privateMb?: number;
  cpuUsagePercent: number; // 0-100%
  networkSpeedKbps: number; // in KB/s
  status: ProcessStatus;
  isForeground: boolean;
  canTerminate: boolean;
  canSuspend: boolean;
  tabsCount?: number;
}

export interface SystemStats {
  totalBrowserRamBytes: number; // Non-duplicated system-level browser footprint (PSS / Private + Shared once)
  totalBrowserRamMb: number;
  privateRamMb?: number;
  workingSetMb?: number;
  totalSystemRamBytes: number;
  systemRamPercent: number;
  totalBrowserCpuPercent: number;
  totalSystemCpuPercent: number;
  openTabsCount: number;
  activeProcessesCount: number;
  gpuUsagePercent?: number;
  networkUpKbps: number;
  networkDownKbps: number;
  platform: 'windows' | 'linux' | 'macos' | 'web-runtime';
  engineName: 'WebView2' | 'WebKitGTK' | 'WebEngine' | 'Chromium';
  measurementMethod?: string;
}
