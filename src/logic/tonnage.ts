import { getSlot } from '../program';

export interface TSet {
  slotId: string;
  weight: number;
  value: number;
  done: boolean;
}

/** Сумма вес × повторения по выполненным подходам, как строка «Тоннаж» в Excel. */
export function tonnage(sets: TSet[]): number {
  let sum = 0;
  for (const s of sets) {
    if (s.done && getSlot(s.slotId).countsTonnage) sum += s.weight * s.value;
  }
  return Math.round(sum * 100) / 100;
}
