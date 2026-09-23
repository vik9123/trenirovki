/** 26 → «26», 1.25 → «1,25», 12500 → «12 500». */
export function formatKg(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const [int, frac] = String(Math.abs(rounded)).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (rounded < 0 ? '−' : '') + grouped + (frac ? ',' + frac : '');
}

/** Миллисекунды → «1:05» или «1:02:05». */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** «2026-09-23» → «ср, 23 сен». */
export function formatDate(iso: string): string {
  const d = parseDate(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Локальная дата в формате ГГГГ-ММ-ДД. */
export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Число из пользовательского ввода: запятая или точка. */
export function parseNumber(s: string): number | null {
  const n = Number(s.replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** plural(21, ['подход', 'подхода', 'подходов']) → «21 подход». */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  const word = m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  return `${n} ${word}`;
}
