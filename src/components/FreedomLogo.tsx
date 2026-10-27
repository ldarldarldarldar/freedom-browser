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
      <FreedomMark size={size} className="text-[var(--fb-text)]" />

      {showText && (
        <span className="text-base tracking-tight text-[var(--fb-text)]">
          Freedom <span className="text-[var(--fb-accent-soft)]">Browser</span>
        </span>
      )}
    </div>
  );
};

/** Monochrome slanted "F" mark used in the browser chrome (original artwork). */
export const FreedomMark: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={`shrink-0 ${className}`}
  >
    <path d="M8.6 3h12.2l-1.3 3.6H10.9z" />
    <path d="M7.4 9.4h10.3l-1.2 3.4H8.1z" opacity="0.9" />
    <path d="M6.2 3.9l2.9-.9-3.9 18H2z" />
  </svg>
);
