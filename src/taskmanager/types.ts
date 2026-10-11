export type ProcessType = 
  | 'browser-core'
  | 'renderer-tab'
  | 'gpu-compositor'
  | 'network-service'
  | 'extension-sandbox'
  | 'utility';

export type ProcessStatus = 'active' | 'throttled' | 'frozen' | 'hibernated' | 'suspended' | 'crashed';

export interface ProcessMetric {
  id: string; // process ID or tab id
  pid: number;
  tabId?: string;
  title: string;
  url?: string;
  domain?: string;
  processType: ProcessType;
  ramUsageBytes: number; // in bytes (Private memory / PSS)
  ramUsageMb: number; // in MB
  workingSetBytes?: number; // Total mapped working set including shared libraries
  workingSetMb?: number;
  privateBytes?: number; // Exclusively owned private memory
  privateMb?: number;
  v8AllocatedBytes?: number; // V8 Heap allocated (bytes)
  v8UsedBytes?: number; // V8 Heap used (bytes)
  cpuUsagePercent: number; // 0-100%
  networkSpeedKbps: number; // in KB/s
  status: ProcessStatus;
  isForeground: boolean;
  canTerminate: boolean;
  canSuspend: boolean;
  isGuarded?: boolean;
  guardReason?: string;
  tabsCount?: number;
}

export interface SystemStats {
  totalBrowserRamBytes: number; // Non-duplicated system-level browser footprint (PSS / Private + Shared once)
  totalBrowserRamMb: number;
  browserRamMb?: number;
  totalSystemRamMb?: number;
  privateRamMb?: number;
  workingSetMb?: number;
  totalSystemRamBytes: number;
  availableSystemRamBytes?: number;
  availableSystemRamMb?: number;
  totalSwapBytes?: number;
  usedSwapBytes?: number;
  memoryPressurePercent?: number;
  memoryPressureLevel?: 'normal' | 'moderate' | 'critical';
  reclaimedRamMb?: number;
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
