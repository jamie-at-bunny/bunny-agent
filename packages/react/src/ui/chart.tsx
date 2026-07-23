"use client";

/**
 * Inline chart for agent `show_chart` UI blocks. Hand-rolled SVG — no chart
 * dependency — line/area/bar with hover tooltip and legend. Series colors
 * come from the `--chart-1..8` tokens defined in styles/index.css (override
 * via `--ba-chart-N`); the palette order is CVD-validated, so colors are
 * assigned strictly by series index.
 */
import type { UIBlock } from "@bunny.net/agent-core";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../lib/utils";

type ChartBlock = Extract<UIBlock, { type: "chart" }>;

const PLOT_HEIGHT = 180;
const MARGIN = { top: 10, right: 12, bottom: 22, left: 44 };

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const fullNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function useMeasuredWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      // Ignore 0-width reports: the transcript's content-visibility
      // optimization skips off-screen items, and unmounting the svg on
      // every skip makes item heights oscillate — the scroll-anchor spacer
      // then inflates forever chasing the layout changes.
      if (next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** 0-based "nice" tick values covering [min(0, dataMin), dataMax]. */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (max <= min) max = min + 1;
  const span = max - min;
  const rawStep = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const step =
    (residual >= 5 ? 10 : residual >= 2 ? 5 : residual >= 1 ? 2 : 1) *
    magnitude;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.999; v += step) {
    // Snap away float drift (0.30000000000000004 → 0.3).
    ticks.push(Number(v.toPrecision(12)));
  }
  return ticks;
}

function formatXLabel(value: string | number, long = false): string {
  if (typeof value === "number") return compactNumber.format(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        ...(long ? { year: "numeric" } : {}),
      });
    }
  }
  return !long && value.length > 14 ? `${value.slice(0, 13)}…` : value;
}

