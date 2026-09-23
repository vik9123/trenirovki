import { useEffect, useRef, useState } from 'preact/hooks';
import { formatDuration } from '../lib/format';
import { beep, buzz } from '../lib/sound';

export interface Rest {
  endAt: number;
  total: number;
  label: string;
}

/** Таймер отдыха. Время считается от отметки конца, поэтому верно и после блокировки экрана. */
export function RestBar({ rest, sound, onAdd, onStop }: { rest: Rest; sound: boolean; onAdd: () => void; onStop: () => void }) {
  const [now, setNow] = useState(Date.now());
  const alerted = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const left = rest.endAt - now;
  const over = left <= 0;

  useEffect(() => {
    if (!over || alerted.current === rest.endAt) return;
    alerted.current = rest.endAt;
    // Сигнал только если закончили «сейчас», а не вернулись в приложение через 10 минут.
    if (-left < 5000) {
      if (sound) beep();
      buzz();
    }
  }, [over, rest.endAt]);

  const pct = over ? 100 : Math.min(100, ((rest.total - left) / rest.total) * 100);

  return (
    <div class={`rest ${over ? 'over' : ''}`} role="timer" aria-live="off">
      <div class="fill" style={{ width: `${pct}%` }} />
      <div class="time num">
        {over ? 'Можно работать' : formatDuration(left + 999)}
        {!over && <small>{rest.label}</small>}
        {over && <small>+{formatDuration(-left)}</small>}
      </div>
      {!over && <button class="btn" onClick={onAdd}>+15 с</button>}
      <button class="btn" onClick={onStop}>{over ? 'Скрыть' : 'Стоп'}</button>
    </div>
  );
}
