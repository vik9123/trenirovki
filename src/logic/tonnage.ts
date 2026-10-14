export interface TSet {
  weight: number;
  value: number;
  done: boolean;
}

/** Сумма вес × повторения по выполненным подходам. Нужна, чтобы сравнивать недели между собой. */
export function tonnage(sets: TSet[]): number {
  let sum = 0;
  for (const s of sets) {
    if (s.done) sum += s.weight * s.value;
  }
  return Math.round(sum * 100) / 100;
}
