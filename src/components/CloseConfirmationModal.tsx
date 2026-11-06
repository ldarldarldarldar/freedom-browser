import React, { useEffect, useState } from 'react';
import { X, Globe, ArchiveRestore, PanelTopClose, VenetianMask } from 'lucide-react';
import { useTranslation } from '../i18n';
import { BrowserTab } from '../browser/types';

interface CloseConfirmationModalProps {
  isOpen: boolean;
  /** All open tabs; incognito ones are never kept and are only counted */
  tabs: BrowserTab[];
  /** remember: do the same from now on without asking (Settings → Main) */
  onConfirmCloseWithoutSaving: (remember: boolean) => void;
  onConfirmSaveAndClose: (remember: boolean) => void;
  onCancel: () => void;
}

const PREVIEW_COUNT = 4;

// Site icon, or a globe when there is none or it fails to load
const TabIcon: React.FC<{ src?: string }> = ({ src }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Globe className="w-3.5 h-3.5 shrink-0 text-[var(--fb-text-3)]" />;
  return <img src={src} alt="" className="w-3.5 h-3.5 shrink-0 rounded-sm" onError={() => setFailed(true)} />;
};

export const CloseConfirmationModal: React.FC<CloseConfirmationModalProps> = ({
  isOpen,
  tabs,
  onConfirmCloseWithoutSaving,
  onConfirmSaveAndClose,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [remember, setRemember] = useState(false);

  // Every opening starts unchecked: remembering is a decision, not a leftover from last time
  useEffect(() => {
    if (isOpen) setRemember(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const regularTabs = tabs.filter((tab) => !tab.isPrivate);
  const privateCount = tabs.length - regularTabs.length;
  const preview = regularTabs.slice(0, PREVIEW_COUNT);
  const more = regularTabs.length - preview.length;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in app-no-drag"
      onClick={onCancel}
    >
      <div
        id="freedom-close-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-confirm-title"
        aria-describedby="close-confirm-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-[var(--fb-radius-xl)] border border-[var(--fb-border)] bg-[var(--fb-surface)] shadow-[var(--fb-shadow-pop)] text-[var(--fb-text)] animate-scale-in overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 id="close-confirm-title" className="text-[15px] font-semibold tracking-tight">
              {t('closeConfirm.title')}
            </h2>
            <p id="close-confirm-desc" className="mt-1 text-xs text-[var(--fb-text-2)]">
              {t('closeConfirm.count', { count: regularTabs.length })}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            title={t('closeConfirm.cancel')}
            aria-label={t('closeConfirm.cancel')}
            className="p-1.5 -mr-1.5 -mt-1 rounded-[var(--fb-radius-sm)] text-[var(--fb-text-3)] hover:text-[var(--fb-text)] hover:bg-[var(--fb-surface-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Which tabs this is about */}
        <ul id="close-confirm-tabs" className="mx-5 mt-3.5 rounded-[var(--fb-radius-md)] border border-[var(--fb-border)] bg-[var(--fb-bg)] divide-y divide-[var(--fb-border)]">
          {preview.map((tab) => (
            <li key={tab.id} className="flex items-center gap-2.5 px-3 py-2 min-w-0">
              <TabIcon src={tab.favicon} />
              <span className="truncate text-xs text-[var(--fb-text-2)]">
                {tab.url.startsWith('freedom://newtab') ? t('tab.newTab') : tab.title || tab.url}
              </span>
            </li>
          ))}
          {more > 0 && (
            <li className="px-3 py-1.5 text-[11px] text-[var(--fb-text-3)]">{t('closeConfirm.more', { count: more })}</li>
          )}
        </ul>
        {privateCount > 0 && (
          <p className="mx-5 mt-2 flex items-center gap-1.5 text-[11px] text-[var(--fb-text-3)]">
            <VenetianMask className="w-3.5 h-3.5 shrink-0" />
            {t('closeConfirm.privateNote', { count: privateCount })}
          </p>
        )}

        {/* The two choices */}
        <div className="grid grid-cols-2 gap-2.5 px-5 mt-4">
          <button
            type="button"
            id="close-confirm-save"
            autoFocus
            onClick={() => onConfirmSaveAndClose(remember)}
            className="group flex flex-col items-start gap-2 p-3.5 rounded-[var(--fb-radius-lg)] text-left border border-[var(--fb-accent)] bg-[var(--fb-accent)] text-[var(--fb-on-accent)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fb-accent)] transition-opacity"
          >
            <ArchiveRestore className="w-5 h-5" strokeWidth={1.75} />
            <span className="text-[13px] font-semibold leading-tight">{t('closeConfirm.save')}</span>
            <span className="text-[11px] leading-snug opacity-80">{t('closeConfirm.saveHint')}</span>
          </button>
          <button
            type="button"
            id="close-confirm-discard"
            onClick={() => onConfirmCloseWithoutSaving(remember)}
            className="group flex flex-col items-start gap-2 p-3.5 rounded-[var(--fb-radius-lg)] text-left border border-[var(--fb-border)] bg-[var(--fb-bg)] hover:border-rose-500/50 hover:bg-rose-500/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 transition-colors"
          >
            <PanelTopClose className="w-5 h-5 text-[var(--fb-text-2)] group-hover:text-rose-300" strokeWidth={1.75} />
            <span className="text-[13px] font-semibold leading-tight">{t('closeConfirm.discard')}</span>
            <span className="text-[11px] leading-snug text-[var(--fb-text-2)]">{t('closeConfirm.discardHint')}</span>
          </button>
        </div>

        {/* Remember + cancel */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 mt-4 border-t border-[var(--fb-border)] bg-[var(--fb-bg)]">
          <label className="flex items-start gap-2 cursor-pointer select-none min-w-0">
            <input
              type="checkbox"
              id="close-confirm-remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 shrink-0 accent-[var(--fb-accent)] cursor-pointer"
            />
            <span className="min-w-0">
              <span className="block text-xs">{t('closeConfirm.remember')}</span>
              <span className="block text-[11px] text-[var(--fb-text-3)]">{t('closeConfirm.rememberHint')}</span>
            </span>
          </label>
          <button
            type="button"
            id="close-confirm-cancel"
            onClick={onCancel}
            className="shrink-0 px-3 py-1.5 rounded-[var(--fb-radius-md)] text-xs text-[var(--fb-text-2)] hover:text-[var(--fb-text)] hover:bg-[var(--fb-surface-hover)] transition-colors"
          >
            {t('closeConfirm.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
