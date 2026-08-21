"use client";

import { cn } from "@/lib/utils";
import { useId } from "react";

/**
 * PrismLoot mark: hexagon shell + inner crystal.
 * Idle = slow refraction sweep. `pulse` = loading beat. Hover via `.group`.
 */
export function PrismLogo({
  className = "h-8 w-8",
  pulse = false,
}: {
  className?: string;
  /** Stronger motion for loading / gate states. */
  pulse?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const clipId = `prism-clip-${uid}`;
  const beamId = `prism-beam-${uid}`;
  const facetL = `prism-fl-${uid}`;
  const facetR = `prism-fr-${uid}`;
  const facetB = `prism-fb-${uid}`;
  const sheenId = `prism-sheen-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("prism-logo", pulse && "is-pulse", className)}
      aria-hidden
    >
      <defs>
        {/* Left / right / base facets — cool neutrals that cyan can light through. */}
        <linearGradient id={facetL} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f4f4f5" />
          <stop offset="100%" stopColor="#a1a1aa" />
        </linearGradient>
        <linearGradient id={facetR} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e4e4e7" />
          <stop offset="100%" stopColor="#71717a" />
        </linearGradient>
        <linearGradient id={facetB} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#d4d4d8" />
          <stop offset="100%" stopColor="#52525b" />
        </linearGradient>

        {/* Moving refraction beam clipped to the crystal. */}
        <linearGradient id={beamId} x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%" stopColor="#2fddb0" stopOpacity="0" />
          <stop offset="38%" stopColor="#2fddb0" stopOpacity="0" />
          <stop offset="50%" stopColor="#b8ffe8" stopOpacity="1" />
          <stop offset="62%" stopColor="#2fddb0" stopOpacity="0" />
          <stop offset="100%" stopColor="#2fddb0" stopOpacity="0" />
        </linearGradient>

        {/* Soft rim catch on the outer hex. */}
        <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2fddb0" stopOpacity="0" />
          <stop offset="45%" stopColor="#2fddb0" stopOpacity="0" />
          <stop offset="50%" stopColor="#2fddb0" stopOpacity="0.9" />
          <stop offset="55%" stopColor="#2fddb0" stopOpacity="0" />
          <stop offset="100%" stopColor="#2fddb0" stopOpacity="0" />
        </linearGradient>

        <clipPath id={clipId}>
          <polygon points="32,14 48,24 32,50 16,24" />
        </clipPath>
      </defs>

      {/* Pointy-top regular hex @ (32,32), R=28; path starts mid-right to hide stroke seam */}
      <path
        className="prism-logo-shell"
        d="M56.249 32 L56.249 46 L32 60 L7.751 46 L7.751 18 L32 4 L56.249 18 Z"
        fill="none"
        stroke="#d4d4d8"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="prism-logo-rim"
        d="M56.249 32 L56.249 46 L32 60 L7.751 46 L7.751 18 L32 4 L56.249 18 Z"
        fill="none"
        stroke={`url(#${sheenId})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <g className="prism-logo-crystal">
        <polygon points="32,14 16,24 32,50" fill={`url(#${facetL})`} />
        <polygon points="32,14 48,24 32,50" fill={`url(#${facetR})`} />
        <polygon points="16,24 48,24 32,50" fill={`url(#${facetB})`} opacity="0.92" />
        <polyline
          points="32,14 32,50"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </g>

      {/* Light through the prism */}
      <g clipPath={`url(#${clipId})`}>
        <rect
          className="prism-logo-beam"
          x="-20"
          y="-20"
          width="104"
          height="104"
          fill={`url(#${beamId})`}
        />
      </g>
    </svg>
  );
}
