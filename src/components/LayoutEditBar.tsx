import React, { useEffect } from 'react';
import { Move, RotateCcw, Check } from 'lucide-react';
import { useTranslation } from '../i18n';

interface LayoutEditBarProps {
  onReset: () => void;
  onDone: () => void;
}

/** Floating bar shown while the layout edit mode is on (main menu → Edit layout). Esc also finishes. */
export const LayoutEditBar: React.FC<LayoutEditBarProps> = ({ onReset, onDone }) => {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  return (
    <div
      id="layout-edit-bar"
      role="toolbar"
      aria-label={t('layout.editTitle')}
      className="fixed left-1/2 bottom-6 -translate-x-1/2 z-[60] flex items-center gap-3 pl-3.5 pr-2 py-2 rounded-[var(--fb-radius-lg)] border border-[var(--fb-accent)] bg-[var(--fb-surface)] shadow-[var(--fb-shadow-pop)] text-[var(--fb-text)] animate-fade-in"
    >
      <Move className="w-4 h-4 shrink-0 text-[var(--fb-accent)]" />
      <div className="leading-tight">
        <div className="text-xs font-semibold">{t('layout.editTitle')}</div>
        <div className="text-[11px] text-[var(--fb-text-2)]">{t('layout.editHint')}</div>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--fb-radius-md)] text-xs text-[var(--fb-text-2)] hover:text-[var(--fb-text)] hover:bg-[var(--fb-surface-hover)] transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        {t('layout.reset')}
      </button>
      <button
        id="layout-edit-done"
        type="button"
        onClick={onDone}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--fb-radius-md)] text-xs font-medium bg-[var(--fb-accent)] text-[var(--fb-on-accent)] hover:opacity-90 transition-opacity"
      >
        <Check className="w-3.5 h-3.5" />
        {t('layout.editDone')}
      </button>
    </div>
  );
};
