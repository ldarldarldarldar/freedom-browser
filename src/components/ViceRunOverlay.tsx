import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '../i18n';
import { createViceRun } from '../game/viceRun.js';

/** "VI" sidebar button: the Vice Run mini-game over the page. Unmounting stops its loop. */
export const ViceRunOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!canvasRef.current) return;
    const game = createViceRun(canvasRef.current, {
      labels: {
        health: t('vicerun.health'),
        ammo: t('vicerun.ammo'),
        score: t('vicerun.score'),
        wave: t('vicerun.wave'),
        best: t('vicerun.best'),
        reloading: t('vicerun.reloading'),
        gameOver: t('vicerun.gameOver'),
        playAgain: t('vicerun.playAgain'),
        hint: t('vicerun.hint'),
      },
    });
    game.start();
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('keydown', onEsc);
      game.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      id="vicerun-overlay"
      role="dialog"
      aria-label="Vice Run"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6 animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full h-full max-w-[1280px] max-h-[820px] rounded-[var(--fb-radius-xl)] overflow-hidden border border-[#ff2e88]/60 shadow-[0_0_32px_rgba(255,46,136,0.45)]">
        <canvas
          ref={canvasRef}
          id="vicerun-canvas"
          tabIndex={0}
          className="block w-full h-full outline-none cursor-none"
          onContextMenu={(e) => e.preventDefault()}
        />
        <button
          id="vicerun-close"
          type="button"
          onClick={onClose}
          title={t('vicerun.close')}
          aria-label={t('vicerun.close')}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-[#1a0b3b]/80 text-white border border-[#18e0d0]/60 hover:shadow-[0_0_12px_#18e0d0] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
