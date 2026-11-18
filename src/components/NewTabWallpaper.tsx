import React from 'react';

/**
 * Decorative New Tab backdrop ("Theme"): soft glows in the palette's accent colour, pure CSS.
 * The Vice City scene (sunset, sun, palms, ocean) is only shown by src/styles/vice-city.css.
 */
export const NewTabWallpaper: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`wp wp-theme ${className}`} aria-hidden="true">
    <svg className="vc-scene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="vc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a0b3b" />
          <stop offset="0.45" stopColor="#5a1a6e" />
          <stop offset="0.72" stopColor="#ff2e88" />
          <stop offset="0.9" stopColor="#ff8a3d" />
        </linearGradient>
        <linearGradient id="vc-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd36b" />
          <stop offset="0.6" stopColor="#ff8a3d" />
          <stop offset="1" stopColor="#ff2e88" />
        </linearGradient>
        <linearGradient id="vc-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a1870" />
          <stop offset="1" stopColor="#0b0420" />
        </linearGradient>
        <clipPath id="vc-sun-cut">
          {/* horizontal gaps through the lower half of the sun */}
          <rect x="0" y="0" width="1600" height="560" />
          {[580, 604, 626, 646, 664].map((y, i) => (
            <rect key={y} x="0" y={y} width="1600" height={16 - i * 2.5} />
          ))}
        </clipPath>
      </defs>
      <rect width="1600" height="700" fill="url(#vc-sky)" />
      <circle cx="800" cy="600" r="210" fill="url(#vc-sun)" clipPath="url(#vc-sun-cut)" />
      <rect y="690" width="1600" height="210" fill="url(#vc-sea)" />
      <g stroke="#18e0d0" strokeOpacity="0.45" strokeWidth="2">
        <line x1="420" y1="712" x2="1180" y2="712" />
        <line x1="300" y1="740" x2="1300" y2="740" />
        <line x1="160" y1="780" x2="1440" y2="780" />
        <line x1="0" y1="840" x2="1600" y2="840" />
      </g>
      <rect y="688" width="1600" height="4" fill="#ff2e88" opacity="0.8" />
      {/* skyline */}
      <path
        d="M0 690V610h60v-40h50v70h40V560h70v130h30v-90h60v90h40V520h50v170h1200V600h-50v-60h-60v150h-40v-110h-70v110h-40V580h-60v110h-50v-80H1340v80h-40V640h-60v50z"
        fill="#2a0b45"
        opacity="0.9"
      />
      {/* palms */}
      <g fill="#0b0420">
        <path d="M150 900c18-160 40-290 92-400l12 6c-46 110-66 238-80 394z" />
        <path d="M248 500c-60-30-130-20-180 20 60-10 120-8 170 10zM248 500c40-60 110-80 180-60-70 10-130 40-170 74zM248 500c-10-60-50-110-110-130 40 40 70 90 90 140zM248 500c70-10 140 20 180 80-60-40-120-60-176-60zM248 500c-50 10-100 50-120 110 40-50 80-80 126-96z" />
        <path d="M1440 900c-10-140-30-250-80-350l-12 5c44 100 62 210 70 345z" />
        <path d="M1356 550c50-30 120-28 170 6-56-6-112 0-164 16zM1356 550c-30-56-96-80-160-66 64 12 116 40 150 76zM1356 550c14-56 54-100 110-116-38 36-66 80-84 126zM1356 550c-64-6-128 22-166 76 56-36 112-54 164-56z" />
      </g>
    </svg>
  </div>
);
