import React from 'react';
import { NewTabWallpaperId } from '../settings/types';
import { StarCanvas } from './StarCanvas';

export const NEW_TAB_WALLPAPERS: { id: NewTabWallpaperId; labelKey: 'wallpaper.ridges' | 'wallpaper.theme' | 'wallpaper.space' | 'wallpaper.freedom' }[] = [
  { id: 'ridges', labelKey: 'wallpaper.ridges' },
  { id: 'theme', labelKey: 'wallpaper.theme' },
  { id: 'space', labelKey: 'wallpaper.space' },
  { id: 'freedom', labelKey: 'wallpaper.freedom' },
];

interface NewTabWallpaperProps {
  id: NewTabWallpaperId;
  /** Performance mode / thumbnails: static rendering, no CSS animations */
  isStatic?: boolean;
  className?: string;
  particleColor?: string;
}

// Gull-like silhouette, drawn once and reused (original artwork)
const BIRD = 'M0 6 C4 1 8 1 12 5 C16 1 20 1 24 6 C20 4 16 4 12 8 C8 4 4 4 0 6Z';

const BIRDS: { x: number; y: number; s: number; d: number }[] = [
  { x: 58, y: 34, s: 1.3, d: 0 },
  { x: 63, y: 30, s: 0.9, d: 1.2 },
  { x: 66, y: 37, s: 0.8, d: 2.1 },
  { x: 70, y: 27, s: 0.65, d: 0.6 },
  { x: 54, y: 39, s: 0.7, d: 1.7 },
  { x: 74, y: 33, s: 0.5, d: 2.6 },
];

/** Decorative New Tab backdrop: CSS/SVG only (plus the star canvas for "space" in quality mode). */
export const NewTabWallpaper: React.FC<NewTabWallpaperProps> = ({ id, isStatic = false, className = '', particleColor }) => {
  const anim = isStatic ? '' : ' wp-animated';

  if (id === 'theme') {
    return <div className={`wp wp-theme${anim} ${className}`} aria-hidden="true" />;
  }

  if (id === 'space') {
    return (
      <div className={`wp wp-space${anim} ${className}`} aria-hidden="true">
        {/* Static star field (always) */}
        <div className="wp-space__stars" />
        <div className="wp-space__planet" />
        {/* Animated stars only in quality mode: performance mode keeps the static CSS field */}
        {!isStatic && <StarCanvas enabled density="high" intensity="subtle" particleColor={particleColor || '#e8eefc'} />}
      </div>
    );
  }

  if (id === 'freedom') {
    return (
      <div className={`wp wp-freedom${anim} ${className}`} aria-hidden="true">
        <div className="wp-freedom__sun" />
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M0 62 Q25 60 50 62 T100 61 V100 H0Z" fill="var(--fb-bg)" opacity="0.55" />
          <path d="M0 70 Q30 66 55 70 T100 69 V100 H0Z" fill="var(--fb-bg)" opacity="0.85" />
          {/* sun path reflected on the water */}
          <path d="M48.5 62 L51.5 62 L55 100 L45 100Z" fill="url(#wpGlow)" opacity="0.18" />
          <defs>
            <linearGradient id="wpGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f3d9a4" />
              <stop offset="1" stopColor="#f3d9a4" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <svg className="wp-freedom__birds absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          {BIRDS.map((b, i) => (
            <g key={i} transform={`translate(${b.x} ${b.y}) scale(${b.s / 6})`}>
              <path
                d={BIRD}
                className="wp-freedom__bird"
                style={{ animationDelay: `${b.d}s` }}
                fill="var(--fb-text)"
                opacity="0.75"
              />
            </g>
          ))}
        </svg>
      </div>
    );
  }

  // 'ridges' — original reference-style backdrop: light beam over dark ridges
  return (
    <div className={`newtab-art ${className}`} aria-hidden="true">
      <div className="newtab-art__beam" />
      <svg className="absolute bottom-0 left-0 w-full h-[46%]" viewBox="0 0 1200 400" preserveAspectRatio="none">
        <path d="M0 250 L140 170 L260 230 L380 120 L520 210 L640 150 L760 210 L936 60 L1030 200 L1120 150 L1200 220 V400 H0Z" fill="var(--fb-surface)" opacity="0.55" />
        <path d="M0 310 L180 250 L330 300 L470 240 L600 290 L760 230 L900 300 L1050 250 L1200 290 V400 H0Z" fill="var(--fb-bg)" opacity="0.9" />
      </svg>
    </div>
  );
};
