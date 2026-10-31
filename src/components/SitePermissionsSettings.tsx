import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../i18n';

interface SitePermission {
  origin: string;
  permission: string;
  decision: 'allow' | 'block';
}

const PERMISSION_NAMES: Record<string, { en: string; ru: string }> = {
  'media:video': { en: 'Camera', ru: 'Камера' },
  'media:audio': { en: 'Microphone', ru: 'Микрофон' },
  geolocation: { en: 'Location', ru: 'Геолокация' },
  notifications: { en: 'Notifications', ru: 'Уведомления' },
  'clipboard-read': { en: 'Read clipboard', ru: 'Чтение буфера обмена' },
  midi: { en: 'MIDI devices', ru: 'MIDI-устройства' },
  midiSysex: { en: 'MIDI devices', ru: 'MIDI-устройства' },
  'storage-access': { en: 'Cookies in embedded pages', ru: 'Cookie на чужих страницах' },
};

/** Settings → Privacy: decisions saved for sites, with a way to take them back. */
export const SitePermissionsSettings: React.FC = () => {
  const { t, language } = useTranslation();
  const api = window.electronAPI?.sitePermissions;
  const [items, setItems] = useState<SitePermission[]>([]);

  const refresh = useCallback(async () => {
    if (api) setItems(await api.list());
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!api) return null;

  return (
    <div className="pt-3.5 border-t border-white/[0.06] space-y-2">
      <span className="block text-xs text-neutral-200 font-medium">{t('settings.sitePermissions')}</span>
      {items.length === 0 ? (
        <p className="text-xs text-neutral-400">{t('settings.sitePermissionsEmpty')}</p>
      ) : (
        <ul className="space-y-1 max-h-48 overflow-y-auto">
          {items.map(({ origin, permission, decision }) => (
            <li key={`${origin}|${permission}`} className="flex items-center justify-between gap-3 text-xs py-0.5">
              <span className="min-w-0 truncate text-neutral-300" title={origin}>{origin}</span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="text-neutral-400">
                  {PERMISSION_NAMES[permission]?.[language === 'ru' ? 'ru' : 'en'] || permission}
                  {' · '}
                  {decision === 'allow' ? t('settings.sitePermissionAllowed') : t('settings.sitePermissionBlocked')}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await api.remove(origin, permission);
                    refresh();
                  }}
                  className="text-neutral-200 underline underline-offset-2 hover:text-white cursor-pointer"
                >
                  {t('settings.sitePermissionReset')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
