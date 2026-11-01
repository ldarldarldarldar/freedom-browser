import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../i18n';
import { ScalableElementId, useNewTabElements } from '../hooks/useNewTabElements';

type DockEdge = 'left' | 'right' | 'top' | 'bottom';

interface ResizeHandleProps {
  id: ScalableElementId;
  /** Corner handle: the point of the element that stays put while it grows, in fractions of its box */
  anchor?: { x: number; y: number };
  /** Panel handle: the window edge the panel is docked to; the handle runs along its opposite side */
  dock?: DockEdge;
  /** Corner handle: where it sits. Bottom right unless something usually covers that corner. */
  corner?: 'bottom-right' | 'top-left';
}

// Close to the normal size the handle sticks to it, so 100% is easy to hit
const SNAP_TO_NORMAL = 0.03;
// A press without a real move stays a click, so double-click can reach the handle
const DRAG_THRESHOLD_PX = 3;
const KEYBOARD_KEYS: Record<string, 1 | -1> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };

const PANEL_POSITION: Record<DockEdge, string> = {
  left: 'top-0 bottom-0 right-0 w-1.5 cursor-ew-resize',
  right: 'top-0 bottom-0 left-0 w-1.5 cursor-ew-resize',
  top: 'left-0 right-0 bottom-0 h-1.5 cursor-ns-resize',
  bottom: 'left-0 right-0 top-0 h-1.5 cursor-ns-resize',
};

/**
 * Layout edit mode: drag this to change the size of an element, double-click for the normal size.
 * It sits inside the element's box, whose offset drag must not start from here.
 */
export const ResizeHandle: React.FC<ResizeHandleProps> = ({ id, anchor = { x: 0.5, y: 0.5 }, dock, corner = 'bottom-right' }) => {
  const { t } = useTranslation();
  const { getScale, setElementScale, stepElementScale } = useNewTabElements();
  const scale = getScale(id);
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const cursor = dock ? (dock === 'left' || dock === 'right' ? 'cursor-ew-resize' : 'cursor-ns-resize') : 'cursor-nwse-resize';

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const box = ref.current?.parentElement?.getBoundingClientRect();
    if (!box) return;

    const startScale = scale;
    const stay = dock
      ? { x: dock === 'right' ? 1 : 0, y: dock === 'bottom' ? 1 : 0 }
      : anchor;
    const anchorX = box.left + box.width * stay.x;
    const anchorY = box.top + box.height * stay.y;
    // Size follows how far the pointer moved along the line from the fixed point through the press point.
    // A panel only grows across its edge, so the other axis does not count.
    const vx = dock === 'top' || dock === 'bottom' ? 0 : e.clientX - anchorX;
    const vy = dock === 'left' || dock === 'right' ? 0 : e.clientY - anchorY;
    const lengthSquared = vx * vx + vy * vy;
    if (lengthSquared < 1) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let active = false;
    const onMove = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
        active = true;
        setIsDragging(true);
      }
      const ratio = ((ev.clientX - anchorX) * vx + (ev.clientY - anchorY) * vy) / lengthSquared;
      const next = startScale * ratio;
      setElementScale(id, Math.abs(next - 1) < SNAP_TO_NORMAL ? 1 : next);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setIsDragging(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    const direction = KEYBOARD_KEYS[e.key];
    if (!direction) return;
    e.preventDefault();
    stepElementScale(id, direction);
  };

  const label = t('layout.resizeHint');

  return (
    <>
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={Math.round(scale * 100)}
        title={label}
        data-no-drag
        data-resize-handle={id}
        onPointerDown={onPointerDown}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setElementScale(id, 1);
        }}
        onKeyDown={onKeyDown}
        className={
          dock
            ? `absolute z-40 app-no-drag touch-none bg-[var(--fb-accent)] opacity-60 hover:opacity-100 ${PANEL_POSITION[dock]}`
            : `absolute ${corner === 'top-left' ? '-top-3 -left-3' : '-bottom-3 -right-3'} z-10 w-4 h-4 rounded-full border-2 border-[var(--fb-surface)] bg-[var(--fb-accent)] app-no-drag touch-none hover:brightness-125 ${cursor}`
        }
        // A panel's handle lives inside the panel's own zoom: keep it the same size at any scale
        style={dock ? { zoom: 1 / scale } : undefined}
      />
      {/* Page-wide layer while dragging: tabs (webviews) under the pointer must not take the mouse events */}
      {isDragging &&
        createPortal(
          <div className={`fixed inset-0 z-[80] flex items-start justify-center pt-4 ${cursor}`} data-resize-overlay={id}>
            <span className="px-2.5 py-1 rounded-full border border-[var(--fb-border-strong)] bg-[var(--fb-surface-3)] text-xs tabular-nums text-[var(--fb-text)] shadow-[var(--fb-shadow-pop)]">
              {Math.round(scale * 100)}%
            </span>
          </div>,
          document.body
        )}
    </>
  );
};
