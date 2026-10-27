import React from 'react';
import { DockEdge } from '../settings/types';
import { useTranslation } from '../i18n';

interface DockDropOverlayProps {
  /** Edge under the pointer (nearest window edge) */
  activeEdge: DockEdge;
  /** Edges the dragged panel may dock to */
  edges: DockEdge[];
}

const ZONE: Record<DockEdge, string> = {
  top: 'top-0 left-0 right-0 h-24',
  bottom: 'bottom-0 left-0 right-0 h-24',
  left: 'top-0 bottom-0 left-0 w-40',
  right: 'top-0 bottom-0 right-0 w-40',
};

/**
 * Full-window layer shown while a panel (sidebar / toolbar) is dragged by its grip.
 * It also sits above the <webview>s so pointer moves are not swallowed by web pages.
 */
export const DockDropOverlay: React.FC<DockDropOverlayProps> = ({ activeEdge, edges }) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-[70] cursor-grabbing bg-black/25" aria-hidden="true">
      {edges.map((edge) => (
        <div
          key={edge}
          className={`absolute ${ZONE[edge]} flex items-center justify-center border-2 border-dashed transition-colors ${
            edge === activeEdge
              ? 'border-[var(--fb-accent)] bg-[color-mix(in_srgb,var(--fb-accent)_18%,transparent)]'
              : 'border-[var(--fb-border-strong)] bg-[color-mix(in_srgb,var(--fb-surface)_40%,transparent)]'
          }`}
        >
          {edge === activeEdge && (
            <span className="px-2.5 py-1 rounded-[var(--fb-radius-md)] bg-[var(--fb-surface)] text-[11px] text-[var(--fb-text)]">
              {t('layout.dropHere')}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

/** Nearest window edge to a pointer position. */
export const nearestEdge = (x: number, y: number): DockEdge => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const d: [DockEdge, number][] = [
    ['left', x / w],
    ['right', (w - x) / w],
    ['top', y / h],
    ['bottom', (h - y) / h],
  ];
  return d.sort((a, b) => a[1] - b[1])[0][0];
};
