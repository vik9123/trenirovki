import type { Day, DayId, Slot } from '../program';
import { DAYS } from '../program';

export const WEEKS = 8;

export function isDeload(week: number): boolean {
  return week === WEEKS;
}

/** Сколько подходов делать в этой неделе цикла. */
export function plannedSets(day: Day, slot: Slot, week: number, cycleNumber: number): number {
  if (isDeload(week)) return Math.min(2, slot.sets);
  if (cycleNumber === 1 && week === 1) return Math.min(3, slot.sets);
  if (cycleNumber === 1 && week === 2 && slot.sets === 4) {
    // «Половина добавки»: упражнения 4× по порядку внутри дня — 4, 3, 4, 3…
    const fours = day.slots.filter((s) => s.sets === 4);
    return fours.indexOf(slot) % 2 === 0 ? 4 : 3;
  }
  return slot.sets;
}

export function weekLabel(week: number, cycleNumber: number): string {
  if (isDeload(week)) return 'разгрузка';
  if (cycleNumber === 1 && week === 1) return 'калибровка';
  if (cycleNumber === 1 && week === 2) return 'вход';
  return '';
}

const WEEKDAY: Partial<Record<number, DayId>> = { 1: 'mon', 2: 'tue', 4: 'thu', 5: 'fri' };

/** День, совпадающий с сегодняшним, если он не сделан; иначе первый несделанный. */
export function suggestDay(done: DayId[], jsWeekday: number): DayId | null {
  const today = WEEKDAY[jsWeekday];
  if (today && !done.includes(today)) return today;
  return DAYS.find((d) => !done.includes(d.id))?.id ?? null;
}
