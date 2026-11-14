import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';

function useWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current!;
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** Graduations « rondes » de 0 au maximum (3 à 5 lignes). */
export function ticks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? magnitude);
  const values = [];
  for (let value = 0; value < max + step; value += step) values.push(value);
  return values;
}

const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 26, left: 30 };

function Tooltip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  // Bascule à gauche du repère quand il approche du bord droit.
  const flip = x > width - 150;
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-2 z-10 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lift"
      style={flip ? { right: width - x + 10 } : { left: x + 10 }}
    >
      {children}
    </div>
  );
}

interface LinePoint {
  label: string;
  /** Texte long pour l'infobulle. */
  title: string;
  actual: number | null;
  reference: number;
}

interface LineChartProps {
  points: LinePoint[];
  actualLabel: string;
  referenceLabel: string;
  /** Index des graduations à écrire sous l'axe. */
  xLabels: number[];
}

export function LineChart({ points, actualLabel, referenceLabel, xLabels }: LineChartProps) {
  const container = useRef<HTMLDivElement>(null);
  const width = useWidth(container);
  const [hover, setHover] = useState<number | null>(null);

  const yTicks = ticks(Math.max(...points.map((p) => Math.max(p.actual ?? 0, p.reference))));
  const yMax = yTicks.at(-1)!;
  const innerWidth = Math.max(1, width - PAD.left - PAD.right);
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
  const y = (value: number) => PAD.top + innerHeight - (value / yMax) * innerHeight;
  const line = (values: (number | null)[]) =>
    values
      .flatMap((value, index) => (value === null ? [] : [`${x(index).toFixed(1)} ${y(value).toFixed(1)}`]))
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point}`)
      .join(' ');

  const actual = points.map((p) => p.actual);
  const lastActual = actual.findLastIndex((value) => value !== null);

  return (
    <div
      ref={container}
      className="relative"
      onMouseLeave={() => setHover(null)}
      onMouseMove={(event) => {
        const offset = event.clientX - event.currentTarget.getBoundingClientRect().left - PAD.left;
        const index = Math.round((offset / innerWidth) * (points.length - 1));
        setHover(Math.min(points.length - 1, Math.max(0, index)));
      }}
    >
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-gentiane" /> {actualLabel}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-ink-3" /> {referenceLabel}
        </li>
      </ul>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={`${actualLabel} et ${referenceLabel}, jour par jour`}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-line" />
              <text x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" className="tabular fill-ink-3 text-[11px]">
                {tick}
              </text>
            </g>
          ))}
          {xLabels.map((index) => (
            <text
              key={index}
              x={x(index)}
              y={HEIGHT - 6}
              textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
              className="fill-ink-3 text-[11px]"
            >
              {points[index]!.label}
            </text>
          ))}
          <path d={line(points.map((p) => p.reference))} fill="none" className="stroke-ink-3" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d={line(actual)} fill="none" className="stroke-gentiane" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {lastActual >= 0 && (
            <circle cx={x(lastActual)} cy={y(actual[lastActual]!)} r="4.5" className="fill-gentiane stroke-surface" strokeWidth="2" />
          )}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerHeight} className="stroke-line-strong" />
              {points[hover]!.actual !== null && (
                <circle cx={x(hover)} cy={y(points[hover]!.actual!)} r="4.5" className="fill-gentiane stroke-surface" strokeWidth="2" />
              )}
            </g>
          )}
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={x(hover)} width={width}>
          <p className="font-medium first-letter:uppercase">{points[hover]!.title}</p>
          <p className="tabular text-ink-2">
            {actualLabel} : {points[hover]!.actual ?? 'à venir'}
          </p>
          <p className="tabular text-ink-2">
            {referenceLabel} : {points[hover]!.reference}
          </p>
        </Tooltip>
      )}
    </div>
  );
}

interface Bar {
  label: string;
  value: number;
  detail: string;
}

export function BarChart({ bars, unit }: { bars: Bar[]; unit: string }) {
  const container = useRef<HTMLDivElement>(null);
  const width = useWidth(container);
  const [hover, setHover] = useState<number | null>(null);

  const yTicks = ticks(Math.max(...bars.map((bar) => bar.value)));
  const yMax = yTicks.at(-1)!;
  const innerWidth = Math.max(1, width - PAD.left - PAD.right);
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = innerWidth / bars.length;
  const barWidth = Math.min(44, slot * 0.6);
  const center = (index: number) => PAD.left + slot * (index + 0.5);
  const y = (value: number) => PAD.top + innerHeight - (value / yMax) * innerHeight;

  return (
    <div ref={container} className="relative" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} role="img" aria-label={`${unit} par sprint`}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-line" />
              <text x={PAD.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle" className="tabular fill-ink-3 text-[11px]">
                {tick}
              </text>
            </g>
          ))}
          {bars.map((bar, index) => {
            const top = y(bar.value);
            const height = PAD.top + innerHeight - top;
            const left = center(index) - barWidth / 2;
            const radius = Math.min(4, height);
            return (
              <g key={bar.label} onMouseEnter={() => setHover(index)}>
                {/* Zone de survol sur toute la hauteur : une barre courte reste attrapable. */}
                <rect x={center(index) - slot / 2} y={PAD.top} width={slot} height={innerHeight} fill="transparent" />
                <path
                  d={`M${left} ${top + height} V${top + radius} Q${left} ${top} ${left + radius} ${top} H${left + barWidth - radius} Q${left + barWidth} ${top} ${left + barWidth} ${top + radius} V${top + height} Z`}
                  className={hover === index ? 'fill-gentiane-deep' : 'fill-gentiane'}
                />
                <text x={center(index)} y={HEIGHT - 6} textAnchor="middle" className="fill-ink-3 text-[11px]">
                  {bar.label.length > slot / 6.5 ? `${bar.label.slice(0, Math.max(3, Math.floor(slot / 6.5) - 1))}…` : bar.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={center(hover)} width={width}>
          <p className="font-medium">{bars[hover]!.label}</p>
          <p className="tabular text-ink-2">{bars[hover]!.detail}</p>
        </Tooltip>
      )}
    </div>
  );
}
