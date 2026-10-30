'use client';

import React from 'react';

interface GhostLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  className?: string;
}

export function GhostLogo({
  size = 'md',
  animated = true,
  className = '',
}: GhostLogoProps) {
  const dimensions = {
    sm: 32,
    md: 56,
    lg: 84,
    xl: 120,
  }[size];

  return (
    <div
      className={`inline-flex items-center justify-center ${animated ? 'animate-ghost' : ''} ${className}`}
      style={{ width: dimensions, height: dimensions }}
      data-testid="ghost-logo"
      role="img"
      aria-label="REPOREVENANT Ghost"
    >
      <svg
        viewBox="0 0 100 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <radialGradient id="ghostGlow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#5eead4" stopOpacity="0.4" />
            <stop offset="60%" stopColor="#0f766e" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#07090c" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="bodyGrad" x1="50" y1="10" x2="50" y2="105" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f1f5f9" stopOpacity="0.95" />
            <stop offset="65%" stopColor="#5eead4" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.4" />
          </linearGradient>
          <filter id="eyeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feComposite in="SourceGraphic" in2="glow" operator="over" />
          </filter>
        </defs>

        {/* Ambient aura glow */}
        <circle cx="50" cy="50" r="45" fill="url(#ghostGlow)" />

        {/* Ghost flowing body */}
        <path
          d="M50 15C30 15 20 32 20 55C20 75 16 88 23 98C25.5 101.5 30 96 34 94C38 92 41 96 46 96C51 96 54 91 58 93C62 95 66 99 70 98C76 96 76 85 78 72C80 58 80 45 78 35C74 20 65 15 50 15Z"
          fill="url(#bodyGrad)"
        />

        {/* Spectral glowing eyes */}
        <circle cx="40" cy="45" r="4.5" fill="#07090c" />
        <circle cx="41.5" cy="44" r="1.5" fill="#5eead4" filter="url(#eyeGlow)" />

        <circle cx="60" cy="45" r="4.5" fill="#07090c" />
        <circle cx="61.5" cy="44" r="1.5" fill="#5eead4" filter="url(#eyeGlow)" />

        {/* Eerie mouth */}
        <ellipse cx="51" cy="58" rx="4" ry="5.5" fill="#07090c" opacity="0.85" />
      </svg>
    </div>
  );
}
