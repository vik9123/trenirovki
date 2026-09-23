import { describe, expect, test } from 'vitest';
import { DAYS } from '../src/program';
import { isDeload, plannedSets, suggestDay, weekLabel } from '../src/logic/cycle';

const perDay = (week: number, cycle: number) =>
  DAYS.map((d) => d.slots.reduce((n, s) => n + plannedSets(d, s, week, cycle), 0));
const total = (week: number, cycle: number) => perDay(week, cycle).reduce((a, b) => a + b);

describe('подходы по неделям', () => {
  test('цикл 1: неделя 1 — калибровка, 4× → 3', () => {
    expect(perDay(1, 1)).toEqual([21, 24, 24, 21]);
    expect(total(1, 1)).toBe(90);
  });

  test('цикл 1: неделя 2 — чередование 4/3 внутри дня', () => {
    expect(perDay(2, 1)).toEqual([23, 27, 27, 25]);
    expect(total(2, 1)).toBe(102);
    const mon = DAYS[0];
    expect(mon.slots.map((s) => plannedSets(mon, s, 2, 1))).toEqual([4, 3, 4, 3, 3, 3, 3]);
  });

  test('цикл 1: недели 3-7 — полный объём', () => {
    for (let w = 3; w <= 7; w++) expect(total(w, 1)).toBe(113);
  });

  test('неделя 8 — разгрузка, 2 подхода', () => {
    expect(total(8, 1)).toBe(60);
    expect(total(8, 2)).toBe(60);
  });

  test('цикл 2+: без калибровки и чередования', () => {
    for (let w = 1; w <= 7; w++) expect(total(w, 2)).toBe(113);
  });
});

describe('метки недель', () => {
  test.each([
    [1, 1, 'калибровка'],
    [2, 1, 'вход'],
    [3, 1, ''],
    [8, 1, 'разгрузка'],
    [1, 2, ''],
    [2, 2, ''],
    [8, 3, 'разгрузка'],
  ])('неделя %i цикла %i → «%s»', (w, c, label) => {
    expect(weekLabel(w, c)).toBe(label);
  });

  test('isDeload', () => {
    expect(isDeload(8)).toBe(true);
    expect(isDeload(7)).toBe(false);
  });
});

describe('следующая тренировка', () => {
  // getDay(): 0 вс, 1 пн, 2 вт, 3 ср, 4 чт, 5 пт, 6 сб
  test('совпадает с днём недели, если не сделан', () => {
    expect(suggestDay([], 1)).toBe('mon');
    expect(suggestDay([], 2)).toBe('tue');
    expect(suggestDay([], 4)).toBe('thu');
    expect(suggestDay(['mon'], 5)).toBe('fri');
  });

  test('иначе — первый несделанный по порядку', () => {
    expect(suggestDay(['tue'], 2)).toBe('mon');
    expect(suggestDay([], 3)).toBe('mon');
    expect(suggestDay(['mon', 'tue'], 6)).toBe('thu');
    expect(suggestDay(['mon', 'tue', 'thu'], 0)).toBe('fri');
  });

  test('все сделаны — null', () => {
    expect(suggestDay(['mon', 'tue', 'thu', 'fri'], 1)).toBeNull();
  });
});
