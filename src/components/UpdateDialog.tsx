import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, RefreshCw } from 'lucide-react';
import { useTranslation } from '../i18n';
import { TranslationKey } from '../i18n/translations';

type Phase = 'available' | 'downloading' | 'ready' | 'installing';

interface UpdateDialogProps {
  update: FreedomUpdateInfo;
  activeDownloads: number;
  /** Saves the open tabs: they come back after the restart */
  onBeforeInstall: () => void;
  onOpenUrl: (url: string) => void;
  onClose: () => void;
}

const ERROR_TEXT: Record<string, TranslationKey> = {
  network: 'update.errorNetwork',
  verify: 'update.errorVerify',
  write: 'update.errorWrite',
  declined: 'update.errorDeclined',
};

const toMegabytes = (bytes: number) => (bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0);

/** "Update available": changelog, then one click downloads, verifies, installs and restarts. */
export const UpdateDialog: React.FC<UpdateDialogProps> = ({ update, activeDownloads, onBeforeInstall, onOpenUrl, onClose }) => {
  const { t, language } = useTranslation();
  const [phase, setPhase] = useState<Phase>('available');
  const [progress, setProgress] = useState({ received: 0, total: update.size });
  const [error, setError] = useState<TranslationKey | null>(null);
  const [isHidden, setIsHidden] = useState(false);
  const isHiddenRef = useRef(false);
  isHiddenRef.current = isHidden;
  const activeDownloadsRef = useRef(activeDownloads);
  activeDownloadsRef.current = activeDownloads;

  const updates = window.electronAPI?.updates;
  const notes = (language === 'ru' ? update.notes.ru : update.notes.en) || update.notes.ru || update.notes.en;

  useEffect(() => {
    return window.electronAPI?.on?.('update-progress', (value: { received: number; total: number }) => setProgress(value));
  }, []);

  const install = useCallback(async () => {
    setPhase('installing');
    setIsHidden(false);
    setError(null);
    onBeforeInstall();
    const result = await updates?.install();
    if (result?.ok) return; // the browser is closing
    setPhase('ready');
    setError(ERROR_TEXT[result?.error ?? ''] ?? 'update.errorGeneric');
  }, [onBeforeInstall, updates]);

  const startUpdate = async () => {
    setPhase('downloading');
    setError(null);
    const result = await updates?.download();
    if (!result?.ok) {
      setPhase('available');
      setIsHidden(false);
      if (result?.error !== 'cancelled') setError(ERROR_TEXT[result?.error ?? ''] ?? 'update.errorGeneric');
      return;
    }
    // Restart right away unless the user went back to browsing or has files still downloading
    if (isHiddenRef.current || activeDownloadsRef.current > 0) {
      setPhase('ready');
      setIsHidden(false);
      return;
    }
    await install();
  };

  if (isHidden) return null;

  const secondaryButton =
    'px-3 py-1.5 rounded-[var(--fb-radius-md)] border border-[var(--fb-border)] bg-[var(--fb-surface)] hover:bg-[var(--fb-surface-hover)] text-xs transition-colors';
  const primaryButton =
    'flex items-center gap-1.5 px-3.5 py-1.5 rounded-[var(--fb-radius-md)] bg-[var(--fb-accent)] text-[var(--fb-on-accent)] text-xs font-medium hover:opacity-90 transition-opacity';
  const percent = progress.total > 0 ? Math.min(100, Math.round((progress.received / progress.total) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        id="update-dialog"
        data-phase={phase}
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-dialog-title"
        className="w-full max-w-md rounded-[var(--fb-radius-xl)] border border-[var(--fb-border-strong)] bg-[var(--fb-surface)] shadow-[var(--fb-shadow-pop)] text-[var(--fb-text)] p-5"
      >
        <h2 id="update-dialog-title" className="text-[15px] font-medium">
          {t('update.title', { version: update.version })}
        </h2>
        <p className="mt-1 text-[11.5px] text-[var(--fb-text-2)]">
          {t('update.current', { version: update.currentVersion })}
          {update.size > 0 && ` · ${toMegabytes(update.size)} MB`}
        </p>

        {notes && (
          <div id="update-notes" className="mt-3.5 max-h-52 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-[var(--fb-text-2)]">
            {notes}
          </div>
        )}

        <button
          type="button"
          id="update-release-link"
          onClick={() => {
            onOpenUrl(update.releaseUrl);
            if (phase === 'downloading') setIsHidden(true);
            else if (phase === 'available') onClose();
          }}
          className="mt-3 flex items-center gap-1 text-[11.5px] text-[var(--fb-accent-soft)] hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          {t('update.fullChangelog')}
        </button>

        {update.mode === 'link' && <p className="mt-3 text-[11.5px] text-[var(--fb-text-2)]">{t('update.manualHint')}</p>}

        {phase === 'ready' && activeDownloads > 0 && (
          <p className="mt-3 text-[11.5px] text-[var(--fb-danger)]">{t('update.downloadsWarning', { count: activeDownloads })}</p>
        )}

        {error && (
          <p id="update-error" role="alert" className="mt-3 text-[11.5px] text-[var(--fb-danger)]">
            {t(error)}
          </p>
        )}

        {phase === 'downloading' && (
          <div className="mt-4">
            <div className="h-1.5 rounded-full bg-[var(--fb-surface-hover)] overflow-hidden">
              <div id="update-progress" className="h-full bg-[var(--fb-accent)] transition-[width]" style={{ width: `${percent}%` }} />
            </div>
            <div className="mt-1.5 text-[11px] tabular-nums text-[var(--fb-text-2)]">
              {percent}% · {toMegabytes(progress.received)} / {toMegabytes(progress.total)} MB
            </div>
          </div>
        )}

        {phase === 'installing' && <p className="mt-4 text-xs text-[var(--fb-text-2)]">{t('update.installing')}</p>}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {phase === 'available' && (
            <>
              <button
                type="button"
                id="update-skip"
                onClick={() => {
                  updates?.skip();
                  onClose();
                }}
                className="mr-auto text-[11.5px] text-[var(--fb-text-3)] hover:text-[var(--fb-text)]"
              >
                {t('update.skip')}
              </button>
              <button type="button" id="update-later" onClick={onClose} className={secondaryButton}>
                {t('update.later')}
              </button>
              {update.mode === 'install' ? (
                <button type="button" id="update-now" onClick={startUpdate} className={primaryButton}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  {t('update.now')}
                </button>
              ) : (
                <button
                  type="button"
                  id="update-download-page"
                  onClick={() => {
                    onOpenUrl(update.releaseUrl);
                    onClose();
                  }}
                  className={primaryButton}
                >
                  <Download className="w-3.5 h-3.5" />
                  {t('update.download')}
                </button>
              )}
            </>
          )}
          {phase === 'downloading' && (
            <>
              <button type="button" id="update-cancel" onClick={() => updates?.cancel()} className={secondaryButton}>
                {t('update.cancel')}
              </button>
              <button type="button" id="update-hide" onClick={() => setIsHidden(true)} className={secondaryButton}>
                {t('update.background')}
              </button>
            </>
          )}
          {phase === 'ready' && (
            <>
              <button type="button" id="update-later" onClick={onClose} className={secondaryButton}>
                {t('update.later')}
              </button>
              <button type="button" id="update-restart" onClick={install} className={primaryButton}>
                <RefreshCw className="w-3.5 h-3.5" />
                {t('update.restart')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
