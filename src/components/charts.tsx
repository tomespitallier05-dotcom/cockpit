"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "cn";

/*
 * Small inline SVG charts. One series each, in the accent; thin marks (2px lines,
 * ≤24px bars with a 4px rounded data end), hairline recessive grid, a 2px surface
 * ring on end dots, and a hover layer on every plotted chart (crosshair on lines,
 * per-bar tooltip on bars). Text always uses text tokens, never the series color.
 */
const ACCENT = "#5b8cff";
const SURFACE = "#111113";
const GRID = "rgba(255,255,255,0.07)";

export type Point = { date: string; value: number };

function formatValue(value: number, unit?: string | null) {
  const abs = Math.abs(value);
  const text =
    abs >= 1_000_000
      ? `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`
      : abs >= 10_000
        ? `${(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k`
        : value.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  if (!unit) return text;
  return unit === "%" || unit === "€" ? `${text} ${unit}` : `${text} ${unit}`;
}

export function formatChartValue(value: number, unit?: string | null) {
  return formatValue(value, unit);
}

function shortDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Trend line for a stat tile: no axes, end dot on the latest value. */
export function Sparkline({ values, className, label }: { values: number[]; className?: string; label?: string }) {
  const gradient = useId();
  if (values.length < 2) return <div className={cn("h-8", className)} aria-hidden />;
  const width = 120;
  const height = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => 4 + (i / (values.length - 1)) * (width - 8);
  const y = (v: number) => 4 + (1 - (v - min) / span) * (height - 8);
  const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("h-8 w-full overflow-visible", className)} role="img" aria-label={label}>
      <defs>
        <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.14" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path}L${x(last)},${height}L${x(0)},${height}Z`} fill={`url(#${gradient})`} />
      <path d={path} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last)} cy={y(values[last])} r="4" fill={ACCENT} stroke={SURFACE} strokeWidth="2" />
    </svg>
  );
}

/** A KPI over time: hairline grid, crosshair + tooltip snapped to the nearest date. */
export function LineChart({ points, unit, height = 180, label }: { points: Point[]; unit?: string | null; height?: number; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const gradient = useId();
  const width = 640;
  const left = 44;
  const right = 16;
  const top = 12;
  const bottom = 24;
  const { min, max, ticks } = useMemo(() => {
    const values = points.map((p) => p.value);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const pad = (hi - lo) * 0.1;
    lo = lo >= 0 && lo - pad < 0 ? 0 : lo - pad;
    hi += pad;
    return { min: lo, max: hi, ticks: [lo, lo + (hi - lo) / 2, hi] };
  }, [points]);

  if (points.length === 0) return null;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const x = (i: number) => left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => top + (1 - (v - min) / (max - min)) * plotH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const last = points.length - 1;
  const active = hover ?? null;

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const ratio = (px - left) / plotW;
    setHover(Math.max(0, Math.min(last, Math.round(ratio * last))));
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={label}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover(last)}
        onBlur={() => setHover(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? last) - 1));
          if (event.key === "ArrowRight") setHover((h) => Math.min(last, (h ?? last) + 1));
        }}
      >
        <defs>
          <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.12" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke={GRID} strokeWidth="1" />
            <text x={left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-subtle text-[10px] tabular-nums">
              {formatValue(tick)}
            </text>
          </g>
        ))}
        <text x={x(0)} y={height - 6} textAnchor="start" className="fill-subtle text-[10px]">
          {shortDate(points[0].date)}
        </text>
        {last > 0 ? (
          <text x={x(last)} y={height - 6} textAnchor="end" className="fill-subtle text-[10px]">
            {shortDate(points[last].date)}
          </text>
        ) : null}
        <path d={`${path}L${x(last)},${top + plotH}L${x(0)},${top + plotH}Z`} fill={`url(#${gradient})`} />
        <path d={path} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {active !== null ? (
          <line x1={x(active)} x2={x(active)} y1={top} y2={top + plotH} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        ) : null}
        <circle cx={x(active ?? last)} cy={y(points[active ?? last].value)} r="4" fill={ACCENT} stroke={SURFACE} strokeWidth="2" />
      </svg>
      {active !== null ? (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-[12px] shadow-lg"
          style={{ left: `${(x(active) / width) * 100}%`, transform: `translateX(${active > last / 2 ? "-105%" : "5%"})` }}
          role="status"
        >
          <p className="font-medium text-foreground">{formatValue(points[active].value, unit)}</p>
          <p className="text-subtle">{shortDate(points[active].date)}</p>
        </div>
      ) : null}
    </div>
  );
}

export type Bar = { key: string; label: string; value: number; hint?: string };

/** Columns from one baseline; each column is its own hover/focus target. */
export function BarChart({ bars, height = 150, unit, label }: { bars: Bar[]; height?: number; unit?: string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 640;
  const top = 18;
  const bottom = 22;
  const plotH = height - top - bottom;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const band = width / Math.max(bars.length, 1);
  const barW = Math.min(24, band - 2);
  const r = Math.min(4, barW / 2);
  const peak = bars.reduce((best, bar, i) => (bar.value > (bars[best]?.value ?? -1) ? i : best), 0);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full select-none" role="img" aria-label={label}>
        <line x1="0" x2={width} y1={top + plotH} y2={top + plotH} stroke={GRID} strokeWidth="1" />
        {bars.map((bar, i) => {
          const h = (bar.value / max) * plotH;
          const cx = band * i + band / 2;
          const x0 = cx - barW / 2;
          const y0 = top + plotH - h;
          const showLabel = i === 0 || i === bars.length - 1 || i % Math.ceil(bars.length / 6) === 0;
          return (
            <g
              key={bar.key}
              tabIndex={0}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="outline-none"
            >
              <rect x={band * i} y={top} width={band} height={plotH} fill="transparent" />
              {h > 0 ? (
                <path
                  d={`M${x0},${top + plotH}V${y0 + r}Q${x0},${y0} ${x0 + r},${y0}H${x0 + barW - r}Q${x0 + barW},${y0} ${x0 + barW},${y0 + r}V${top + plotH}Z`}
                  fill={ACCENT}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              ) : null}
              {i === peak && bar.value > 0 ? (
                <text x={cx} y={y0 - 5} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">
                  {formatValue(bar.value)}
                </text>
              ) : null}
              {showLabel ? (
                <text x={cx} y={height - 6} textAnchor="middle" className="fill-subtle text-[10px]">
                  {bar.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {hover !== null ? (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 text-[12px] shadow-lg"
          style={{ left: `${((band * hover + band / 2) / width) * 100}%`, transform: `translateX(${hover > bars.length / 2 ? "-105%" : "5%"})` }}
          role="status"
        >
          <p className="font-medium text-foreground">{formatValue(bars[hover].value, unit)}</p>
          <p className="text-subtle">{bars[hover].hint ?? bars[hover].label}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Goal progress: accent fill on a lighter track of the same hue, and a thin
 * marker where progress should be by now if the pace were linear.
 */
export function ProgressMeter({ value, expected, label }: { value: number; expected?: number | null; label: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="relative h-2 w-full rounded-full bg-primary/15" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped * 100)}>
      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${clamped * 100}%` }} />
      {expected != null ? (
        <span
          className="absolute -top-1 h-4 w-0.5 rounded-full bg-foreground/60"
          style={{ left: `calc(${Math.max(0, Math.min(1, expected)) * 100}% - 1px)` }}
          title={`Rythme attendu : ${Math.round(expected * 100)} %`}
          aria-hidden
        />
      ) : null}
    </div>
  );
}
