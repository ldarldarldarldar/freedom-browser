import React, { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { useTranslation } from '../i18n';
import type { TranslationKey } from '../i18n';

interface SiteSettingsControlsProps {
  /** webContents id of the tab; the main process reads the site from the tab itself */
  webContentsId: number | undefined;
  onReload: () => void;
}

const OPTIONS: { key: keyof FreedomSiteRules; label: TranslationKey; values: { value: string; label: TranslationKey }[] }[] = [
  {
    key: 'cookies',
    label: 'site.cookies',
    values: [
      { value: 'allow', label: 'site.allow' },
      { value: 'session', label: 'site.cookiesSession' },
      { value: 'block', label: 'site.block' },
    ],
  },
  {
    key: 'javascript',
    label: 'site.javascript',
    values: [
      { value: 'allow', label: 'site.allow' },
      { value: 'block', label: 'site.block' },
    ],
  },
  {
    key: 'popups',
    label: 'site.popups',
    values: [
      { value: 'default', label: 'site.popupsDefault' },
      { value: 'allow', label: 'site.allow' },
      { value: 'block', label: 'site.block' },
    ],
  },
  {
    key: 'fingerprinting',
    label: 'site.fingerprinting',
    values: [
      { value: 'on', label: 'site.protectionOn' },
      { value: 'off', label: 'site.protectionOff' },
    ],
  },
];

/** Lock popover → this site: cookies, JavaScript, fingerprint protection. Changes apply after a reload. */
export const SiteSettingsControls: React.FC<SiteSettingsControlsProps> = ({ webContentsId, onReload }) => {
  const { t } = useTranslation();
  const api = window.electronAPI?.siteSettings;
  const [state, setState] = useState<FreedomSiteSettings | null>(null);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    setChanged(false);
    if (!api || !webContentsId) {
      setState(null);
      return;
    }
    let alive = true;
    api.get(webContentsId).then((s) => alive && setState(s)).catch(() => alive && setState(null));
    return () => {
      alive = false;
    };
  }, [api, webContentsId]);

  if (!api || !webContentsId || !state) return null;

  return (
    <div id="site-settings" className="mt-3 pt-2.5 border-t border-white/[0.08] space-y-2">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono truncate" title={state.site}>
        {t('site.title', { site: state.site })}
      </div>
      {OPTIONS.map(({ key, label, values }) => {
        const disabled = key === 'fingerprinting' && !state.fingerprintProtection;
        return (
          <label key={key} className="flex items-center justify-between gap-3 text-[11px] text-neutral-300">
            <span>{t(label)}</span>
            <select
              id={`site-setting-${key}`}
              value={disabled ? 'off' : state.rules[key]}
              disabled={disabled}
              title={disabled ? t('site.protectionDisabledHint') : undefined}
              onChange={async (e) => {
                const next = await api.set(webContentsId, key, e.target.value).catch(() => null);
                if (next) {
                  setState(next);
                  setChanged(true);
                }
              }}
              className="max-w-[60%] bg-[var(--fb-input)] border border-[var(--fb-border)] rounded-md px-1.5 py-0.5 text-[11px] text-neutral-100 outline-none focus:border-emerald-500/50 disabled:opacity-50"
            >
              {values.map((v) => (
                <option key={v.value} value={v.value}>
                  {t(v.label)}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      {changed && (
        <button
          type="button"
          id="site-settings-reload"
          onClick={() => {
            setChanged(false);
            onReload();
          }}
          className="w-full mt-1 px-2 py-1 rounded-md flex items-center justify-center gap-1.5 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20"
        >
          <RotateCw className="w-3 h-3" />
          {t('site.reloadToApply')}
        </button>
      )}
    </div>
  );
};
