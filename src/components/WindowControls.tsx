import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { tauriBridge, isDesktopEnvironment } from '../services/tauriBridge';

export const WindowControls: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Query initial maximized state
    tauriBridge.isWindowMaximized().then(setIsMaximized);

    // Subscribe to runtime window maximize/restore events
    if ((window as any).electronAPI?.on) {
      const unsub = (window as any).electronAPI.on(
        'window-maximized-change',
        (maximized: boolean) => {
          setIsMaximized(maximized);
        }
      );
      return unsub;
    }
  }, []);

  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    tauriBridge.minimizeWindow();
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = await tauriBridge.maximizeWindow();
    setIsMaximized(next);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    tauriBridge.closeWindow();
  };

  if (!isDesktopEnvironment()) {
    return null;
  }

  return (
    <div className="flex items-center h-full ml-1 border-l border-white/10 shrink-0 select-none app-no-drag">
      <button
        id="window-btn-minimize"
        type="button"
        onClick={handleMinimize}
        title="Minimize window"
        aria-label="Minimize"
        className="w-10 h-8 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      <button
        id="window-btn-maximize"
        type="button"
        onClick={handleMaximize}
        title={isMaximized ? 'Restore window' : 'Maximize window'}
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
        className="w-10 h-8 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer"
      >
        {isMaximized ? (
          <Copy className="w-3 h-3 rotate-180" />
        ) : (
          <Square className="w-3 h-3" />
        )}
      </button>

      <button
        id="window-btn-close"
        type="button"
        onClick={handleClose}
        title="Close Freedom"
        aria-label="Close"
        className="w-10 h-8 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-[#e81123] active:bg-[#c90f1d] transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
