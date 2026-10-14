import type { Day, DayId, Slot } from '../program';
import { DAYS } from '../program';

export const WEEKS = 8;

export function isDeload(week: number): boolean {
  return week === WEEKS;
}

/** Сколько подходов делать в этой неделе цикла. */
export function plannedSets(slot: Slot, week: number, cycleNumber: number): number {
  if (isDeload(week)) return Math.min(2, slot.sets);
  if (cycleNumber === 1 && week === 1) return Math.min(3, slot.sets);
  return slot.sets;
}

export function weekLabel(week: number, cycleNumber: number): string {
  if (isDeload(week)) return 'разгрузка';
  if (cycleNumber === 1 && week === 1) return 'калибровка';
  return '';
}

const WEEKDAY: Partial<Record<number, DayId>> = { 2: 'tue', 4: 'thu', 6: 'sat' };

/** День, совпадающий с сегодняшним, если он не сделан; иначе первый несделанный. */
export function suggestDay(done: DayId[], jsWeekday: number, days: Day[] = DAYS): DayId | null {
  const today = WEEKDAY[jsWeekday];
  if (today && !done.includes(today)) return today;
  return days.find((d) => !done.includes(d.id))?.id ?? null;
}
