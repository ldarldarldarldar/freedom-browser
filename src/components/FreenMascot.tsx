import React, { useState } from 'react';
import freenImg from '../assets/freen-mascot.png';

interface FreenMascotProps {
  enabled: boolean;
}

export const FreenMascot: React.FC<FreenMascotProps> = ({ enabled }) => {
  const [isHovered, setIsHovered] = useState(false);

  if (!enabled) return null;

  return (
    <div
      id="freedom-mascot-freen"
      className="fixed bottom-2.5 right-3.5 z-30 select-none pointer-events-none transition-all duration-300"
      style={{
        opacity: isHovered ? 1 : 0.92,
      }}
    >
      <div className="relative flex flex-col items-center">
        {/* Subtle tooltip */}
        {isHovered && (
          <div className="absolute -top-7 right-0 px-2.5 py-0.5 rounded-md bg-neutral-900/95 border border-white/10 text-[11px] text-white font-medium shadow-2xl whitespace-nowrap animate-fade-in pointer-events-none flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Freen Mascot</span>
          </div>
        )}

        {/* Mascot Character Image */}
        <div
          className="pointer-events-auto cursor-pointer"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          title="Freen — Freedom Browser Mascot"
        >
          <img
            src={freenImg}
            alt="Freen"
            className="w-20 md:w-24 h-auto object-contain transition-transform duration-200 hover:scale-105"
            style={{
              filter:
                'drop-shadow(0 8px 20px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.35))',
            }}
          />
        </div>
      </div>
    </div>
  );
};
