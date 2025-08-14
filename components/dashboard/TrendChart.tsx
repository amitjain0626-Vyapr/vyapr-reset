// components/dashboard/TrendChart.tsx
// Lightweight, dependency-free SVG sparkline with tooltip.
// @ts-nocheck
"use client";

import { useMemo, useRef, useState } from "react";

type Point = { date: string; value: number };

export default function TrendChart({ points }: { points: Point[] }) {
  const width = 900;
  const height = 180;
  const padding = 16;

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<SVGSVGElement>(null);

  const { path, xScale, yScale, maxVal } = useMemo(() => {
    const xs = points.map((_, i) => i);
    const ys = points.map((p) => p.value);
    const maxX = Math.max(1, xs.length - 1);
    const maxY = Math.max(1, Math.max(...ys));

    const xScale = (i: number) =>
      padding + (i / maxX) * (width - padding * 2);
    const yScale = (v: number) =>
      height - padding - (v / maxY) * (height - padding * 2);

    const d = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(p.value)}`)
      .join(" ");

    return { path: d, xScale, yScale, maxVal: maxY };
  }, [points]);

  const hoverX = hoverIdx != null ? xScale(hoverIdx) : null;
  const hoverY =
    hoverIdx != null ? yScale(points[hoverIdx]?.value ?? 0) : null;

  return (
    <div className="h-full w-full overflow-hidden">
      <svg
        ref={containerRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const innerW = width - padding * 2;
          const ratio = Math.max(0, Math.min(1, (x - padding) / innerW));
          const idx = Math.round(ratio * (points.length - 1));
          setHoverIdx(idx);
        }}
      >
        {/* Background grid */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={padding}
            x2={width - padding}
            y1={height - padding - t * (height - padding * 2)}
            y2={height - padding - t * (height - padding * 2)}
            stroke="#e5e7eb"
            strokeDasharray="4 4"
          />
        ))}

        {/* Area fill (subtle) */}
        <path
          d={`${path} L ${width - padding} ${height - padding} L ${padding} ${
            height - padding
          } Z`}
          fill="url(#area)"
          opacity={0.2}
        />
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Line */}
        <path d={path} fill="none" stroke="currentColor" strokeWidth={2} />

        {/* Hover cursor */}
        {hoverIdx != null && hoverX != null && hoverY != null && (
          <>
            <line
              x1={hoverX}
              x2={hoverX}
              y1={padding}
              y2={height - padding}
              stroke="#d1d5db"
            />
            <circle cx={hoverX} cy={hoverY} r={4} fill="currentColor" />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {hoverIdx != null && (
        <div className="mt-2 text-xs text-gray-600">
          {points[hoverIdx]?.date} • ₹
          {(points[hoverIdx]?.value ?? 0).toLocaleString("en-IN")}
        </div>
      )}
    </div>
  );
}

