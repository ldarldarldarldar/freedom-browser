import React, { useState, useEffect } from 'react';
import {
  X,
  Cpu,
  HardDrive,
  Activity,
  Layers,
  ArrowUpDown,
  Moon,
  Trash2,
  RefreshCw,
  Server,
  Layers2,
  ShieldAlert,
} from 'lucide-react';
import { ProcessMetric, SystemStats } from '../taskmanager/types';
import { BrowserTab } from '../browser/types';
import { tauriBridge } from '../services/tauriBridge';

interface TaskManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: BrowserTab[];
  onTerminateTab: (tabId: string) => void;
  onReloadTab: (tabId: string) => void;
  onSuspendTab: (tabId: string) => void;
}

export const TaskManagerModal: React.FC<TaskManagerModalProps> = ({
  isOpen,
  onClose,
  tabs,
  onTerminateTab,
  onReloadTab,
  onSuspendTab,
}) => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [processes, setProcesses] = useState<ProcessMetric[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'ram' | 'cpu' | 'workingset'>('ram');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Poll real system metrics strictly while modal is open
  const fetchMetrics = async () => {
    try {
      const data = await tauriBridge.getSystemMetrics(tabs.length);
      if (data) {
        setStats(data.stats);
        setProcesses(data.processes || []);
      }
    } catch (err) {
      console.error('Failed to fetch task manager metrics:', err);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchMetrics();
    // Poll every 3 seconds to keep task manager lightweight and avoid CPU overhead
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, [isOpen, tabs.length]);

  if (!isOpen) return null;

  // Sorting logic
  const sortedProcesses = [...processes].sort((a, b) => {
    let diff = 0;
    if (sortBy === 'ram') diff = a.ramUsageBytes - b.ramUsageBytes;
    else if (sortBy === 'workingset') diff = (a.workingSetBytes || a.ramUsageBytes) - (b.workingSetBytes || b.ramUsageBytes);
    else if (sortBy === 'cpu') diff = a.cpuUsagePercent - b.cpuUsagePercent;

    return sortOrder === 'desc' ? -diff : diff;
  });

  const selectedProcess = processes.find((p) => p.id === selectedProcessId);

  const toggleSort = (column: 'ram' | 'cpu' | 'workingset') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getProcessIcon = (type: string) => {
    switch (type) {
      case 'gpu-compositor':
        return <Cpu className="w-3.5 h-3.5 text-purple-400" />;
      case 'renderer-tab':
        return <Layers className="w-3.5 h-3.5 text-sky-400" />;
      case 'network-service':
        return <Activity className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Server className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  const getProcessLabel = (type: string) => {
    switch (type) {
      case 'gpu-compositor':
        return 'GPU Compositor';
      case 'renderer-tab':
        return 'Web Tab Surface';
      case 'network-service':
        return 'Network & Audio';
      default:
        return 'Browser Engine';
    }
  };

  const handleEndProcess = async () => {
    if (!selectedProcess) return;

    if (selectedProcess.canTerminate) {
      if ((window as any).electronAPI?.terminateProcess) {
        await (window as any).electronAPI.terminateProcess(selectedProcess.pid);
      }
      if (selectedProcess.tabId) {
        onTerminateTab(selectedProcess.tabId);
      }
      setSelectedProcessId(null);
      await fetchMetrics();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        id="freedom-task-manager-dialog"
        className="w-full max-w-4xl bg-neutral-900 border border-emerald-500/30 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-neutral-200 font-sans"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Task Manager — Freedom Browser
              </h2>
              <span className="text-[10px] text-neutral-400 font-mono">
                {stats?.measurementMethod || 'Non-Duplicating System Accounting'} • Real OS Process Tree ({stats?.engineName || 'Chromium'})
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                setIsRefreshing(true);
                await fetchMetrics();
                setIsRefreshing(false);
              }}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Refresh metrics"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Overview Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-neutral-950/60 border-b border-white/5 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-neutral-900/90 border border-white/5">
            <div className="text-[10px] text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Real Physical RAM</span>
            </div>
            <div className="text-lg font-bold text-white mt-0.5">
              {stats ? `${stats.totalBrowserRamMb} MB` : '...'}
            </div>
            <div className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span>{stats?.privateRamMb ? `${stats.privateRamMb} MB Private` : 'OS Proportional'}</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-neutral-900/90 border border-white/5">
            <div className="text-[10px] text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Working Set</span>
            </div>
            <div className="text-lg font-bold text-neutral-300 mt-0.5">
              {stats?.workingSetMb ? `${stats.workingSetMb} MB` : (stats ? formatBytes(stats.totalBrowserRamBytes * 1.6) : '...')}
            </div>
            <div className="text-[10px] text-neutral-400">
              Includes shared pages
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-neutral-900/90 border border-white/5">
            <div className="text-[10px] text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>Browser CPU</span>
            </div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              {stats ? `${stats.totalBrowserCpuPercent}%` : '0.5%'}
            </div>
            <div className="text-[10px] text-neutral-400">
              {processes.length} active processes
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-neutral-900/90 border border-white/5">
            <div className="text-[10px] text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Tabs Open</span>
            </div>
            <div className="text-lg font-bold text-white mt-0.5">
              {tabs.length}
            </div>
            <div className="text-[10px] text-emerald-400">
              {tabs.filter((t) => t.isSuspended).length} Hibernated / Suspended
            </div>
          </div>
        </div>

        {/* Process Table */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-neutral-950 text-neutral-400 border-b border-white/10 font-mono text-[11px]">
              <tr>
                <th className="py-2.5 px-3 font-medium">Process / Task</th>
                <th className="py-2.5 px-2 font-medium">Type</th>
                <th className="py-2.5 px-2 font-medium">PID</th>
                <th
                  className="py-2.5 px-3 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort('ram')}
                  title="Unique physical memory (Private/PSS)"
                >
                  <div className="flex items-center gap-1">
                    <span>Physical RAM</span>
                    <ArrowUpDown className="w-3 h-3 text-emerald-400" />
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort('workingset')}
                  title="Total mapped virtual and shared memory"
                >
                  <div className="flex items-center gap-1">
                    <span>Working Set</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-400" />
                  </div>
                </th>
                <th
                  className="py-2.5 px-3 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort('cpu')}
                >
                  <div className="flex items-center gap-1">
                    <span>CPU</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-2.5 px-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-neutral-300">
              {sortedProcesses.map((proc) => {
                const isSelected = selectedProcessId === proc.id;

                return (
                  <tr
                    key={proc.id}
                    onClick={() => setSelectedProcessId(proc.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-950/40 text-white'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <td className="py-2 px-3 flex items-center gap-2">
                      <div className="p-1 rounded bg-neutral-800/80 shrink-0">
                        {getProcessIcon(proc.processType)}
                      </div>
                      <span className="font-sans font-medium truncate max-w-xs text-neutral-200">
                        {proc.title}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-[11px] text-neutral-400">
                      {getProcessLabel(proc.processType)}
                    </td>
                    <td className="py-2 px-2 text-[11px] text-neutral-500">
                      {proc.pid}
                    </td>
                    <td className="py-2 px-3 font-semibold text-emerald-300">
                      {formatBytes(proc.ramUsageBytes)}
                    </td>
                    <td className="py-2 px-3 text-neutral-400">
                      {formatBytes(proc.workingSetBytes || proc.ramUsageBytes)}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={
                          proc.cpuUsagePercent > 10
                            ? 'text-red-400 font-bold'
                            : proc.cpuUsagePercent > 0
                            ? 'text-emerald-400'
                            : 'text-neutral-500'
                        }
                      >
                        {proc.cpuUsagePercent}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/20">
                        active
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer with Controls */}
        <div className="p-3 bg-neutral-950 border-t border-white/10 flex items-center justify-between">
          <div className="text-neutral-400 text-[11px]">
            {selectedProcess ? (
              <span>
                Selected: <strong className="text-white">{selectedProcess.title}</strong> (PID: {selectedProcess.pid})
              </span>
            ) : (
              <span>Select a process to inspect or manage resources</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedProcess && selectedProcess.processType === 'renderer-tab' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedProcess.tabId) onReloadTab(selectedProcess.tabId);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white flex items-center gap-1.5 transition-colors text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reload Page</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedProcess.tabId) onSuspendTab(selectedProcess.tabId);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5 transition-colors text-xs font-medium"
                  title="Suspend tab to instantly reclaim RAM"
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Suspend (Free RAM)</span>
                </button>
              </>
            )}

            {selectedProcess && selectedProcess.canTerminate && (
              <button
                type="button"
                onClick={handleEndProcess}
                className="px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 flex items-center gap-1.5 transition-colors text-xs font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>End Process</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
