import { useState } from 'preact/hooks';
import { formatKg } from '../lib/format';

// Категориальная палитра (тёмная тема), порядок фиксирован; проверена валидатором dataviz
// на фоне #171a1e: CVD ΔE ≥ 8.4, контраст ≥ 3:1.
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500'];

const W = 340;
const H = 180;
const PAD = { l: 44, r: 8, t: 10, b: 26 };
const GRID = '#2e333a';
const INK = '#98a2ad';

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const short = (n: number) => (n >= 10_000 ? `${formatKg(Math.round(n / 1000))} т` : formatKg(Math.round(n)));

function YAxis({ max, fmt }: { max: number; fmt: (n: number) => string }) {
  const ih = H - PAD.t - PAD.b;
  return (
    <g>
      {[0, 0.5, 1].map((f) => {
        const y = PAD.t + ih * (1 - f);
        return (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke={GRID} stroke-width={1} />
            <text x={PAD.l - 6} y={y + 4} text-anchor="end" font-size="11" fill={INK}>{fmt(max * f)}</text>
          </g>
        );
      })}
    </g>
  );
}

export interface StackRow {
  label: string;
  values: number[];
}

/** Столбики тоннажа по неделям, сегменты — дни. Нажатие на столбик показывает значения. */
export function StackedBars({ rows, series }: { rows: StackRow[]; series: string[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const totals = rows.map((r) => r.values.reduce((a, b) => a + b, 0));
  const max = niceMax(Math.max(...totals));
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const band = iw / rows.length;
  const bw = Math.min(26, band * 0.62);
  const y = (v: number) => (v / max) * ih;

  return (
    <div>
      <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Тоннаж по неделям">
        <YAxis max={max} fmt={short} />
        {rows.map((r, i) => {
          const x = PAD.l + band * i + (band - bw) / 2;
          let base = PAD.t + ih;
          const segs = r.values.map((v, s) => {
            const h = y(v);
            const top = base - h;
            const el = h > 0 ? (
              <rect x={x} y={top} width={bw} height={Math.max(0, h - 2)} rx={s === lastNonZero(r.values) ? 4 : 0} fill={SERIES[s]} opacity={sel === null || sel === i ? 1 : 0.35} />
            ) : null;
            base = top;
            return el;
          });
          return (
            <g onClick={() => setSel(sel === i ? null : i)} style="cursor:pointer">
              <rect x={PAD.l + band * i} y={PAD.t} width={band} height={ih + PAD.b} fill="transparent" />
              {segs}
              <text x={x + bw / 2} y={H - 8} text-anchor="middle" font-size="11" fill={sel === i ? '#eef1f4' : INK}>{r.label}</text>
            </g>
          );
        })}
      </svg>
      <div class="legend">
        {series.map((s, i) => (
          <span><i style={{ background: SERIES[i] }} />{s}</span>
        ))}
      </div>
      {sel !== null && (
        <div class="muted small num" style="margin-top:6px">
          Неделя {rows[sel].label}: {series.map((s, i) => `${s} ${formatKg(Math.round(rows[sel].values[i]))}`).join(' · ')} · <b style="color:var(--text)">всего {formatKg(Math.round(totals[sel]))} кг</b>
        </div>
      )}
    </div>
  );
}

function lastNonZero(values: number[]): number {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] > 0) return i;
  return -1;
}

export interface Point {
  label: string;
  value: number;
  note: string;
}

/** Одна линия по датам. Нажатие на точку — подпись со значением. */
export function LineChart({ points, unit }: { points: Point[]; unit: string }) {
  const [sel, setSel] = useState<number | null>(points.length ? points.length - 1 : null);
  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const min = lo === hi ? Math.max(0, lo - 5) : Math.max(0, lo - (hi - lo) * 0.2);
  const max = lo === hi ? hi + 5 : hi + (hi - lo) * 0.2;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (points.length === 1 ? iw / 2 : (iw * i) / (points.length - 1));
  const y = (v: number) => PAD.t + ih * (1 - (v - min) / (max - min));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  const every = Math.ceil(points.length / 6);

  return (
    <div>
      <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`График, ${unit}`}>
        {[0, 0.5, 1].map((f) => {
          const v = min + (max - min) * f;
          return (
            <g>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={GRID} />
              <text x={PAD.l - 6} y={y(v) + 4} text-anchor="end" font-size="11" fill={INK}>{formatKg(Math.round(v * 10) / 10)}</text>
            </g>
          );
        })}
        {sel !== null && <line x1={x(sel)} x2={x(sel)} y1={PAD.t} y2={PAD.t + ih} stroke="#6b7580" stroke-dasharray="3 3" />}
        <path d={d} fill="none" stroke={SERIES[0]} stroke-width={2} stroke-linejoin="round" />
        {points.map((p, i) => (
          <g onClick={() => setSel(i)} style="cursor:pointer">
            <circle cx={x(i)} cy={y(p.value)} r={14} fill="transparent" />
            <circle cx={x(i)} cy={y(p.value)} r={sel === i ? 5 : 4} fill={SERIES[0]} stroke="#171a1e" stroke-width={2} />
            {(i % every === 0 || i === points.length - 1) && (
              <text x={x(i)} y={H - 8} text-anchor={points.length > 1 && i === points.length - 1 ? 'end' : points.length > 1 && i === 0 ? 'start' : 'middle'} font-size="11" fill={INK}>{p.label}</text>
            )}
          </g>
        ))}
      </svg>
      {sel !== null && points[sel] && (
        <div class="muted small num" style="margin-top:6px">
          {points[sel].note}
        </div>
      )}
    </div>
  );
}
