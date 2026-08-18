"use client";

export function PrismLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <polygon
        points="32,4 58,18 58,46 32,60 6,46 6,18"
        fill="none"
        stroke="#d4d4d8"
        strokeWidth="3"
      />
      <polygon points="32,14 48,24 32,50 16,24" fill="#ececec" opacity="0.88" />
    </svg>
  );
}
