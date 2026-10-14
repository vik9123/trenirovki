import { describe, expect, test } from 'vitest';
import { DAYS } from '../src/program';
import { isDeload, plannedSets, suggestDay, weekLabel } from '../src/logic/cycle';

const perDay = (week: number, cycle: number) => DAYS.map((d) => d.slots.reduce((n, s) => n + plannedSets(s, week, cycle), 0));
const total = (week: number, cycle: number) => perDay(week, cycle).reduce((a, b) => a + b);

describe('подходы по неделям', () => {
  test('цикл 1, неделя 1 — калибровка: 4 подхода → 3', () => {
    expect(perDay(1, 1)).toEqual([21, 21, 21]);
    expect(total(1, 1)).toBe(63);
  });

  test('недели 2-7 — полный объём 76', () => {
    expect(perDay(2, 1)).toEqual([25, 25, 26]);
    for (let w = 2; w <= 7; w++) expect(total(w, 1)).toBe(76);
  });

  test('неделя 8 — разгрузка, по 2 подхода', () => {
    expect(total(8, 1)).toBe(42);
    expect(total(8, 2)).toBe(42);
  });

  test('цикл 2+ — без калибровки', () => {
    for (let w = 1; w <= 7; w++) expect(total(w, 2)).toBe(76);
  });
});

describe('метки недель', () => {
  test.each([
    [1, 1, 'калибровка'],
    [2, 1, ''],
    [8, 1, 'разгрузка'],
    [1, 2, ''],
    [8, 3, 'разгрузка'],
  ])('неделя %i цикла %i → «%s»', (w, c, label) => {
    expect(weekLabel(w, c)).toBe(label);
  });

  test('isDeload', () => {
    expect(isDeload(8)).toBe(true);
    expect(isDeload(7)).toBe(false);
  });
});

describe('следующая тренировка (Вт · Чт · Сб)', () => {
  // getDay(): 0 вс, 1 пн, 2 вт, 3 ср, 4 чт, 5 пт, 6 сб
  test('совпадает с днём недели, если не сделан', () => {
    expect(suggestDay([], 2)).toBe('tue');
    expect(suggestDay([], 4)).toBe('thu');
    expect(suggestDay(['tue'], 6)).toBe('sat');
  });

  test('в дни отдыха и когда сегодняшний сделан — первый несделанный', () => {
    expect(suggestDay([], 1)).toBe('tue');
    expect(suggestDay(['tue'], 5)).toBe('thu');
    expect(suggestDay(['thu'], 4)).toBe('tue');
    expect(suggestDay(['tue', 'thu'], 0)).toBe('sat');
  });

  test('все сделаны — null', () => {
    expect(suggestDay(['tue', 'thu', 'sat'], 2)).toBeNull();
  });
});
