import { useEffect, useRef, useState } from 'preact/hooks';
import { formatKg, parseNumber } from '../lib/format';

interface Props {
  value: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  label: string;
}

/** Крупный «− значение +». Нажатие на значение — ввод с цифровой клавиатуры. */
export function Stepper({ value, step, unit, onChange, label }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const set = (v: number) => onChange(Math.max(0, Math.round(v * 100) / 100));

  useEffect(() => {
    if (draft !== null) {
      input.current?.focus();
      input.current?.select();
    }
  }, [draft !== null]);

  const commit = () => {
    const n = draft === null ? null : parseNumber(draft);
    if (n !== null && n !== value) set(n);
    setDraft(null);
  };

  return (
    <div class="stepper">
      <button type="button" aria-label={`${label}: меньше`} onClick={() => set(value - step)}>−</button>
      {draft !== null ? (
        <input
          ref={input}
          type="text"
          inputMode="decimal"
          aria-label={label}
          value={draft}
          onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      ) : (
        <button type="button" class="val num" aria-label={`${label}: ${formatKg(value)} ${unit}, изменить`} onClick={() => setDraft(formatKg(value).replace(/\s/g, ''))}>
          <b>{formatKg(value)}</b>
          <small>{unit}</small>
        </button>
      )}
      <button type="button" aria-label={`${label}: больше`} onClick={() => set(value + step)}>+</button>
    </div>
  );
}
