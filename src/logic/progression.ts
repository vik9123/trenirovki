import type { Equipment, Slot } from '../program';
import { formatKg } from '../lib/format';

export type Steps = Record<Equipment, number>;

export const DEFAULT_STEPS: Steps = {
  barbell: 2.5,
  smith: 2.5,
  dumbbell: 2,
  machine: 5,
  added: 1.25,
};

export interface PastSet {
  weight: number;
  value: number;
  done: boolean;
  pain: boolean;
}

/** Все запланированные подходы прошлой тренировки с этим упражнением. */
export interface Past {
  sets: PastSet[];
}

export interface Suggestion {
  weight: number;
  values: number[];
  hint: string;
  increased: boolean;
}

export interface SuggestArgs {
  slot: Slot;
  kind: 'heavy' | 'light';
  equipment: Equipment;
  count: number;
  past: Past | null;
  deload: boolean;
  steps: Steps;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Два правила программы:
 * тяжёлый день — набрали верх во всех подходах → вес + шаг;
 * лёгкий день — вес держим, растут повторения; дошли до верха → вес + шаг и назад к нижней границе.
 * В обоих случаях после повышения веса повторения начинаются с нижней границы.
 */
export function suggest({ slot, kind, equipment, count, past, deload, steps }: SuggestArgs): Suggestion {
  const floor = Array<number>(count).fill(slot.repMin);
  if (!past || !past.sets.some((s) => s.done)) {
    return { weight: 0, values: floor, hint: 'Калибровка: подберите рабочий вес', increased: false };
  }

  const done = past.sets.filter((s) => s.done);
  const weight = Math.max(...done.map((s) => s.weight));
  const previous = floor.map((min, i) => {
    const s = past.sets[i];
    return s && s.done ? s.value : min;
  });
  const hold = (hint: string): Suggestion => ({ weight, values: previous, hint, increased: false });

  if (deload) return hold('Разгрузка: веса те же, подходов меньше');
  if (past.sets.some((s) => s.pain)) return hold('В прошлый раз была боль — держим вес');

  const topReached = past.sets.length > 0 && past.sets.every((s) => s.done && s.value >= slot.repMax);
  if (topReached) {
    const step = steps[equipment];
    const sec = slot.unit === 'sec';
    const head = sec ? `${slot.repMax} с набраны` : 'Верх набран';
    const back = sec ? `, назад к ${slot.repMin} с` : kind === 'light' ? `, назад к ${slot.repMin}` : '';
    return { weight: round(weight + step), values: floor, hint: `${head} → +${formatKg(step)} кг${back}`, increased: true };
  }

  if (kind === 'heavy') return hold(`Держим вес, добиваем до ${slot.repMax}`);
  return hold(slot.unit === 'sec' ? 'Держим вес, +5 с' : 'Держим вес, +1 повтор');
}
