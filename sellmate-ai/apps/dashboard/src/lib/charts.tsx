'use client';

import { useState } from 'react';

/**
 * رسوم بيانية بسيطة بـ SVG (بلا مكتبات خارجية) وفق مبادئ dataviz:
 * سلسلة واحدة لكل رسم، خطوط شبكة خافتة، تسميات بألوان حِبر (لا لون السلسلة)،
 * ألوان مُتحقَّقة، وطبقة hover مع tooltip.
 */

export interface ChartPoint {
  label: string;
  value: number;
}

// ألوان سلسلة مُتحقَّقة من لوحة dataviz (سلسلة واحدة لكل رسم — لا تعارض CVD).
export const CHART_COLORS = {
  blue: '#2a78d6',
  aqua: '#1baf7a',
  violet: '#4a3aa7',
  orange: '#eb6834',
};

const INK = { grid: '#e1e0d9', baseline: '#c3c2b7', muted: '#898781' };

interface ChartProps {
  data: ChartPoint[];
  type?: 'area' | 'bar';
  color?: string;
  height?: number;
  format?: (v: number) => string;
}

export function Chart({ data, type = 'area', color = CHART_COLORS.blue, height = 180, format }: ChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = height;
  const P = { top: 12, right: 14, bottom: 26, left: 44 };
  const iw = W - P.left - P.right;
  const ih = H - P.top - P.bottom;
  const n = Math.max(1, data.length);
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = format ?? ((v: number) => Math.round(v).toLocaleString('ar'));

  const px = (i: number) => P.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const bandW = iw / n;
  const bx = (i: number) => P.left + i * bandW + bandW / 2;
  const py = (v: number) => P.top + ih - (v / max) * ih;

  const ticks = 3;
  const gridLines = Array.from({ length: ticks + 1 }, (_, k) => ({
    y: P.top + (k / ticks) * ih,
    val: max * (1 - k / ticks),
  }));

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(d.value)}`).join(' ');
  const areaPath =
    data.length > 0 ? `${linePath} L ${px(n - 1)} ${P.top + ih} L ${px(0)} ${P.top + ih} Z` : '';
  const barW = bandW * 0.6;
  const labelStep = Math.max(1, Math.ceil(n / 6));

  const hoverX = hover === null ? 0 : type === 'bar' ? bx(hover) : px(hover);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {gridLines.map((g, k) => (
          <g key={k}>
            <line x1={P.left} x2={W - P.right} y1={g.y} y2={g.y} stroke={INK.grid} strokeWidth={1} />
            <text x={P.left - 8} y={g.y + 3} textAnchor="end" fontSize="10" fill={INK.muted}>
              {fmt(g.val)}
            </text>
          </g>
        ))}
        <line
          x1={P.left}
          x2={W - P.right}
          y1={P.top + ih}
          y2={P.top + ih}
          stroke={INK.baseline}
          strokeWidth={1}
        />

        {type === 'area' ? (
          <>
            <path d={areaPath} fill={color} opacity={0.12} />
            <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
            {data.map((d, i) => (
              <circle key={i} cx={px(i)} cy={py(d.value)} r={hover === i ? 4 : 0} fill={color} />
            ))}
          </>
        ) : (
          data.map((d, i) => {
            const h = (d.value / max) * ih;
            return (
              <rect
                key={i}
                x={bx(i) - barW / 2}
                y={P.top + ih - h}
                width={barW}
                height={Math.max(0, h)}
                rx={3}
                fill={color}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
            );
          })
        )}

        {data.map((d, i) =>
          i % labelStep === 0 || i === n - 1 ? (
            <text
              key={`x${i}`}
              x={type === 'bar' ? bx(i) : px(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize="9"
              fill={INK.muted}
            >
              {d.label}
            </text>
          ) : null,
        )}

        {data.map((d, i) => (
          <rect
            key={`h${i}`}
            x={type === 'bar' ? bx(i) - bandW / 2 : px(i) - bandW / 2}
            y={P.top}
            width={bandW}
            height={ih}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>

      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow"
          style={{ left: `${(hoverX / W) * 100}%`, top: 4 }}
        >
          {data[hover].label} · {fmt(data[hover].value)}
        </div>
      )}
    </div>
  );
}

/** يختصر تاريخ ISO (YYYY-MM-DD) إلى يوم/شهر للمحور. */
export function shortDate(iso: string): string {
  const parts = iso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : iso;
}
