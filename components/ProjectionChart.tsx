"use client";

import { useMemo, useRef, useState } from "react";
import type { ProjectionPoint } from "@/lib/types";
import { eur0, fmtDate } from "@/lib/util";

interface Props {
  points: ProjectionPoint[];
  buffer: number;
  endLabel: string;
  lowestDay: number;
}

const W = 340;
const H = 150;
const PAD = { l: 8, r: 8, t: 22, b: 22 };

// white halo so labels stay readable where they cross the line
const HALO = { stroke: "var(--color-surface)", strokeWidth: 3, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };

export function ProjectionChart({ points, buffer, endLabel, lowestDay }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);

  const { x, y, path, area, ticks } = useMemo(() => {
    const vals = points.map((p) => p.balance).concat([buffer, 0]);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    const span = max - min || 1;
    min -= span * 0.08;
    max += span * 0.12;
    const x = (d: number) => PAD.l + (d / Math.max(1, points.length - 1)) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
    const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.balance).toFixed(1)}`).join("");
    const base = y(Math.max(min, 0));
    const area = `${path}L${x(points[points.length - 1].day).toFixed(1)},${base}L${x(0)},${base}Z`;
    const step = niceStep((max - min) / 3);
    const ticks: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v);
    return { x, y, path, area, ticks };
  }, [points, buffer]);

  const low = points[lowestDay];
  const lowBelow = low && low.balance < buffer;
  const hp = hover !== null ? points[hover] : null;

  function onMove(e: React.PointerEvent) {
    const svg = ref.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const d = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, d)));
  }

  return (
    <div className="relative select-none">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        role="img"
        aria-label={`Projected balance until payday. Lowest ${low ? eur0(low.balance) : ""} on ${low ? fmtDate(low.date) : ""}.`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={PAD.l} y={y(t) - 3} fontSize={9} fill="var(--color-ink-3)" className="tabular" {...HALO}>
              {eur0(t)}
            </text>
          </g>
        ))}

        {/* buffer reference */}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(buffer)} y2={y(buffer)} stroke="var(--color-warn)" strokeOpacity={0.55} strokeWidth={1} />
        <text x={W - PAD.r} y={y(buffer) - 4} textAnchor="end" fontSize={9} fill="var(--color-warn)" fontWeight={600} {...HALO}>
          Your buffer {eur0(buffer)}
        </text>


        <path d={area} fill="var(--color-accent)" fillOpacity={0.1} />
        <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* lowest point */}
        {low && (
          <g>
            <circle cx={x(low.day)} cy={y(low.balance)} r={5} fill={lowBelow ? "var(--color-warn)" : "var(--color-accent)"} stroke="var(--color-surface)" strokeWidth={2} />
            <text
              x={x(low.day) > W * 0.7 ? x(low.day) + 5 : x(low.day) < W * 0.3 ? x(low.day) - 5 : x(low.day)}
              y={y(low.balance) + 17}
              textAnchor={x(low.day) > W * 0.7 ? "end" : x(low.day) < W * 0.3 ? "start" : "middle"}
              fontSize={9.5}
              fontWeight={600}
              fill="var(--color-ink)"
              className="tabular"
              {...HALO}
            >
              Lowest {eur0(low.balance)} · {fmtDate(low.date)}
            </text>
          </g>
        )}

        {/* x labels */}
        <text x={PAD.l} y={H - 6} fontSize={9} fill="var(--color-ink-3)">
          Today
        </text>
        <text x={W - PAD.r} y={H - 6} fontSize={9} fill="var(--color-ink-2)" fontWeight={600} textAnchor="end">
          {endLabel} →
        </text>

        {/* hover crosshair */}
        {hp && (
          <g pointerEvents="none">
            <line x1={x(hp.day)} x2={x(hp.day)} y1={PAD.t - 4} y2={H - PAD.b} stroke="var(--color-ink-2)" strokeOpacity={0.4} strokeWidth={1} />
            <circle cx={x(hp.day)} cy={y(hp.balance)} r={4.5} fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute top-0 z-10 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] leading-tight text-white shadow-lg"
          style={{
            left: `${(x(hp.day) / W) * 100}%`,
            transform: `translateX(${x(hp.day) > W * 0.6 ? "-105%" : "5%"})`,
          }}
        >
          <div className="text-white/70">{fmtDate(hp.date)}</div>
          <div className="tabular font-semibold">{eur0(hp.balance)}</div>
          {hp.events.map((e, i) => (
            <div key={i} className="tabular text-white/80">
              {e.label} {e.amount > 0 ? "+" : "−"}
              {eur0(Math.abs(e.amount))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3.5 ? 2.5 : n < 7.5 ? 5 : 10) * p;
}
