import React from 'react';

/** Decorative New Tab backdrop ("Theme"): soft glows in the palette's accent colour, pure CSS. */
export const NewTabWallpaper: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`wp wp-theme ${className}`} aria-hidden="true" />
);
