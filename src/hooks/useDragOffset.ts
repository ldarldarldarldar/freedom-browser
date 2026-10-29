import React, { useCallback, useEffect, useRef, useState } from 'react';

/** Offset stored as a fraction of the container size, so it follows window resizes. */
export interface DragOffset {
  fx: number;
  fy: number;
}

const DRAG_THRESHOLD_PX = 5;

const read = (key: string): DragOffset | null => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v && typeof v.fx === 'number' && typeof v.fy === 'number' ? v : null;
  } catch {
    return null;
  }
};

/** Event name used to reset every New Tab layout offset at once (Settings → reset layout). */
export const RESET_LAYOUT_EVENT = 'freedom-reset-newtab-layout';

/**
 * Lets an element be dragged anywhere inside `containerRef` (never past its edges) while it
 * keeps its place in the normal layout: the move is applied as a translate() offset.
 * Dragging starts after a small threshold so clicks on inner buttons/links still work;
 * a click that ends a drag is swallowed. Double-click resets. Inputs never start a drag.
 * Only active while `enabled` (layout edit mode); otherwise the element just keeps its saved place.
 */
export function useDragOffset(storageKey: string, containerRef: React.RefObject<HTMLElement | null>, enabled = true) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState<DragOffset | null>(() => read(storageKey));
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef<{
    startX: number;
    startY: number;
    baseDx: number;
    baseDy: number;
    natural: DOMRect;
    active: boolean;
    pointerId: number;
  } | null>(null);
  const swallowClick = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  useEffect(() => {
    const onReset = () => {
      setOffset(null);
      try {
        localStorage.removeItem(storageKey);
      } catch {}
    };
    window.addEventListener(RESET_LAYOUT_EVENT, onReset);
    return () => window.removeEventListener(RESET_LAYOUT_EVENT, onReset);
  }, [storageKey]);

  const dx = offset ? offset.fx * containerSize.w : 0;
  const dy = offset ? offset.fy * containerSize.h : 0;

  const save = useCallback(
    (next: DragOffset | null) => {
      setOffset(next);
      try {
        if (next) localStorage.setItem(storageKey, JSON.stringify(next));
        else localStorage.removeItem(storageKey);
      } catch {}
    },
    [storageKey]
  );

  // Latest offset for the window listeners (they outlive the render that created them)
  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !elRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, [data-no-drag]')) return;
    const rect = elRef.current.getBoundingClientRect();
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseDx: dx,
      baseDy: dy,
      // layout position without the current offset
      natural: new DOMRect(rect.left - dx, rect.top - dy, rect.width, rect.height),
      active: false,
      pointerId: e.pointerId,
    };

    // Window-level listeners: the pointer leaves the element as soon as it moves
    const onMove = (ev: PointerEvent) => {
      const d = drag.current;
      const container = containerRef.current;
      if (!d || !container) return;
      const mx = ev.clientX - d.startX;
      const my = ev.clientY - d.startY;
      if (!d.active) {
        if (Math.hypot(mx, my) < DRAG_THRESHOLD_PX) return;
        d.active = true;
        setIsDragging(true);
      }
      ev.preventDefault();
      const c = container.getBoundingClientRect();
      const nextDx = Math.min(Math.max(d.baseDx + mx, c.left - d.natural.left), c.right - d.natural.right);
      const nextDy = Math.min(Math.max(d.baseDy + my, c.top - d.natural.top), c.bottom - d.natural.bottom);
      setOffset({ fx: nextDx / (container.clientWidth || 1), fy: nextDy / (container.clientHeight || 1) });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const d = drag.current;
      drag.current = null;
      if (!d?.active) return;
      swallowClick.current = true;
      // a click may not follow (pointer released elsewhere): don't swallow the next real one
      setTimeout(() => (swallowClick.current = false), 0);
      setIsDragging(false);
      save(offsetRef.current);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (swallowClick.current) {
      swallowClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    save(null);
  };

  return {
    ref: elRef,
    isDragging,
    style: offset ? ({ transform: `translate(${dx}px, ${dy}px)` } as React.CSSProperties) : undefined,
    handlers: enabled
      ? {
          onPointerDown,
          onClickCapture,
          onDoubleClick,
          'data-layout-editable': '',
        }
      : {},
  };
}
