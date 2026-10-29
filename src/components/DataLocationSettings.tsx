import React, { useCallback, useEffect, useState } from 'react';
import { FolderOpen, FolderInput, RotateCcw, Loader2 } from 'lucide-react';
import { useTranslation } from '../i18n';
import type { TranslationKey } from '../i18n/translations';

type DataInfo = NonNullable<Awaited<ReturnType<NonNullable<NonNullable<Window['electronAPI']>['getUserDataInfo']>>>>;

const formatSize = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.max(0, Math.round(bytes / 1024 ** 2))} MB`;

/**
 * Settings → Telemetry & Logs: where the profile lives (cookies, history, bookmarks, passwords,
 * extensions, cache, crash dumps). The move is applied by electron/main.cjs on the next start.
 */
export const DataLocationSettings: React.FC = () => {
  const { t } = useTranslation();
  const api = window.electronAPI;
  const [info, setInfo] = useState<DataInfo | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [copyData, setCopyData] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (api?.getUserDataInfo) setInfo(await api.getUserDataInfo());
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!api?.getUserDataInfo) return null;

  const pick = async () => {
    setError(null);
    const dir = await api.chooseUserDataPath?.();
    if (dir) setChosen(dir);
  };

  const schedule = async (options: { targetPath?: string; reset?: boolean }) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.migrateUserDataPath?.({ ...options, migrateExisting: copyData });
      if (res && !res.success) {
        const known = ['invalid', 'nested', 'not-dir', 'not-writable', 'not-empty'].includes(res.error || '');
        setError(known ? t(`dataDir.error.${res.error}` as TranslationKey) : res.error || '');
      }
      else setChosen(null);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
      <div>
        <div className="text-xs font-semibold text-white">{t('dataDir.title')}</div>
        <div className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">{t('dataDir.desc')}</div>
      </div>

      {info && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              id="data-dir-path"
              type="text"
              readOnly
              value={info.path}
              title={info.path}
              className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 font-mono focus:outline-none"
            />
            <button
              type="button"
              onClick={() => api.openUserDataFolder?.()}
              title={t('dataDir.open')}
              className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-[11px] text-neutral-500">
            {info.isDefault ? t('dataDir.default') : t('dataDir.custom')} · {t('dataDir.size', { total: formatSize(info.sizeBytes), cache: formatSize(info.cacheBytes) })}
          </div>
        </div>
      )}

      {!chosen && !info?.pendingPath && (
        <div className="flex flex-wrap gap-2">
          <button
            id="data-dir-change"
            type="button"
            onClick={pick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs text-neutral-200 hover:text-white transition-colors cursor-pointer"
          >
            <FolderInput className="w-3.5 h-3.5" />
            {t('dataDir.change')}
          </button>
          {info && !info.isDefault && (
            <button
              type="button"
              onClick={() => schedule({ reset: true })}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs text-neutral-200 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('dataDir.reset')}
            </button>
          )}
        </div>
      )}

      {chosen && (
        <div className="p-3 rounded-lg border border-[var(--fb-border-strong)] bg-black/30 space-y-2.5">
          <div className="text-[11px] text-neutral-300">
            {t('dataDir.newFolder')} <span className="font-mono text-white break-all">{chosen}</span>
          </div>
          <label className="flex items-start gap-2 text-[11px] text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={copyData} onChange={(e) => setCopyData(e.target.checked)} className="mt-0.5" />
            <span>{t('dataDir.copy')}</span>
          </label>
          {!copyData && <div className="text-[11px] text-amber-400">{t('dataDir.freshWarning')}</div>}
          <div className="flex gap-2">
            <button
              id="data-dir-apply"
              type="button"
              onClick={() => schedule({ targetPath: chosen })}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs text-emerald-300 transition-colors cursor-pointer disabled:opacity-50"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {t('dataDir.apply')}
            </button>
            <button
              type="button"
              onClick={() => { setChosen(null); setError(null); }}
              className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs text-neutral-300 transition-colors cursor-pointer"
            >
              {t('dataDir.cancel')}
            </button>
          </div>
        </div>
      )}

      {info?.pendingPath && (
        <div id="data-dir-pending" className="p-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] space-y-2.5">
          <div className="text-[11px] text-emerald-300">
            {t('dataDir.pending')} <span className="font-mono break-all">{info.pendingPath}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => api.relaunchApp?.()}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs text-emerald-300 transition-colors cursor-pointer"
            >
              {t('settings.restartNow')}
            </button>
            <button
              type="button"
              onClick={async () => { await api.cancelUserDataMove?.(); refresh(); }}
              className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs text-neutral-300 transition-colors cursor-pointer"
            >
              {t('dataDir.cancel')}
            </button>
          </div>
        </div>
      )}

      {(error || info?.lastError) && (
        <div className="text-[11px] text-rose-400">{error || t('dataDir.moveFailed', { error: info?.lastError || '' })}</div>
      )}
    </div>
  );
};