/** Rect path with only the data-end (top) corners rounded. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return [
    `M${x},${y + h}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + w - r}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `V${y + h}`,
    "Z",
  ].join("");
}

export function AgentChart({ block }: { block: ChartBlock }) {
  const [containerRef, width] = useMeasuredWidth();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { rows, series, ticks, yMin, yMax } = useMemo(() => {
    const series = block.series.map((s, i) => ({
      key: s.key,
      label: s.label ?? s.key,
      color: `var(--chart-${(i % 8) + 1})`,
    }));
    const rows = block.data.map((row) => ({
      x: row[block.xKey] ?? "",
      values: series.map((s) => {
        const value = Number(row[s.key]);
        return Number.isFinite(value) ? value : 0;
      }),
    }));
    const flat = rows.flatMap((row) => row.values);
    const dataMin = Math.min(0, ...flat);
    const dataMax = Math.max(1e-9, ...flat);
    const ticks = niceTicks(dataMin, dataMax);
    return {
      rows,
      series,
      ticks,
      yMin: ticks[0],
      yMax: ticks[ticks.length - 1],
    };
  }, [block]);

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const height = MARGIN.top + PLOT_HEIGHT + MARGIN.bottom;
  const n = rows.length;

  const yPos = (value: number) =>
    MARGIN.top + PLOT_HEIGHT - ((value - yMin) / (yMax - yMin)) * PLOT_HEIGHT;
  // Lines spread point-to-edge; bars use band centers.
  const band = n > 0 ? plotWidth / n : plotWidth;
  const xPos = (index: number) =>
    block.kind === "bar"
      ? MARGIN.left + band * (index + 0.5)
      : MARGIN.left + (n > 1 ? (plotWidth * index) / (n - 1) : plotWidth / 2);

  // Up to ~6 x labels: always first and last, evenly spaced between.
  const labelIndexes = useMemo(() => {
    if (n <= 6) return rows.map((_, i) => i);
    const count = Math.max(2, Math.min(6, Math.floor(plotWidth / 90)));
    const picked = new Set<number>();
    for (let i = 0; i < count; i++) {
      picked.add(Math.round(((n - 1) * i) / (count - 1)));
    }
    return [...picked];
  }, [n, plotWidth, rows]);

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (n === 0 || plotWidth <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left - MARGIN.left;
    const index =
      block.kind === "bar"
        ? Math.floor(px / band)
        : Math.round((px / plotWidth) * (n - 1));
    setHoverIndex(Math.max(0, Math.min(n - 1, index)));
  };

  const hovered = hoverIndex !== null ? rows[hoverIndex] : undefined;
  const tooltipLeft =
    hoverIndex !== null
      ? Math.max(70, Math.min(width - 70, xPos(hoverIndex)))
      : 0;

  const formatValue = (value: number) =>
    `${Math.abs(value) >= 10000 ? compactNumber.format(value) : fullNumber.format(value)}${
      block.unit ? ` ${block.unit}` : ""
    }`;

  return (
    <div className="ba:flex ba:w-full ba:min-w-0 ba:flex-col ba:gap-2 ba:rounded-xl ba:border ba:border-border ba:bg-background ba:p-3">
      {block.title && (
        <div className="ba:text-sm ba:font-medium ba:text-foreground">
          {block.title}
        </div>
      )}
      {series.length > 1 && (
        <div className="ba:flex ba:flex-wrap ba:items-center ba:gap-x-3 ba:gap-y-1">
          {series.map((s) => (
            <span
              key={s.key}
              className="ba:flex ba:items-center ba:gap-1.5 ba:text-xs ba:text-muted-foreground"
            >
              <span
                aria-hidden
                className="ba:size-2 ba:shrink-0 ba:rounded-full"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div ref={containerRef} className="ba:relative ba:w-full">
        {width > 0 && n > 0 && (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={block.title ?? "Chart"}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHoverIndex(null)}
            className="ba:block ba:touch-none ba:select-none"
          >
            {/* Hairline grid + y tick labels */}
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={yPos(tick)}
                  y2={yPos(tick)}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
                <text
                  x={MARGIN.left - 8}
                  y={yPos(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10}
                  style={{
                    fill: "var(--muted-foreground)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {compactNumber.format(tick)}
                </text>
              </g>
            ))}

            {/* Hover band (bars) or crosshair (lines/areas) */}
            {hoverIndex !== null &&
              (block.kind === "bar" ? (
                <rect
                  x={MARGIN.left + band * hoverIndex}
                  y={MARGIN.top}
                  width={band}
                  height={PLOT_HEIGHT}
                  fill="var(--foreground)"
                  opacity={0.05}
                />
              ) : (
                <line
                  x1={xPos(hoverIndex)}
                  x2={xPos(hoverIndex)}
                  y1={MARGIN.top}
                  y2={MARGIN.top + PLOT_HEIGHT}
                  stroke="var(--muted-foreground)"
                  strokeWidth={1}
                />
              ))}

            {/* Marks */}
            {block.kind === "bar"
              ? rows.map((row, rowIndex) => {
                  const groupWidth = band * 0.7;
                  const gap = series.length > 1 ? 2 : 0;
                  const barWidth =
                    (groupWidth - gap * (series.length - 1)) / series.length;
                  const groupStart =
                    MARGIN.left + band * rowIndex + band * 0.15;
                  return row.values.map((value, seriesIndex) => {
                    const top = Math.min(yPos(value), yPos(0));
                    const barHeight = Math.abs(yPos(value) - yPos(0));
                    return (
                      <path
                        // biome-ignore lint/suspicious/noArrayIndexKey: bar geometry is positional — row/series index is the identity.
                        key={`${rowIndex}-${seriesIndex}`}
                        d={barPath(
                          groupStart + seriesIndex * (barWidth + gap),
                          top,
                          Math.max(1, barWidth),
                          Math.max(barHeight, value === 0 ? 0 : 1),
                        )}
                        fill={series[seriesIndex].color}
                      />
                    );
                  });
                })
              : series.map((s, seriesIndex) => {
                  const points = rows.map(
                    (row, i) =>
                      [xPos(i), yPos(row.values[seriesIndex])] as const,
                  );
                  const line = points
                    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`)
                    .join("");
                  return (
                    <g key={s.key}>
                      {block.kind === "area" && (
                        <path
                          d={`${line}L${points[points.length - 1][0]},${yPos(
                            Math.max(0, yMin),
                          )}L${points[0][0]},${yPos(Math.max(0, yMin))}Z`}
                          fill={s.color}
                          opacity={0.12}
                        />
                      )}
                      <path
                        d={line}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      {hoverIndex !== null && (
                        <circle
                          cx={xPos(hoverIndex)}
                          cy={yPos(rows[hoverIndex].values[seriesIndex])}
                          r={4}
                          fill={s.color}
                          stroke="var(--background)"
                          strokeWidth={2}
                        />
                      )}
                    </g>
                  );
                })}

            {/* X labels */}
            {labelIndexes.map((index) => (
              <text
                key={index}
                x={xPos(index)}
                y={MARGIN.top + PLOT_HEIGHT + 15}
                textAnchor={
                  index === 0 ? "start" : index === n - 1 ? "end" : "middle"
                }
                fontSize={10}
                style={{ fill: "var(--muted-foreground)" }}
              >
                {formatXLabel(rows[index].x)}
              </text>
            ))}
          </svg>
        )}

        {hovered && (
          <div
            className="ba:pointer-events-none ba:absolute ba:top-0 ba:z-10 ba:-translate-x-1/2 ba:rounded-lg ba:border ba:border-border ba:bg-background ba:px-2.5 ba:py-1.5 ba:shadow-sm"
            style={{ left: tooltipLeft }}
          >
            <div className="ba:mb-0.5 ba:text-xs ba:font-medium ba:whitespace-nowrap ba:text-foreground">
              {formatXLabel(hovered.x, true)}
            </div>
            {series.map((s, i) => (
              <div
                key={s.key}
                className="ba:flex ba:items-center ba:gap-1.5 ba:text-xs ba:whitespace-nowrap ba:text-muted-foreground"
              >
                <span
                  aria-hidden
                  className="ba:size-2 ba:shrink-0 ba:rounded-full"
                  style={{ background: s.color }}
                />
                {series.length > 1 && <span>{s.label}</span>}
                <span
                  className={cn("ba:font-medium ba:text-foreground")}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatValue(hovered.values[i])}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
