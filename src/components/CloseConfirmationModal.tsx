import React, { useEffect } from 'react';
import { X, Layers, AlertCircle, Save, LogOut } from 'lucide-react';
import { useTranslation } from '../i18n';

interface CloseConfirmationModalProps {
  isOpen: boolean;
  tabsCount: number;
  onConfirmCloseWithoutSaving: () => void;
  onConfirmSaveAndClose: () => void;
  onCancel: () => void;
}

export const CloseConfirmationModal: React.FC<CloseConfirmationModalProps> = ({
  isOpen,
  tabsCount,
  onConfirmCloseWithoutSaving,
  onConfirmSaveAndClose,
  onCancel,
}) => {
  const { t } = useTranslation();

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

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in app-no-drag"
      onClick={onCancel}
    >
      <div
        id="freedom-close-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--fb-surface)]/98 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_25px_80px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col text-neutral-200 animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[var(--fb-bg)] border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
            <h2 id="close-confirm-title" className="text-sm font-semibold text-white tracking-wide">
              {t('closeConfirm.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            title={t('closeConfirm.cancel')}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-neutral-400 shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-400/90" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-neutral-200 leading-relaxed">
                {t('closeConfirm.desc')}
              </p>
              <p className="text-xs text-neutral-400 font-mono">
                {tabsCount} {tabsCount === 1 ? 'tab' : 'tabs'} open
              </p>
            </div>
          </div>

          {/* Action Choice Buttons */}
          <div className="pt-2 flex flex-col gap-2.5">
            {/* "Нет" -> Keep tabs for next session & Exit */}
            <button
              type="button"
              onClick={onConfirmSaveAndClose}
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold text-xs tracking-wide transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <Save className="w-4 h-4" />
              <span>{t('closeConfirm.no')}</span>
            </button>

            {/* "Да" -> Discard tabs & Exit */}
            <button
              type="button"
              onClick={onConfirmCloseWithoutSaving}
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-900/90 hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/30 text-neutral-300 hover:text-rose-200 font-medium text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <LogOut className="w-4 h-4 text-neutral-400 hover:text-rose-300" />
              <span>{t('closeConfirm.yes')}</span>
            </button>

            {/* "Отмена" -> Cancel and remain in browser */}
            <button
              type="button"
              onClick={onCancel}
              className="w-full px-4 py-2 rounded-xl text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.05] text-xs transition-colors cursor-pointer"
            >
              {t('closeConfirm.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
