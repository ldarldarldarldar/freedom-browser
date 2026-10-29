import React, { useCallback, useEffect, useState } from 'react';
import { Puzzle, FolderOpen, FileArchive, Store, Trash2, Settings2, Loader2 } from 'lucide-react';
import { useTranslation } from '../i18n';

/** Settings → Extensions: install (folder / .crx / Chrome Web Store), enable, remove. */
export const ExtensionsSettings: React.FC = () => {
  const { t } = useTranslation();
  const api = window.electronAPI?.extensions;
  const [items, setItems] = useState<FreedomExtensionInfo[]>([]);
  const [storeInput, setStoreInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!api) return;
    setItems(await api.list());
    window.dispatchEvent(new Event('freedom-extensions-changed'));
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(String((err as Error)?.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    } finally {
      setBusy(null);
      refresh();
    }
  };

  if (!api) {
    return <p className="text-xs text-neutral-400">{t('ext.unavailable')}</p>;
  }

  const btn =
    'px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white flex items-center gap-1.5 disabled:opacity-50';

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h3 className="text-sm font-semibold text-white mb-0.5 tracking-tight">{t('ext.title')}</h3>
        <p className="text-xs text-neutral-400">{t('ext.desc')}</p>
      </div>

      {/* Install */}
      <div className="p-3.5 rounded-xl border border-white/10 space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (storeInput.trim()) run('store', async () => {
              await api.installFromStore(storeInput.trim());
              setStoreInput('');
            });
          }}
        >
          <input
            id="ext-store-input"
            value={storeInput}
            onChange={(e) => setStoreInput(e.target.value)}
            placeholder={t('ext.storePlaceholder')}
            className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
            spellCheck={false}
          />
          <button id="ext-store-install" type="submit" className={btn} disabled={!!busy || !storeInput.trim()}>
            {busy === 'store' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Store className="w-3.5 h-3.5" />}
            {t('ext.install')}
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={!!busy} onClick={() => run('folder', api.installFolder)}>
            <FolderOpen className="w-3.5 h-3.5" /> {t('ext.fromFolder')}
          </button>
          <button type="button" className={btn} disabled={!!busy} onClick={() => run('file', api.installFile)}>
            <FileArchive className="w-3.5 h-3.5" /> {t('ext.fromFile')}
          </button>
        </div>
        {error && <p className="text-[11px] text-rose-400">{error}</p>}
        <p className="text-[11px] text-neutral-500">{t('ext.note')}</p>
      </div>

      {/* Installed */}
      <div className="space-y-2">
        {items.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <Puzzle className="w-4 h-4" /> {t('ext.empty')}
          </div>
        )}
        {items.map((ext) => (
          <div key={ext.folder} className="ext-row flex items-start gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
            {ext.icon ? (
              <img src={ext.icon} alt="" className="w-8 h-8 rounded-md shrink-0" />
            ) : (
              <Puzzle className="w-8 h-8 p-1.5 rounded-md bg-neutral-800 text-neutral-400 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white truncate">{ext.name}</span>
                <span className="text-[10px] text-neutral-500 shrink-0">v{ext.version} · MV{ext.manifestVersion}</span>
              </div>
              <p className="text-[11px] text-neutral-400 line-clamp-2">{ext.description}</p>
              {ext.error && <p className="text-[11px] text-rose-400 mt-0.5">{ext.error}</p>}
              <div className="flex gap-3 mt-1.5 text-[11px]">
                {ext.options && ext.enabled && (
                  <button type="button" className="text-neutral-300 hover:text-white flex items-center gap-1" onClick={() => api.open(ext.folder, 'options')}>
                    <Settings2 className="w-3 h-3" /> {t('ext.options')}
                  </button>
                )}
                <button
                  type="button"
                  className="text-neutral-400 hover:text-rose-400 flex items-center gap-1"
                  onClick={() => run(`rm-${ext.folder}`, () => api.remove(ext.folder))}
                >
                  <Trash2 className="w-3 h-3" /> {t('ext.remove')}
                </button>
              </div>
            </div>
            <input
              type="checkbox"
              aria-label={t('ext.enabled')}
              checked={ext.enabled}
              disabled={!!busy}
              onChange={(e) => run(`en-${ext.folder}`, () => api.setEnabled(ext.folder, e.target.checked))}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
