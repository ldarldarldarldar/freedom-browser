import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { useTranslation } from '../i18n';
import { MAX_ELEMENT_SCALE, MIN_ELEMENT_SCALE, ScalableElementId, useNewTabElements } from '../hooks/useNewTabElements';

interface ScaleStepperProps {
  id: ScalableElementId;
  className?: string;
}

/** − 100% + control for one browser element. Clicking the percentage returns it to the normal size. */
export const ScaleStepper: React.FC<ScaleStepperProps> = ({ id, className = '' }) => {
  const { t } = useTranslation();
  const { getScale, setElementScale, stepElementScale } = useNewTabElements();
  const scale = getScale(id);
  const button =
    'w-5 h-5 flex items-center justify-center rounded-full text-[var(--fb-text-2)] hover:text-[var(--fb-text)] hover:bg-[var(--fb-surface-hover)] disabled:opacity-40 disabled:pointer-events-none cursor-pointer';

  // Pointer and double-click events stay here: a press on the control must not start dragging the element
  return (
    <div
      data-no-drag
      data-scale-stepper={id}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`flex items-center gap-0.5 rounded-full ${className}`}
    >
      <button type="button" data-scale-down={id} title={t('layout.smaller')} aria-label={t('layout.smaller')} disabled={scale <= MIN_ELEMENT_SCALE} onClick={() => stepElementScale(id, -1)} className={button}>
        <Minus className="w-3 h-3" />
      </button>
      <button
        type="button"
        data-scale-value={id}
        title={t('layout.sizeReset')}
        aria-label={t('layout.sizeReset')}
        onClick={() => setElementScale(id, 1)}
        className="min-w-[34px] text-center text-[10.5px] tabular-nums text-[var(--fb-text-2)] hover:text-[var(--fb-text)] cursor-pointer"
      >
        {Math.round(scale * 100)}%
      </button>
      <button type="button" data-scale-up={id} title={t('layout.bigger')} aria-label={t('layout.bigger')} disabled={scale >= MAX_ELEMENT_SCALE} onClick={() => stepElementScale(id, 1)} className={button}>
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
};
