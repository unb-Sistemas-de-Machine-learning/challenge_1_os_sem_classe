import React from 'react';

export function LogoIcon({ width = 36, height = 36, className = "" }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="12" fill="#ffffff" fillOpacity="0.15" />
      {/* Cápsula em ângulo */}
      <g transform="rotate(-30 24 24)">
        {/* Metade superior da pílula */}
        <path d="M 17 24 L 17 15 A 7 7 0 0 1 31 15 L 31 24 Z" fill="#ffffff" />
        {/* Metade inferior da pílula */}
        <path d="M 17 24 L 31 24 L 31 33 A 7 7 0 0 1 17 33 Z" fill="#2dd4bf" />
        {/* Cruz Médica no centro */}
        <rect x="22" y="20" width="4" height="8" rx="1" fill="#0f6b5c" />
        <rect x="20" y="22" width="8" height="4" rx="1" fill="#0f6b5c" />
      </g>
    </svg>
  );
}
