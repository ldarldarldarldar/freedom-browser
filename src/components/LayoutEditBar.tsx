import React, { useEffect, useState } from 'react';
import { Move, RotateCcw, Check, LayoutGrid, Plus, X } from 'lucide-react';
import { useTranslation } from '../i18n';
import { TranslationKey } from '../i18n/translations';
import { ClockStyle, NEW_TAB_ELEMENTS, NewTabElementId, useNewTabElements } from '../hooks/useNewTabElements';

interface LayoutEditBarProps {
  onReset: () => void;
  onDone: () => void;
  /** New Tab elements are only visible on a New Tab page: offer to open one from anywhere else */
  isNewTabActive: boolean;
  onOpenNewTab: () => void;
}

const ELEMENT_LABELS: Record<NewTabElementId, TranslationKey> = {
  title: 'layout.element.title',
  search: 'layout.element.search',
  links: 'layout.element.links',
  clock: 'layout.element.clock',
  quote: 'layout.element.quote',
};

const CLOCK_STYLES: { id: ClockStyle; label: TranslationKey }[] = [
  { id: 'cube', label: 'layout.clockStyle.cube' },
  { id: 'big', label: 'layout.clockStyle.big' },
];

/** Floating bar shown while the layout edit mode is on (main menu → Edit layout). Esc also finishes. */
export const LayoutEditBar: React.FC<LayoutEditBarProps> = ({ onReset, onDone, isNewTabActive, onOpenNewTab }) => {
  const { t } = useTranslation();
  const { isVisible, setElementVisible, clockStyle, setClockStyle } = useNewTabElements();
  const [isElementsOpen, setIsElementsOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  return (
    <div className="fixed left-1/2 bottom-6 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 max-w-[calc(100vw-32px)] animate-fade-in">
      {isElementsOpen && (
        <div
          id="layout-elements-panel"
          className="w-[300px] p-2 rounded-[var(--fb-radius-lg)] border border-[var(--fb-border-strong)] bg-[var(--fb-surface)] shadow-[var(--fb-shadow-pop)] text-[var(--fb-text)]"
        >
          {!isNewTabActive && (
            <button
              type="button"
              onClick={onOpenNewTab}
              className="w-full mb-1.5 px-2 py-1.5 rounded-[var(--fb-radius-md)] text-left text-[11px] text-[var(--fb-accent-soft)] hover:bg-[var(--fb-surface-hover)] transition-colors"
            >
              {t('layout.openNewTab')}
            </button>
          )}
          {NEW_TAB_ELEMENTS.map((id) => {
            const visible = isVisible(id);
            return (
              <div key={id} className="flex items-center justify-between gap-2 pl-2 py-0.5">
                <span className={`text-xs ${visible ? '' : 'text-[var(--fb-text-3)]'}`}>{t(ELEMENT_LABELS[id])}</span>
                <button
                  type="button"
                  id={`layout-element-${id}`}
                  onClick={() => setElementVisible(id, !visible)}
                  className="flex items-center gap-1 px-2 py-1 rounded-[var(--fb-radius-md)] text-[11px] text-[var(--fb-text-2)] hover:text-[var(--fb-text)] hover:bg-[var(--fb-surface-hover)] transition-colors"
                >
                  {visible ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {t(visible ? 'layout.removeElement' : 'layout.addElement')}
                </button>
              </div>
            );
          })}
          <div className="mt-1.5 pt-2 px-2 pb-1 border-t border-[var(--fb-border)]">
            <div className="mb-1.5 text-[11px] text-[var(--fb-text-2)]">{t('layout.clockStyle')}</div>
            <div className="grid grid-cols-2 gap-1">
              {CLOCK_STYLES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  id={`layout-clock-style-${id}`}
                  aria-pressed={clockStyle === id}
                  onClick={() => setClockStyle(id)}
                  className={`px-2 py-1.5 rounded-[var(--fb-radius-md)] border text-[11px] transition-colors ${
                    clockStyle === id
                      ? 'border-[var(--fb-accent)] text-[var(--fb-text)] bg-[var(--fb-surface-hover)]'
                      : 'border-[var(--fb-border)] text-[var(--fb-text-2)] hover:text-[var(--fb-text)] hover:bg-[var(--fb-surface-hover)]'
                  }`}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div
        id="layout-edit-bar"
        role="toolbar"
        aria-label={t('layout.editTitle')}
        className="flex items-center gap-3 pl-3.5 pr-2 py-2 rounded-[var(--fb-radius-lg)] border border-[var(--fb-accent)] bg-[var(--fb-surface)] shadow-[var(--fb-shadow-pop)] text-[var(--fb-text)]"
      >
        <Move className="w-4 h-4 shrink-0 text-[var(--fb-accent)]" />
        <div className="leading-tight">
          <div className="text-xs font-semibold">{t('layout.editTitle')}</div>
          <div className="text-[11px] text-[var(--fb-text-2)]">{t('layout.editHint')}</div>
        </div>
        <button
          type="button"
          id="layout-elements-toggle"
          aria-expanded={isElementsOpen}
          onClick={() => setIsElementsOpen((v) => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--fb-radius-md)] text-xs hover:text-[var(--fb-text)] hover:bg-[var(--fb-surface-hover)] transition-colors whitespace-nowrap ${
            isElementsOpen ? 'text-[var(--fb-text)] bg-[var(--fb-surface-hover)]' : 'text-[var(--fb-text-2)]'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          {t('layout.elements')}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--fb-radius-md)] text-xs text-[var(--fb-text-2)] hover:text-[var(--fb-text)] hover:bg-[var(--fb-surface-hover)] transition-colors whitespace-nowrap"
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
    </div>
  );
};
