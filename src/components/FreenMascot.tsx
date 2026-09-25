import React from 'react';
import freenImg from '../assets/freen-mascot.png';

interface FreenMascotProps {
  enabled: boolean;
}

export const FreenMascot: React.FC<FreenMascotProps> = ({ enabled }) => {
  if (!enabled) return null;

  return (
    <div
      id="freedom-mascot-freen"
      className="fixed bottom-2.5 right-3.5 z-30 select-none pointer-events-none"
      aria-hidden="true"
    >
      <img
        src={freenImg}
        alt="Freen Mascot"
        className="w-20 md:w-24 h-auto object-contain select-none pointer-events-none"
        style={{
          filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.75))',
        }}
        draggable={false}
      />
    </div>
  );
};
