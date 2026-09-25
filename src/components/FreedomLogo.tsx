import React from 'react';

interface FreedomLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export const FreedomLogo: React.FC<FreedomLogoProps> = ({
  size = 28,
  className = '',
  showText = false,
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200"
      >
        {/* Dark Green Shield (#052e16) with subtle mint border (#10b981) */}
        <path
          d="M256 32 C340 32 440 64 440 64 C440 220 380 376 256 480 C132 376 72 220 72 64 C72 64 172 32 256 32 Z"
          fill="#052e16"
          stroke="#10b981"
          strokeWidth="10"
          strokeLinejoin="round"
        />

        {/* Clean Minimalist Geometric Mint Green "F" (#34d399) */}
        <path
          d="M180 140 H336 V196 H244 V244 H316 V300 H244 V372 H180 Z"
          fill="#34d399"
        />
      </svg>

      {showText && (
        <span className="font-semibold tracking-wide text-white text-base flex items-center gap-1.5">
          <span>FREEDOM</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
            Browser
          </span>
        </span>
      )}
    </div>
  );
};
