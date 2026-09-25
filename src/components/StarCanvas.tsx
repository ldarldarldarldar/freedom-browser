import React, { useEffect, useRef } from 'react';
import { AnimationIntensity, StarDensity } from '../settings/types';

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  baseAlpha: number;
  speed: number;
  twinkleSpeed: number;
}

interface StarCanvasProps {
  density?: StarDensity;
  intensity?: AnimationIntensity;
  enabled?: boolean;
  particleColor?: string;
  className?: string;
}

export const StarCanvas: React.FC<StarCanvasProps> = ({
  density = 'medium',
  intensity = 'subtle',
  enabled = true,
  particleColor = '#f0f6fc',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled || intensity === 'paused') {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = !document.hidden;

    // Determine star count based on density
    const starCount = density === 'low' ? 60 : density === 'high' ? 180 : 100;
    const speedMultiplier = intensity === 'subtle' ? 0.12 : intensity === 'energetic' ? 0.6 : 0.28;

    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    // Initialize stars
    const stars: Star[] = [];
    for (let i = 0; i < starCount; i++) {
      const baseAlpha = Math.random() * 0.6 + 0.2;
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.1 + 0.4,
        alpha: baseAlpha,
        baseAlpha,
        speed: (Math.random() * 0.35 + 0.1) * speedMultiplier,
        twinkleSpeed: (Math.random() * 0.02 + 0.005) * (intensity === 'subtle' ? 0.8 : 1.4),
      });
    }

    // Handle resize efficiently with throttle
    let resizeTimeout: any;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!canvas || !canvas.parentElement) return;
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = canvas.parentElement.clientHeight;
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    // Pause animation completely when window is hidden or minimized
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        lastTime = performance.now();
        render();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    let lastTime = performance.now();

    const render = () => {
      if (!isVisible) return;

      const now = performance.now();
      const delta = Math.min((now - lastTime) / 16.67, 2);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      // Render stars
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        // Move star subtly upward
        star.y -= star.speed * delta;
        if (star.y < 0) {
          star.y = height;
          star.x = Math.random() * width;
        }

        // Gentle twinkle
        star.alpha += Math.sin(now * star.twinkleSpeed) * 0.015;
        star.alpha = Math.max(0.1, Math.min(0.85, star.alpha));

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = particleColor;
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [density, intensity, enabled, particleColor]);

  if (!enabled || intensity === 'paused') {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none z-0 ${className}`}
      style={{ willChange: 'contents' }}
    />
  );
};
